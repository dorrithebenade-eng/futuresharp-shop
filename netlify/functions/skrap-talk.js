// Personeel-beskermd — skrap 'n talk permanent, saam met sy omslag.
// FutureSharp Talks.
//
// Om 'n talk net van die FST-blad af te haal, gebruik Deaktiveer (die
// aktief-veld via wysig-talk.js). Skrap is vir 'n talk wat nooit moes
// bestaan het nie.
//
// FASE 4 MOET HIER 'N KONTROLE BYVOEG: sodra talks gekoop kan word, hang 'n
// koper se toegang in My Teater van hierdie rekord af, en dan moet skrap
// geweier word wanneer daar 'n betaalde bestelling is, soos by
// verwyder-produk.js.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

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

  await store.delete(slug);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: slug, omslag_geskrap }),
  };
};
