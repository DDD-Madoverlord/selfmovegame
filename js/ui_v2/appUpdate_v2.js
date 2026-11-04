/* ==========================================================================
   PROJECT: MAD OVERLORD // 앱 업데이트 확인 (D-074, NAS D-081)
   Android 앱(Capacitor)에서만: 업데이트 정보(JSON)를 읽어 지금 버전(version_v2.js)보다 새것이면
   "새 버전" 창 → [업데이트] → 앱 안에서 APK를 받고(진행 막대) Android 설치 화면을 연다 (네이티브 플러그인 AppUpdate).
   - 설치 전 확인: 체크섬·패키지·서명·빌드 번호 (네이티브 플러그인).
   - 플레이판(AppUpdate 플러그인 없음)은 확인하지 않음 — 구글 플레이에서 업데이트.
   - 어디서 읽나: window.madOverlordUpdateFeed (app/update.local.json의 feed를 build_www.py가 넣음 — NAS의 latest.json),
     없으면 GitHub 최신 릴리스. 앱 안에서는 네이티브(AppUpdate.fetchText)로 읽어 CORS에 걸리지 않음.
   - NAS 모양 (app/release.py가 씀): { version, build, name, notes, required, file(latest.json 기준 상대 주소)|url, size, sha256 }
     GitHub 모양: 태그 vX.Y.Z + APK 첨부, 이름·설명에 [필수].
   - 새것 = 버전이 높거나, 버전이 같고 빌드가 높음. required면 [나중에] 없이 업데이트만.
   - 인터넷이 없거나 정보가 없으면 조용히 넘어감 (설정 창의 "업데이트 확인"은 결과를 알려 줌).
   ========================================================================== */

import { VERSION, BUILD, RELEASE_REPO } from '../version_v2.js';
import { sound } from '../engine_v2/audio/sound_v2.js';

const TIMEOUT_MS = 8000;

/** 앱 안인가 (웹 브라우저면 false) */
export function isApp() {
    return !!window.madOverlordApp && !!window.Capacitor;
}

/** 'v0.2.1' · '0.2.1-b3' → [0, 2, 1] 끼리 비교: a가 더 새것이면 1, 같으면 0, 옛것이면 -1 */
export function compareVersions(a, b) {
    const parse = v => String(v).replace(/^v/i, '').split(/[-+ ]/)[0].split('.').map(n => parseInt(n, 10) || 0);
    const x = parse(a), y = parse(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] || 0) - (y[i] || 0);
        if (d) return d > 0 ? 1 : -1;
    }
    return 0;
}

/** latest가 지금 앱보다 새것인가 — 버전이 높거나, 버전이 같고 빌드가 높음 */
export function isNewer(latest, version = VERSION, build = BUILD) {
    const d = compareVersions(latest.version, version);
    return d > 0 || (d === 0 && (latest.build || 0) > build);
}

/** 업데이트 정보 JSON → { version, build, name, notes, url, fileName, size, sha256, required } 또는 null. feed = 그 JSON의 주소 */
export function parseFeed(r, feed) {
    if (!r || typeof r !== 'object') return null;
    if (r.tag_name) {   // GitHub 최신 릴리스
        const apk = (r.assets || []).find(a => /\.apk$/i.test(a.name));
        if (!apk) return null;
        return {
            version: String(r.tag_name).replace(/^v/i, ''),
            build: 0,
            name: r.name || r.tag_name,
            notes: String(r.body || '').trim(),
            url: apk.browser_download_url,
            fileName: apk.name,
            size: apk.size || 0,
            required: /\[필수\]/.test(`${r.name || ''} ${r.body || ''}`)
        };
    }
    if (!r.version || !(r.file || r.url)) return null;   // NAS latest.json
    let url;
    try { url = new URL(r.url || r.file, feed).href; } catch { return null; }
    return {
        version: String(r.version).replace(/^v/i, ''),
        build: parseInt(r.build, 10) || 0,
        name: r.name || `매드 오버로드 ${r.version}`,
        notes: String(r.notes || '').trim(),
        url,
        fileName: url.split('/').pop().split('?')[0],
        size: r.size || 0,
        sha256: r.sha256,
        required: !!r.required
    };
}

/** 주소의 글을 읽음 — 앱이면 네이티브(CORS 없음), 아니면 fetch. 실패하면 null */
async function readText(url, headers) {
    const plugin = window.Capacitor?.Plugins?.AppUpdate;
    if (isApp() && plugin?.fetchText) {
        try {
            const r = await plugin.fetchText({ url, timeout: TIMEOUT_MS, headers });
            return r.status >= 200 && r.status < 300 ? r.text : null;
        } catch {
            return null;
        }
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: ctl.signal, headers, cache: 'no-store' });
        return res.ok ? await res.text() : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** 최신 릴리스 { version, build, name, notes, url, size, required } 또는 null (정보 없음·인터넷 없음) */
export async function fetchLatest() {
    if (isApp() && !window.Capacitor?.Plugins?.AppUpdate) return null;
    const feed = window.madOverlordUpdateFeed || `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
    const headers = /api\.github\.com/.test(feed) ? { Accept: 'application/vnd.github+json' } : {};
    const text = await readText(`${feed}${feed.includes('?') ? '&' : '?'}t=${Date.now()}`, headers);   // 캐시를 거치지 않게
    if (!text) return null;
    try {
        return parseFeed(JSON.parse(text), feed);
    } catch {
        return null;
    }
}

/**
 * 새 버전 확인. silent면 새 버전이 있을 때만 창을 띄움 (앱 시작 때),
 * 아니면 "최신 버전" / "확인할 수 없음"도 알려 줌 (설정 창 버튼). 돌려주는 값: 'update' | 'latest' | 'offline' | 'web' | 'play'
 */
export async function checkForUpdate({ silent = true, onStatus } = {}) {
    if (!isApp()) return 'web';
    if (!window.Capacitor?.Plugins?.AppUpdate) {
        if (!silent) onStatus?.('구글 플레이에서 업데이트됩니다');
        return 'play';
    }
    onStatus?.('확인 중…');
    const latest = await fetchLatest();
    if (!latest) {
        onStatus?.('업데이트 정보를 받을 수 없음 (인터넷·릴리스 확인)');
        return 'offline';
    }
    if (!isNewer(latest)) {
        onStatus?.(`최신 버전입니다 (${VERSION} · 빌드 ${BUILD})`);
        return 'latest';
    }
    onStatus?.(`새 버전 ${latest.version}이 있습니다`);
    showUpdateDialog(latest);
    return 'update';
}

function mb(n) {
    return n ? `${(n / 1048576).toFixed(0)}MB` : '';
}

function showUpdateDialog(info) {
    if (document.querySelector('.v2-update')) return;
    const el = document.createElement('div');
    el.className = 'v2-update';
    const notes = info.notes.split('\n').slice(0, 12).join('\n');
    el.innerHTML = `
        <div class="v2-update__panel v2-panel" role="dialog" aria-label="새 버전">
            <div class="v2-hazard v2-update__stripe"></div>
            <h2>UPDATE <small>새 버전이 있습니다</small></h2>
            <p class="v2-update__ver"><span>지금 <b>${VERSION}</b> (빌드 ${BUILD})</span><i>→</i><span>새 버전 <b class="is-new"></b></span></p>
            <pre class="v2-update__notes"></pre>
            <div class="v2-update__bar" hidden><i></i></div>
            <p class="v2-update__status" aria-live="polite"></p>
            <div class="v2-update__actions">
                ${info.required ? '' : '<button class="v2-btn v2-btn--ghost" data-act="later">나중에</button>'}
                <button class="v2-btn" data-act="go">업데이트 ${mb(info.size)}</button>
            </div>
        </div>`;
    el.querySelector('.is-new').textContent = info.version + (info.build ? ` (빌드 ${info.build})` : '');
    el.querySelector('.v2-update__notes').textContent = notes || info.name;
    document.body.appendChild(el);
    const bar = el.querySelector('.v2-update__bar');
    const fill = bar.querySelector('i');
    const status = el.querySelector('.v2-update__status');
    const go = el.querySelector('[data-act="go"]');
    el.querySelector('[data-act="later"]')?.addEventListener('click', () => { sound.play('ui_click'); el.remove(); });
    go.addEventListener('click', async () => {
        sound.play('ui_click');
        go.disabled = true;
        const plugin = window.Capacitor?.Plugins?.AppUpdate;
        bar.hidden = false;
        status.textContent = '내려받는 중…';
        const sub = await plugin.addListener('progress', p => {
            const k = p.total > 0 ? p.done / p.total : 0;
            fill.style.width = `${Math.round(k * 100)}%`;
            status.textContent = `내려받는 중… ${Math.round(k * 100)}% (${mb(p.done)} / ${mb(p.total)})`;
        });
        try {
            const r = await plugin.download({ url: info.url, fileName: info.fileName || `MadOverlord-${info.version}.apk`, sha256: info.sha256 });
            if (r.status === 'needPermission') {
                status.textContent = '설정에서 "이 출처 허용"을 켠 뒤 돌아와 [업데이트]를 다시 누르세요.';
            } else {
                fill.style.width = '100%';
                status.textContent = '설치 화면에서 [업데이트]를 누르면 끝납니다.';
            }
        } catch (e) {
            status.textContent = `내려받지 못했습니다: ${e?.message || e}`;
        } finally {
            sub?.remove?.();
            go.disabled = false;
        }
    });
}
