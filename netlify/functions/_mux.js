// FutureSharp Talks — gedeelde toegang tot die Mux Video API.
//
// Die sleutels leef in Netlify se omgewingsveranderlikes (MUX_TOKEN_ID en
// MUX_TOKEN_SECRET), gemerk as geheim, en kom nooit in 'n antwoord aan die
// blaaier nie.

const MUX_API = "https://api.mux.com";

// Die oorspronge wat 'n video direk na Mux mag oplaai (die CORS-oorsprong
// van die oplaaiskakel). Die paneelbord leef op die winkel se domein; die
// netlify.app-adres is vir toetse.
const TOEGELATE_OORSPRONGE = [
  "https://futureshop.futuresharp.co.za",
  "https://futuresharp-shop.netlify.app",
];

function mux_gereed() {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

async function mux_api(metode, pad, liggaam) {
  const magtiging = Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64");
  const resp = await fetch(`${MUX_API}${pad}`, {
    method: metode,
    headers: {
      Authorization: `Basic ${magtiging}`,
      ...(liggaam ? { "Content-Type": "application/json" } : {}),
    },
    body: liggaam ? JSON.stringify(liggaam) : undefined,
  });
  if (resp.status === 204) return null;
  const teks = await resp.text();
  let data = null;
  try { data = teks ? JSON.parse(teks) : null; } catch { /* nie JSON nie */ }
  if (!resp.ok) {
    const boodskap = (data && data.error && (data.error.messages || []).join("; ")) || teks || `status ${resp.status}`;
    const fout = new Error(`Mux ${metode} ${pad}: ${boodskap}`);
    fout.status = resp.status;
    throw fout;
  }
  return data ? data.data : null;
}

// Die instellings vir elke nuwe talk-video: net getekende kykskakels (geen
// publieke toegang), en "basic"-kwaliteit, wat by Mux gratis enkodeer en
// vir 'n talk (meestal 'n spreker voor 'n kamera) skerp genoeg is.
function nuwe_bate_instellings(slug) {
  return {
    playback_policies: ["signed"],
    video_quality: "basic",
    max_resolution_tier: "1080p",
    passthrough: slug,
  };
}

// Vee 'n ou bate by Mux uit. Beste poging: 'n fout hier mag nooit die
// hoofhandeling laat misluk nie, want die nuwe video is reeds gereed.
async function skrap_mux_bate(asset_id) {
  if (!asset_id) return true; // niks om te skrap nie
  try {
    await mux_api("DELETE", `/video/v1/assets/${encodeURIComponent(asset_id)}`);
    return true;
  } catch (fout) {
    if (fout.status === 404) return true;
    console.error(`Kon nie Mux-bate ${asset_id} skrap nie:`, fout.message);
    return false;
  }
}

module.exports = { mux_api, mux_gereed, nuwe_bate_instellings, skrap_mux_bate, TOEGELATE_OORSPRONGE };
