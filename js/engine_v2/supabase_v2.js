/* ==========================================================================
   PROJECT: MAD OVERLORD // SUPABASE CLIENT INTEGRATION (v2)
   ========================================================================== */

/**
 * Supabase 프로젝트 연결 설정
 * - Publishable Key는 클라이언트(웹 및 앱)에서 안전하게 사용할 수 있는 공개 키입니다.
 * - DB 직접 접속 암호(Database Password)는 클라이언트에 포함하지 않습니다.
 */
export const SUPABASE_CONFIG = Object.freeze({
    projectName: 'Mad Overlord',
    projectId: 'zbprmbooxbymihwdhijn',
    region: 'ap-northeast-2',
    url: 'https://zbprmbooxbymihwdhijn.supabase.co',
    publishableKey: 'sb_publishable_XyiJpDGccrkosSwLvmS5WA_vUv3IW6b',
});

let _client = null;

/**
 * Supabase 클라이언트 인스턴스 가져오기 (싱글톤)
 * @returns {any|null} SupabaseClient 인스턴스 또는 null
 */
export function getSupabaseClient() {
    if (_client) return _client;

    const supabaseLib = window.supabase;
    if (!supabaseLib || typeof supabaseLib.createClient !== 'function') {
        console.warn('[Supabase] Supabase JS SDK 라이브러리(window.supabase)가 아직 로드되지 않았습니다.');
        return null;
    }

    try {
        _client = supabaseLib.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        });
        window.supabaseClient_v2 = _client;
        return _client;
    } catch (err) {
        console.error('[Supabase] 클라이언트 초기화 실패:', err);
        return null;
    }
}

/**
 * Supabase 연결 헬스 체크
 * @returns {Promise<{ ok: boolean, latencyMs?: number, version?: string, error?: string }>}
 */
export async function checkSupabaseHealth() {
    const start = performance.now();
    try {
        const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/health`, {
            method: 'GET',
            headers: {
                apikey: SUPABASE_CONFIG.publishableKey,
            },
        });
        const latencyMs = Math.round(performance.now() - start);

        if (!res.ok) {
            return { ok: false, latencyMs, error: `HTTP ${res.status}: ${res.statusText}` };
        }

        const data = await res.json();
        return {
            ok: true,
            latencyMs,
            version: data?.version || 'unknown',
            description: data?.description || '',
        };
    } catch (err) {
        const latencyMs = Math.round(performance.now() - start);
        return {
            ok: false,
            latencyMs,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// 모듈 로드 시 전역 참조 편의 설정
if (typeof window !== 'undefined') {
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
    window.getSupabaseClient = getSupabaseClient;
    window.checkSupabaseHealth = checkSupabaseHealth;
}
