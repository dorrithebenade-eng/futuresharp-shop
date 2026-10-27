// netlify/functions/advertensie-bladsy.js
//
// DIE PUBLIEKE ADVERTENSIESKAKEL (Oktober 2026): /a/<slug>.
//
// Dieselfde werkwyse as verslae-bladsy.js. WhatsApp lees net die kop van
// hierdie bladsy (og:title, og:image) en wys die advertensie self as
// voorskou. 'n Mens se blaaier word dadelik met JavaScript na die
// advertensie se bestemming gestuur (die winkel, of 'n bepaalde boek). Dit is
// doelbewus nie 'n 302 nie: dan sou WhatsApp se leser ook deurgestuur word
// en die winkel se gewone voorskou wys.
//
// /a-beeld/<slug>.jpg is die 1200x630-voorskou en /a-beeld/<slug>-vol.jpg die
// volle beeld, vir advertensies wat in die paneel opgelaai is. Die eerste
// advertensies is statiese lêers; hulle paaie staan in die rekord.

const { kry_store } = require("./_blob-store");

const PUBLIEKE_WERF = "https://futureshop.futuresharp.co.za";
const WINKEL = PUBLIEKE_WERF + "/";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const TEKS = {
  af: { beskrywing: "Future Sharp se eie boekwinkel.", knop: "Gaan na die winkel", gaan: "Jy word na die winkel geneem …", lang: "af" },
  en: { beskrywing: "Future Sharp's own bookshop.", knop: "Go to the shop", gaan: "Taking you to the shop …", lang: "en" },
};

function slug_uit(event, voorvoegsel) {
  const q = (event.queryStringParameters || {}).slug;
  const pad = q || (new RegExp("/" + voorvoegsel + "/([^/?#]+)").exec(String(event.rawUrl || event.path || "")) || [])[1] || "";
  return decodeURIComponent(pad).trim().toLowerCase().replace(/\.jpg$/, "").replace(/\/+$/, "");
}

async function kry(slug) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const lys = (await kry_store("advertensies").get("lys", { type: "json" })) || [];
  return lys.find((a) => a.slug === slug) || null;
}

function og_beeld(a) {
  if (a.beeld && a.beeld.soort === "staties") return PUBLIEKE_WERF + a.beeld.og;
  return PUBLIEKE_WERF + "/a-beeld/" + a.slug + ".jpg?v=" + ((a.beeld && a.beeld.v) || 1);
}

// Die eerste reël van die boodskap, sonder adresse, as beskrywing.
function beskrywing(a, t) {
  const reel = String(a.boodskap || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/futureshop\.futuresharp\.co\.za\S*/gi, "")
    .split("\n").map((r) => r.trim()).find((r) => r.length > 0);
  return (reel || t.beskrywing).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").trim().slice(0, 200) || t.beskrywing;
}

function bladsy(a, t) {
  const adres = PUBLIEKE_WERF + "/a/" + a.slug;
  const beeld = og_beeld(a);
  const doel = a.bestemming || WINKEL;
  const besk = beskrywing(a, t);
  return `<!DOCTYPE html>
<html lang="${t.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(a.titel)} · Future Shop</title>
  <meta name="description" content="${esc(besk)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Future Shop">
  <meta property="og:title" content="${esc(a.titel)}">
  <meta property="og:description" content="${esc(besk)}">
  <meta property="og:url" content="${esc(adres)}">
  <meta property="og:image" content="${esc(beeld)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(a.titel)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/icons/futuresharp-ikoon-32.png?v=2" sizes="32x32" type="image/png">
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#479F91;font-family:Poppins,system-ui,sans-serif;color:#fff;padding:16px;box-sizing:border-box}
    .k{max-width:640px;width:100%;text-align:center}
    img{width:100%;border-radius:12px;display:block;margin-bottom:22px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
    a{display:inline-block;background:#171717;color:#fff;text-decoration:none;font-weight:600;border-radius:10px;padding:12px 22px}
    p{opacity:.9;font-size:14px}
  </style>
</head>
<body>
  <div class="k">
    <img src="${esc(beeld)}" alt="${esc(a.titel)}">
    <a href="${esc(doel)}">${esc(t.knop)}</a>
    <p>${esc(t.gaan)}</p>
  </div>
  <script>location.replace(${JSON.stringify(doel)});</script>
</body>
</html>`;
}

exports.handler = async (event) => {
  const pad = String(event.rawUrl || event.path || "");
  const is_beeld = /\/a-beeld\//.test(pad) || (event.queryStringParameters || {}).beeld === "1";

  if (is_beeld) {
    let slug = slug_uit(event, "a-beeld");
    const vol = /-vol$/.test(slug);
    if (vol) slug = slug.replace(/-vol$/, "");
    const a = await kry(slug);
    if (!a || !a.beeld) return { statusCode: 404, body: "" };
    if (a.beeld.soort === "staties") {
      return { statusCode: 302, headers: { Location: vol ? a.beeld.vol : a.beeld.og }, body: "" };
    }
    const buf = await kry_store("advertensie-beelde").get(vol ? slug : `${slug}-og`, { type: "arrayBuffer" });
    if (!buf) return { statusCode: 404, body: "" };
    return {
      statusCode: 200,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300" },
      body: Buffer.from(buf).toString("base64"),
      isBase64Encoded: true,
    };
  }

  const a = await kry(slug_uit(event, "a"));
  // 'n Onbekende of versteekte advertensie stuur stil na die winkel: die
  // persoon wou in elk geval winkel toe gaan.
  if (!a || !a.aktief) {
    return { statusCode: 302, headers: { Location: WINKEL, "Cache-Control": "no-store" }, body: "" };
  }
  const t = TEKS[a.taal] || TEKS.af;
  // WhatsApp wag net 'n oomblik vir 'n voorskou. 'n Koue Function het meer as
  // twee sekondes gevat (27 Okt 2026), en toe wys WhatsApp net die domein.
  // Netlify se CDN hou die bladsy dus vir tien minute (en bied 'n ou kopie
  // aan terwyl hy vernuwe), sodat WhatsApp dadelik 'n antwoord kry.
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Netlify-CDN-Cache-Control": "public, durable, max-age=600, stale-while-revalidate=86400",
    },
    body: bladsy(a, t),
  };
};
