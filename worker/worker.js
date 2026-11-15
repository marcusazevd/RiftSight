// Riftsight — proxy da API oficial de conteúdo de Riftbound (Cloudflare Worker).
// A chave fica só no segredo RIOT_API_KEY do Cloudflare: nunca no app, no site ou no repositório.
// Só expõe dados públicos de cartas; guarda em cache para chamar a Riot raramente.

const RIOT = "https://americas.api.riotgames.com/riftbound/content/v1/contents";
const TTL = 6 * 60 * 60; // 6 h
const ALLOWED = [
  "https://marcusazevd.github.io",
  "https://app.riftbound.local",
];

function cors(origin) {
  const ok = ALLOWED.includes(origin) || /\.claudeusercontent\.com$/.test(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body, status, origin, extra = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin), ...extra },
  });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== "GET") return json({ error: "method" }, 405, origin);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, app: "Riftsight", hasKey: Boolean(env.RIOT_API_KEY) }, 200, origin);
    }
    if (url.pathname !== "/contents") return json({ error: "not_found" }, 404, origin);
    if (!env.RIOT_API_KEY) return json({ error: "missing_key" }, 500, origin);

    const locale = /^[a-z]{2}(_[A-Z]{2})?$/.test(url.searchParams.get("locale") || "") ? url.searchParams.get("locale") : "en";
    const cacheKey = new Request(`https://riftsight-cache/contents?locale=${locale}`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) {
      const r = new Response(hit.body, hit);
      for (const [k, v] of Object.entries(cors(origin))) r.headers.set(k, v);
      r.headers.set("X-Riftsight-Cache", "hit");
      return r;
    }

    const up = await fetch(`${RIOT}?locale=${locale}`, { headers: { "X-Riot-Token": env.RIOT_API_KEY } });
    const text = await up.text();
    if (!up.ok) return json({ error: "riot", status: up.status }, up.status === 429 ? 429 : 502, origin);

    const res = json(text, 200, origin, { "Cache-Control": `public, max-age=${TTL}`, "X-Riftsight-Cache": "miss" });
    ctx.waitUntil(cache.put(cacheKey, new Response(text, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${TTL}` } })));
    return res;
  },
};
