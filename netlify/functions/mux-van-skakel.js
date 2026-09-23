// Personeel-beskermd — laat Mux 'n talk se video self by 'n skakel haal.
// FutureSharp Talks.
//
// Vir 'n spreker wat sy opname as skakel deel. Die skakel moet direk na die
// videolêer wys (Mux laai dit af); 'n YouTube- of gewone Google Drive-
// bladsy werk nie, want dit is 'n webblad en nie die lêer nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { mux_api, mux_gereed, nuwe_bate_instellings } = require("./_mux");

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
  const skakel = String(invoer.skakel || "").trim();
  if (!slug || !(await kry_store("talks").get(slug, { type: "json" }))) {
    return { statusCode: 404, body: "Stoor die talk eers voordat jy 'n video byvoeg" };
  }
  if (!/^https:\/\/\S+$/i.test(skakel)) {
    return { statusCode: 400, body: "Die skakel moet met https:// begin" };
  }
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(skakel)) {
    return { statusCode: 400, body: "Dit is 'n webblad, nie 'n videolêer nie. Vra die spreker vir 'n direkte aflaaiskakel (bv. WeTransfer of Dropbox)." };
  }

  let bate;
  try {
    bate = await mux_api("POST", "/video/v1/assets", {
      inputs: [{ url: skakel }],
      ...nuwe_bate_instellings(slug),
    });
  } catch (fout) {
    return { statusCode: 400, body: `Mux kon nie die skakel aanvaar nie: ${fout.message}` };
  }

  const store = kry_store("talk-video");
  const vorige = (await store.get(slug, { type: "json" })) || {};
  await store.setJSON(slug, {
    slug,
    stand: "verwerk",
    upload_id: null,
    asset_id: bate.id,
    playback_id: null,
    duur_sekondes: null,
    speel_asset_id: vorige.stand === "gereed" ? vorige.asset_id : vorige.speel_asset_id || null,
    speel_playback_id: vorige.stand === "gereed" ? vorige.playback_id : vorige.speel_playback_id || null,
    begin_op: new Date().toISOString(),
    begin_deur: gebruiker.email,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stand: "verwerk" }),
  };
};
