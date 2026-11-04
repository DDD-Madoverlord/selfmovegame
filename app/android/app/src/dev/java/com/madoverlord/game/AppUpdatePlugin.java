package com.madoverlord.game;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

/**
 * 앱 업데이트 (D-074) — js/ui_v2/appUpdate_v2.js 에서 window.Capacitor.Plugins.AppUpdate 로 부름.
 * download({ url, fileName, sha256? }): APK를 앱 전용 폴더(Android/data/…/files/Download)로 내려받고(저장 권한 필요 없음)
 * 0.5초마다 'progress' { done, total } 를 알림. 백그라운드에서 체크섬(있으면)·패키지·서명·빌드 번호를
 * 확인한 뒤 Android 설치 화면을 연다 → { status: 'installing' }. 검사 실패는 파일을 지우고 reject.
 * 이 앱에 "알 수 없는 앱 설치" 권한이 없으면 그 설정 화면을 열고 { status: 'needPermission' }.
 * 주소는 HTTPS만, 시험용 HTTP localhost·127.0.0.1 허용. download만 file://도 허용하며 같은 검사를 거침.
 * fetchText({ url, timeout, headers }): 업데이트 정보(NAS latest.json)를 읽어 { status, text } (D-081) —
 * WebView의 fetch는 다른 주소라 CORS에 막히므로 여기서 읽음. 256KB까지, 넘거나 실패하면 reject.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private final Handler main = new Handler(Looper.getMainLooper());

    private static final int MAX_TEXT = 256 * 1024;

    private boolean allowedUrl(String url, boolean allowFile) {
        if (url == null) return false;
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if ("https".equalsIgnoreCase(scheme)) return host != null && !host.isEmpty();
            if ("http".equalsIgnoreCase(scheme)) {
                return "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host);
            }
            return allowFile && "file".equalsIgnoreCase(scheme) && url.regionMatches(true, 0, "file://", 0, 7)
                    && uri.getRawAuthority() == null && uri.getPath() != null && uri.getPath().startsWith("/");
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void fetchText(PluginCall call) {
        String url = call.getString("url");
        if (!allowedUrl(url, false)) {
            call.reject("업데이트 정보 주소는 HTTPS 또는 시험용 HTTP localhost·127.0.0.1만 허용됩니다");
            return;
        }
        int timeout = call.getInt("timeout", 8000);
        JSObject headers = call.getObject("headers", new JSObject());
        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                con = (HttpURLConnection) new URL(url).openConnection();
                con.setConnectTimeout(timeout);
                con.setReadTimeout(timeout);
                con.setUseCaches(false);
                for (Iterator<String> it = headers.keys(); it.hasNext(); ) {
                    String k = it.next();
                    con.setRequestProperty(k, headers.getString(k));
                }
                int status = con.getResponseCode();
                InputStream in = status < 400 ? con.getInputStream() : con.getErrorStream();
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                if (in != null) {
                    byte[] b = new byte[8192];
                    for (int n; (n = in.read(b)) > 0; ) {
                        buf.write(b, 0, n);
                        if (buf.size() > MAX_TEXT) throw new Exception("너무 큼");
                    }
                    in.close();
                }
                JSObject r = new JSObject();
                r.put("status", status);
                r.put("text", new String(buf.toByteArray(), StandardCharsets.UTF_8));
                call.resolve(r);
            } catch (Exception e) {
                call.reject("읽지 못함: " + e.getMessage());
            } finally {
                if (con != null) con.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        if (!allowedUrl(url, true)) {
            call.reject("업데이트 주소는 HTTPS 또는 시험용 HTTP localhost·127.0.0.1·file://만 허용됩니다");
            return;
        }
        String name = call.getString("fileName", "MadOverlord-update.apk").replaceAll("[^A-Za-z0-9._-]", "_");
        if (name.isEmpty() || name.equals(".") || name.equals("..")) name = "MadOverlord-update.apk";
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent perm = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            perm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(perm);
            JSObject r = new JSObject();
            r.put("status", "needPermission");
            call.resolve(r);
            return;
        }
        if ("file".equalsIgnoreCase(Uri.parse(url).getScheme())) {
            verifyAndInstall(new File(Uri.parse(url).getPath()), call);
            return;
        }
        File file = new File(ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name);
        if (file.exists()) file.delete();
        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url).normalizeScheme())
                .setTitle("매드 오버로드 업데이트")
                .setMimeType(APK_MIME)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(ctx, Environment.DIRECTORY_DOWNLOADS, name);
        long id = dm.enqueue(req);
        poll(dm, id, file, call);
    }

    private void poll(DownloadManager dm, long id, File file, PluginCall call) {
        main.postDelayed(() -> {
            try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(id))) {
                if (c == null || !c.moveToFirst()) {
                    call.reject("내려받기가 취소됨");
                    return;
                }
                int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                JSObject p = new JSObject();
                p.put("done", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
                p.put("total", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
                notifyListeners("progress", p);
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    verifyAndInstall(file, call);
                    return;
                }
                if (status == DownloadManager.STATUS_FAILED) {
                    call.reject("내려받기 실패 (사유 " + c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)) + ")");
                    return;
                }
            }
            poll(dm, id, file, call);
        }, 500);
    }

    private void verifyAndInstall(File file, PluginCall call) {
        new Thread(() -> {
            try {
                if (!file.isFile()) throw new Exception("APK 파일이 없습니다");
                if (call.hasOption("sha256")) {
                    String expected = call.getString("sha256");
                    if (expected == null || !expected.matches("(?i)[0-9a-f]{64}")) {
                        throw new Exception("업데이트 정보의 SHA-256 체크섬이 올바르지 않습니다");
                    }
                    MessageDigest digest = MessageDigest.getInstance("SHA-256");
                    try (InputStream in = new FileInputStream(file)) {
                        byte[] b = new byte[64 * 1024];
                        for (int n; (n = in.read(b)) != -1; ) digest.update(b, 0, n);
                    }
                    if (!hex(digest.digest()).equalsIgnoreCase(expected)) {
                        throw new Exception("받은 파일의 체크섬이 다릅니다 (SHA-256 불일치)");
                    }
                }
                PackageManager pm = getContext().getPackageManager();
                int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                        ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
                PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
                if (archive == null) throw new Exception("받은 파일을 APK로 읽을 수 없습니다");
                String packageName = getContext().getPackageName();
                if (!packageName.equals(archive.packageName)) {
                    throw new Exception("받은 파일이 매드 오버로드 정식 업데이트가 아닙니다 (패키지 이름 다름)");
                }
                PackageInfo installed = pm.getPackageInfo(packageName, flags);
                boolean useSigningInfo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                        && archive.signingInfo != null && installed.signingInfo != null;
                if (!certificates(pm, archive, file.getAbsolutePath(), useSigningInfo).equals(certificates(pm, installed, null, useSigningInfo))) {
                    throw new Exception("받은 파일이 매드 오버로드 정식 업데이트가 아닙니다 (서명 다름)");
                }
                long next = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? archive.getLongVersionCode() : archive.versionCode;
                long current = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? installed.getLongVersionCode() : installed.versionCode;
                if (next <= current) throw new Exception("받은 APK의 빌드 번호가 현재 앱보다 높지 않습니다");
                main.post(() -> {
                    try {
                        install(file, call);
                    } catch (Exception e) {
                        call.reject("설치 화면을 열지 못했습니다: " + e.getMessage());
                    }
                });
            } catch (Exception e) {
                String message = "업데이트 확인 실패: " + e.getMessage();
                if (file.exists() && !file.delete()) message += " (받은 파일을 지우지 못했습니다)";
                final String error = message;
                main.post(() -> call.reject(error));
            }
        }).start();
    }

    private Set<String> certificates(PackageManager pm, PackageInfo info, String archivePath, boolean useSigningInfo) throws Exception {
        Signature[] signatures = useSigningInfo ? null : info.signatures;
        if (useSigningInfo) {
            // 여러 서명자는 현재 서명자 전부, 단일 서명자는 교체 이력까지 집합으로 비교.
            signatures = info.signingInfo.hasMultipleSigners()
                    ? info.signingInfo.getApkContentsSigners() : info.signingInfo.getSigningCertificateHistory();
        }
        if (signatures == null || signatures.length == 0) {
            PackageInfo legacy = archivePath != null
                    ? pm.getPackageArchiveInfo(archivePath, PackageManager.GET_SIGNATURES)
                    : pm.getPackageInfo(info.packageName, PackageManager.GET_SIGNATURES);
            if (legacy != null) signatures = legacy.signatures;
        }
        if (signatures == null || signatures.length == 0) throw new Exception("APK 서명 인증서를 읽을 수 없습니다");
        Set<String> result = new HashSet<>();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (Signature signature : signatures) result.add(hex(digest.digest(signature.toByteArray())));
        return result;
    }

    private String hex(byte[] bytes) {
        char[] digits = "0123456789abcdef".toCharArray();
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) result.append(digits[(b & 0xff) >>> 4]).append(digits[b & 0xf]);
        return result.toString();
    }

    private void install(File file, PluginCall call) {
        if (!file.exists()) {
            call.reject("APK 파일이 없음: " + file.getName());
            return;
        }
        Context ctx = getContext();
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, APK_MIME);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
        JSObject r = new JSObject();
        r.put("status", "installing");
        call.resolve(r);
    }
}
