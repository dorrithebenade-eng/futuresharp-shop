// Personeel-beskermd — skrap 'n talk permanent, saam met sy omslag en video.
// FutureSharp Talks.
//
// Om 'n talk net van die FST-blad af te haal, gebruik Deaktiveer (die
// aktief-veld via wysig-talk.js). Skrap is vir 'n talk wat nooit moes
// bestaan het nie.
//
// Sodra 'n talk gekoop is ("talk-verkope"), word skrap geweier: die koper
// se Teater hang van hierdie rekord af.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { skrap_mux_bate } = require("./_mux");

// Die omslag se sleutel uit die pad wat laai-omslag-op.js teruggee:
// /.netlify/functions/kry-omslag?bestand=<sleutel>
function omslag_sleutel(pad) {
  const passing = /[?&]bestand=([^&]+)/.exec(String(pad || ""));
  return passing ? decodeURIComponent(passing[1]) : null;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const slug = String(invoer.slug || "").trim().toLowerCase();
  const store = kry_store("talks");
  const talk = slug ? await store.get(slug, { type: "json" }) : null;
  if (!talk) {
    return { statusCode: 404, body: `Geen talk met die slug "${slug}" nie` };
  }

  // Sodra iemand die talk gekoop het, hang sy Teater daarvan af: dan word
  // skrap geweier, en Deaktiveer is die weg om dit van die FST-blad af te haal.
  const verkope = await kry_store("talk-verkope").get(slug, { type: "json" });
  if (verkope && verkope.aantal > 0) {
    return {
      statusCode: 409,
      body: `Hierdie talk is al ${verkope.aantal} keer gekoop en kan nie geskrap word nie. Gebruik Deaktiveer om dit van die FST-blad af te haal.`,
    };
  }

  // Die omslag eerste, die rekord laaste: misluk die omslag, staan die
  // rekord nog en 'n mens kan weer probeer.
  const sleutel = omslag_sleutel(talk.omslag);
  let omslag_geskrap = false;
  if (sleutel) {
    try {
      await kry_store("omslae").delete(sleutel);
      omslag_geskrap = true;
    } catch (fout) {
      console.error(`Kon nie omslag ${sleutel} vir talk ${slug} skrap nie:`, fout);
    }
  }

  // Die video by Mux (Fase 4): die huidige, en 'n ou een wat nog sou speel.
  const video_store = kry_store("talk-video");
  const video = await video_store.get(slug, { type: "json" });
  let video_geskrap = false;
  if (video) {
    const eerste = await skrap_mux_bate(video.asset_id);
    const tweede = await skrap_mux_bate(video.speel_asset_id);
    video_geskrap = eerste && tweede;
    await video_store.delete(slug);
  }

  await store.delete(slug);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: slug, omslag_geskrap, video_geskrap }),
  };
};
