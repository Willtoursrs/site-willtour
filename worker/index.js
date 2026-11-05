// Worker da area logada: guarda as chaves do Pax Pro e do Agendor e repassa
// as chamadas do dashboard, so para quem tem login Google permitido.
//
//   GET /paxpro/<rota>   -> https://app.paxpro.com.br/<rota>  (ex: /paxpro/api/v1/agencia/venda?page=1)
//   GET /agendor/<rota>  -> https://api.agendor.com.br/v3/<rota>
//
// Header obrigatorio: Authorization: Bearer <credential do Google Sign-In>
// Segredos (wrangler secret put): PAXPRO_CODE, AGENDOR_TOKEN

const GOOGLE_CLIENT_ID = '193855139914-i9is5iec3q57oh5pmtuavk3sg12k13f8.apps.googleusercontent.com';
const PERMITIDOS = ['will@willtoursrs.com.br', 'willian.mepi@gmail.com'];
const ORIGENS = ['https://willtoursrs.com.br', 'https://www.willtoursrs.com.br'];

const PAXPRO_BASE = 'https://app.paxpro.com.br';
const AGENDOR_BASE = 'https://api.agendor.com.br/v3';

// ---------- login Google (ID token RS256) ----------

let jwks = null;
let jwksExp = 0;

async function googleKeys() {
  if (jwks && Date.now() < jwksExp) return jwks;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  jwks = (await res.json()).keys;
  jwksExp = Date.now() + 60 * 60 * 1000;
  return jwks;
}

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

// Devolve o e-mail se o token for valido e permitido; senao null.
async function verificarGoogle(token) {
  const [h, p, s] = (token || '').split('.');
  if (!s) return null;
  const header = JSON.parse(new TextDecoder().decode(b64url(h)));
  const jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const c = JSON.parse(new TextDecoder().decode(b64url(p)));
  const email = (c.email || '').toLowerCase();
  if (c.aud !== GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(c.iss)) return null;
  if (c.exp * 1000 < Date.now() || !c.email_verified || !PERMITIDOS.includes(email)) return null;
  return email;
}

// ---------- token do Pax Pro (vale 1h; renova com folga) ----------

let paxToken = null;
let paxTokenExp = 0;

async function paxproToken(env, forcar) {
  if (!forcar && paxToken && Date.now() < paxTokenExp) return paxToken;
  const res = await fetch(`${PAXPRO_BASE}/noauth/v1/login`, { headers: { 'agency-api-code': env.PAXPRO_CODE } });
  if (!res.ok) throw new Error(`login Pax Pro: HTTP ${res.status}`);
  paxToken = (await res.json()).token;
  paxTokenExp = Date.now() + 50 * 60 * 1000;
  return paxToken;
}

async function proxyPaxpro(rota, env) {
  let res = await fetch(PAXPRO_BASE + rota, { headers: { Authentication: await paxproToken(env) } });
  if (res.status === 401 || res.status === 403) {
    res = await fetch(PAXPRO_BASE + rota, { headers: { Authentication: await paxproToken(env, true) } });
  }
  return res;
}

const proxyAgendor = (rota, env) =>
  fetch(AGENDOR_BASE + rota, { headers: { Authorization: `Token ${env.AGENDOR_TOKEN}` } });

// ---------- handler ----------

function cors(origin, env) {
  const local = env.DEV_LOCAL === '1' && /^(http:\/\/(localhost|127\.0\.0\.1)(:\d+)?|null)$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': ORIGENS.includes(origin) || local ? origin : ORIGENS[0],
    'Access-Control-Allow-Headers': 'Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'Retry-After',
    Vary: 'Origin',
  };
}

export default {
  async fetch(req, env) {
    const h = cors(req.headers.get('Origin'), env);
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    if (req.method !== 'GET') return new Response('so GET', { status: 405, headers: h });

    // DEV_LOCAL=1 (so no .dev.vars do wrangler dev) pula o login Google.
    if (env.DEV_LOCAL !== '1') {
      const auth = req.headers.get('Authorization') || '';
      const email = await verificarGoogle(auth.replace(/^Bearer\s+/i, '')).catch(() => null);
      if (!email) return Response.json({ erro: 'login Google invalido ou expirado' }, { status: 401, headers: h });
    }

    const url = new URL(req.url);
    const [, api, ...resto] = url.pathname.split('/');
    const rota = '/' + resto.join('/') + url.search;
    let res;
    try {
      if (api === 'paxpro') res = await proxyPaxpro(rota, env);
      else if (api === 'agendor') res = await proxyAgendor(rota, env);
      else return Response.json({ erro: 'rota desconhecida' }, { status: 404, headers: h });
    } catch (e) {
      return Response.json({ erro: e.message }, { status: 502, headers: h });
    }
    return new Response(res.body, {
      status: res.status,
      headers: {
        ...h,
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        ...(res.headers.get('Retry-After') ? { 'Retry-After': res.headers.get('Retry-After') } : {}),
      },
    });
  },
};
