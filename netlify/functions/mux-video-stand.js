// Personeel-beskermd — die stand van 'n talk se video. FutureSharp Talks.
//
//   GET ?slug=<slug>
//
// Lees die "talk-video"-store en, solank die video nog nie gereed is nie,
// vra Mux self hoe dit gaan: eers die oplaai (het die lêer aangekom en
// watter bate is geskep?), dan die bate (is dit klaar verwerk?). Die
// paneelbord roep dit elke paar sekondes tot die video gereed is. So is
// daar geen Mux-webhook nodig nie.
//
// Wanneer die nuwe video gereed is, word die ou een (as daar een was) by
// Mux geskrap. Dit hou die biblioteek skoon; op Mux se gratis plan is daar
// plek vir tien video's.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { mux_api, mux_gereed, skrap_mux_bate } = require("./_mux");

function publiek(rekord) {
  if (!rekord) return { stand: "geen" };
  const { upload_id, begin_deur, ...res } = rekord;
  return res;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  const slug = String((event.queryStringParameters || {}).slug || "").trim().toLowerCase();
  if (!slug) return { statusCode: 400, body: "Verpligte veld: slug" };

  const store = kry_store("talk-video");
  let rekord = await store.get(slug, { type: "json" });
  const antwoord = (r) => ({
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(publiek(r)),
  });

  if (!rekord || rekord.stand === "gereed" || rekord.stand === "fout" || !mux_gereed()) {
    return antwoord(rekord);
  }

  try {
    // 1. Die oplaai: het die lêer aangekom?
    if (!rekord.asset_id && rekord.upload_id) {
      const oplaai = await mux_api("GET", `/video/v1/uploads/${encodeURIComponent(rekord.upload_id)}`);
      if (oplaai.asset_id) {
        rekord = { ...rekord, asset_id: oplaai.asset_id, stand: "verwerk" };
      } else if (["errored", "cancelled", "timed_out"].includes(oplaai.status)) {
        rekord = { ...rekord, stand: "fout", fout: `Die oplaai het nie voltooi nie (${oplaai.status}). Probeer weer.` };
      }
    }

    // 2. Die bate: is dit klaar verwerk?
    if (rekord.asset_id && rekord.stand !== "fout") {
      const bate = await mux_api("GET", `/video/v1/assets/${encodeURIComponent(rekord.asset_id)}`);
      if (bate.status === "ready") {
        const speel = (bate.playback_ids || []).find((p) => p.policy === "signed");
        rekord = {
          ...rekord,
          stand: "gereed",
          playback_id: speel ? speel.id : null,
          duur_sekondes: Math.round(bate.duration || 0),
          resolusie: bate.resolution_tier || null,
          gereed_op: new Date().toISOString(),
        };
        // Die ou video mag nou weg.
        if (rekord.speel_asset_id && rekord.speel_asset_id !== rekord.asset_id) {
          await skrap_mux_bate(rekord.speel_asset_id);
        }
        rekord.speel_asset_id = null;
        rekord.speel_playback_id = null;
      } else if (bate.status === "errored") {
        const rede = (bate.errors && (bate.errors.messages || []).join("; ")) || "onbekend";
        rekord = { ...rekord, stand: "fout", fout: `Mux kon nie die video verwerk nie: ${rede}` };
      }
    }
  } catch (fout) {
    // Mux onbereikbaar: gee die laaste bekende stand terug; die paneel vra weer.
    console.error(`Video-stand vir ${slug}:`, fout.message);
    return antwoord(rekord);
  }

  await store.setJSON(slug, rekord);
  return antwoord(rekord);
};
