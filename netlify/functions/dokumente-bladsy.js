// netlify/functions/dokumente-bladsy.js
//
// DIE PUBLIEKE DOKUMENTESKAKEL (Oktober 2026): /dokumente/<kode>.
//
// Soos verslae-bladsy.js: WhatsApp en e-pos lees die kop (og:title, og:image)
// en 'n mens se blaaier word met JavaScript na die Drive-vouer gestuur. Die
// persoon se naam staan nêrens op hierdie bladsy of in die adres nie, net
// "Future Sharp" en Dokumente (of Documents).
//
// /dokumente-beeld/<kode>.jpg bedien die beeld uit die store "dokumente-beelde".

const { kry_store } = require("./_blob-store");

const PUBLIEKE_WERF = "https://futureshop.futuresharp.co.za";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const TEKS = {
  af: { etiket: "Dokumente", beskrywing: "Jou Future Sharp-dokumente op een plek.", knop: "Maak die dokumente oop", gaan: "Jy word na die dokumente geneem …", toe: "Hierdie skakel is nie meer aktief nie. Kontak Future Sharp gerus vir 'n nuwe skakel.", lang: "af" },
  en: { etiket: "Documents", beskrywing: "Your Future Sharp documents in one place.", knop: "Open the documents", gaan: "Taking you to the documents …", toe: "This link is no longer active. Please contact Future Sharp for a new link.", lang: "en" },
};

function kode_uit(event, voorvoegsel) {
  const q = (event.queryStringParameters || {}).kode;
  const pad = q || (new RegExp("/" + voorvoegsel + "/([^/?#]+)").exec(String(event.rawUrl || event.path || "")) || [])[1] || "";
  return decodeURIComponent(pad).trim().toLowerCase().replace(/\.jpg$/, "").replace(/\/+$/, "");
}

async function kry(kode) {
  if (!/^[a-z0-9]{8}$/.test(kode)) return null;
  const lys = (await kry_store("dokumente").get("skakels", { type: "json" })) || [];
  return lys.find((s) => s.kode === kode) || null;
}

function bladsy(s, t) {
  const titel = "Future Sharp · " + t.etiket;
  const adres = PUBLIEKE_WERF + "/dokumente/" + s.kode;
  const beeld = PUBLIEKE_WERF + "/dokumente-beeld/" + s.kode + ".jpg?v=" + (s.beeld_v || 1);
  const drive = "https://drive.google.com/drive/folders/" + encodeURIComponent(s.vouer_id);
  return `<!DOCTYPE html>
<html lang="${t.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${esc(titel)}</title>
  <meta name="description" content="${esc(t.beskrywing)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Future Sharp">
  <meta property="og:title" content="${esc(titel)}">
  <meta property="og:description" content="${esc(t.beskrywing)}">
  <meta property="og:url" content="${esc(adres)}">
  <meta property="og:image" content="${esc(beeld)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(titel)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/icons/futuresharp-ikoon-32.png?v=2" sizes="32x32" type="image/png">
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#071630;font-family:Poppins,system-ui,sans-serif;color:#fff;padding:16px;box-sizing:border-box}
    .k{max-width:560px;width:100%;text-align:center}
    img{width:100%;border-radius:12px;display:block;margin-bottom:22px}
    a{display:inline-block;background:#00A291;color:#fff;text-decoration:none;font-weight:600;border-radius:10px;padding:12px 22px}
    p{opacity:.8;font-size:14px}
  </style>
</head>
<body>
  <div class="k">
    <img src="${esc(beeld)}" alt="${esc(titel)}">
    <a href="${esc(drive)}">${esc(t.knop)}</a>
    <p>${esc(t.gaan)}</p>
  </div>
  <script>location.replace(${JSON.stringify(drive)});</script>
</body>
</html>`;
}

function toe_bladsy(t) {
  return `<!DOCTYPE html><html lang="${t.lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Future Sharp</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#071630;font-family:Poppins,system-ui,sans-serif;color:#fff;padding:16px;box-sizing:border-box;text-align:center}p{max-width:440px;line-height:1.5}</style></head>
<body><p>${esc(t.toe)}</p></body></html>`;
}

exports.handler = async (event) => {
  const is_beeld = /\/dokumente-beeld\//.test(String(event.rawUrl || event.path || "")) || (event.queryStringParameters || {}).beeld === "1";

  if (is_beeld) {
    const kode = kode_uit(event, "dokumente-beeld");
    const s = await kry(kode);
    const buf = s ? await kry_store("dokumente-beelde").get(kode, { type: "arrayBuffer" }) : null;
    if (!buf) return { statusCode: 404, body: "" };
    return {
      statusCode: 200,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300" },
      body: Buffer.from(buf).toString("base64"),
      isBase64Encoded: true,
    };
  }

  const s = await kry(kode_uit(event, "dokumente"));
  const t = TEKS[(s && s.taal) || "af"] || TEKS.af;
  if (!s || !s.oop) {
    return { statusCode: s ? 410 : 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, body: toe_bladsy(t) };
  }
  return { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" }, body: bladsy(s, t) };
};

exports._toets = { kode_uit, bladsy, TEKS };
