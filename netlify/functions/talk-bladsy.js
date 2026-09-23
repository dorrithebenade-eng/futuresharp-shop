// PUBLIEK — bedien die talk-bladsy vir /talks/<slug>. FutureSharp Talks.
//
// WAAROM 'N FUNCTION EN NIE NET 'N BLADSY NIE: WhatsApp, LinkedIn en
// Facebook lees 'n gedeelde skakel se voorskou (titel, beskrywing, prent)
// uit die HTML self en loop geen JavaScript nie. 'n Statiese talk.html kan
// dus net een algemene voorskou hê. Hierdie Function haal die sjabloon,
// sit die talk se eie titel, oorsig en omslag in die kop, en stuur dit
// terug. Die bladsy se eie JavaScript bou daarna die inhoud soos altyd.
//
// Die sjabloon kom van die werf se eie netlify.app-adres, nie van
// process.env.URL nie: die wildcard-DNS op futuresharp.co.za stuur 'n
// Function se terugroep na Afrihost (sien die projeknotas).

const { kry_store } = require("./_blob-store");

const PUBLIEKE_WERF = "https://futureshop.futuresharp.co.za";
let sjabloon_kas = null;
let sjabloon_tyd = 0;

async function kry_sjabloon() {
  // Vyf minute in die geheue van hierdie instansie: 'n nuwe ontplooiing kry
  // 'n nuwe instansie, en 'n besoek hoef nie elke keer die sjabloon te haal nie.
  if (sjabloon_kas && Date.now() - sjabloon_tyd < 5 * 60 * 1000) return sjabloon_kas;
  const basis = `https://${process.env.SITE_NAME}.netlify.app`;
  const resp = await fetch(`${basis}/talk.html`);
  if (!resp.ok) throw new Error(`Sjabloon: status ${resp.status}`);
  sjabloon_kas = await resp.text();
  sjabloon_tyd = Date.now();
  return sjabloon_kas;
}

function esc(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kort(teks, maks) {
  const t = String(teks || "").replace(/\s+/g, " ").trim();
  return t.length > maks ? `${t.slice(0, maks - 1).trimEnd()}…` : t;
}

function kry_slug(event) {
  const q = (event.queryStringParameters || {}).slug;
  if (q) return String(q);
  const pad = String(event.rawUrl || event.path || "");
  const passing = /\/talks\/([^/?#]+)/.exec(pad);
  return passing ? decodeURIComponent(passing[1]) : "";
}

exports.handler = async (event) => {
  const slug = kry_slug(event).trim().toLowerCase().replace(/\/+$/, "");
  if (!slug) {
    return { statusCode: 302, headers: { Location: "/talks" }, body: "" };
  }

  let html;
  try {
    html = await kry_sjabloon();
  } catch (fout) {
    console.error("Kon nie die talk-sjabloon haal nie:", fout);
    return { statusCode: 302, headers: { Location: "/talks" }, body: "" };
  }

  const talk = await kry_store("talks").get(slug, { type: "json" });
  const bestaan = talk && talk.aktief !== false;

  let meta;
  if (bestaan) {
    const titel = `${talk.titel} · FutureSharp Talks`;
    const beskrywing = kort(talk.oorsig || talk.vol_beskrywing || `${talk.spreker} by FutureSharp Talks`, 200);
    const prent = talk.omslag ? `${PUBLIEKE_WERF}${talk.omslag}` : "";
    const adres = `${PUBLIEKE_WERF}/talks/${slug}`;
    meta = [
      `<title>${esc(titel)}</title>`,
      `<meta name="description" content="${esc(beskrywing)}">`,
      `<meta property="og:type" content="video.other">`,
      `<meta property="og:site_name" content="FutureSharp Talks">`,
      `<meta property="og:title" content="${esc(talk.titel)}">`,
      `<meta property="og:description" content="${esc(beskrywing)}">`,
      `<meta property="og:url" content="${esc(adres)}">`,
      prent ? `<meta property="og:image" content="${esc(prent)}">` : "",
      prent ? `<meta property="og:image:width" content="1280"><meta property="og:image:height" content="720">` : "",
      `<meta name="twitter:card" content="summary_large_image">`,
      `<link rel="canonical" href="${esc(adres)}">`,
    ].filter(Boolean).join("\n  ");
  } else {
    meta = `<title>FutureSharp Talks</title>\n  <meta name="robots" content="noindex">`;
  }

  // Die sjabloon dra 'n merker waar die kop-inligting hoort.
  const uit = html.replace(/<!--FST-META-->[\s\S]*?<!--\/FST-META-->/, meta);

  return {
    statusCode: bestaan ? 200 : 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
    body: uit,
  };
};
