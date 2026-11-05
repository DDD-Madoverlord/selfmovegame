package com.madoverlord.game;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * 매드 오버로드 Android 앱 (D-073) — 게임(www)을 Capacitor WebView로 띄움.
 * 가로 전체 화면(상태·내비게이션 막대 숨김, 가장자리를 쓸면 잠깐 보임), 화면 꺼짐 막기,
 * 효과음·배경음은 첫 터치 없이도 재생되게.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        FlavorPlugins.register(this);   // 개발판만 앱 업데이트 내려받기·설치
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        hideSystemBars();
    }

    @Override
    public void onPause() {
        appState(false);   // super 전에: WebView가 멈추기 전에 게임에 알림
        super.onPause();
    }

    @Override
    public void onResume() {
        super.onResume();
        appState(true);
    }

    /** 앱이 뒤로 가거나 돌아올 때 게임에 알림 → 게임을 멈추고 소리를 끔 (11-05 피드백 22번, js/main_v2.js 'mo-app-state') */
    private void appState(boolean active) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('mo-app-state',{detail:{active:" + active + "}}))", null);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();   // 알림창·다른 앱에서 돌아오면 다시 숨김
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.hide(WindowInsetsCompat.Type.systemBars());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
