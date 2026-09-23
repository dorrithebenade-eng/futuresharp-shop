// Personeel-beskermd — begin 'n video-oplaai vir 'n talk. FutureSharp Talks.
//
// Vra Mux vir 'n eenmalige oplaaiskakel en gee dit aan die paneelbord. Die
// blaaier laai die lêer DIREK na Mux (met 'n PUT na daardie skakel), nie
// deur Netlify nie: 'n talk van 15 minute is honderde megagrepe, en 'n
// Function kan net sowat 6MB ontvang.
//
// Die stand van die video leef in die "talk-video"-store (per slug), apart
// van die talk se rekord, sodat 'n wysiging van die talk in die paneelbord
// dit nooit kan uitvee nie. Die ou video (as daar een is) word eers geskrap
// wanneer die nuwe een gereed is; tot dan bly die ou een speel.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { mux_api, mux_gereed, nuwe_bate_instellings, TOEGELATE_OORSPRONGE } = require("./_mux");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }
  if (!mux_gereed()) {
    return { statusCode: 500, body: "Die Mux-sleutels is nie in Netlify opgestel nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const slug = String(invoer.slug || "").trim().toLowerCase();
  if (!slug || !(await kry_store("talks").get(slug, { type: "json" }))) {
    return { statusCode: 404, body: "Stoor die talk eers voordat jy 'n video oplaai" };
  }

  const koppe = event.headers || {};
  const oorsprong = koppe.origin || koppe.Origin || "";
  const cors_origin = TOEGELATE_OORSPRONGE.includes(oorsprong) ? oorsprong : TOEGELATE_OORSPRONGE[0];

  const oplaai = await mux_api("POST", "/video/v1/uploads", {
    cors_origin,
    // Twee uur om die lêer te stuur: genoeg vir 'n groot lêer op 'n stadige lyn.
    timeout: 7200,
    new_asset_settings: nuwe_bate_instellings(slug),
  });

  const store = kry_store("talk-video");
  const vorige = (await store.get(slug, { type: "json" })) || {};
  await store.setJSON(slug, {
    slug,
    stand: "wag_vir_oplaai",
    upload_id: oplaai.id,
    asset_id: null,
    playback_id: null,
    duur_sekondes: null,
    // Die video wat tans speel, bly tot die nuwe een gereed is.
    speel_asset_id: vorige.stand === "gereed" ? vorige.asset_id : vorige.speel_asset_id || null,
    speel_playback_id: vorige.stand === "gereed" ? vorige.playback_id : vorige.speel_playback_id || null,
    begin_op: new Date().toISOString(),
    begin_deur: gebruiker.email,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ url: oplaai.url, upload_id: oplaai.id }),
  };
};
