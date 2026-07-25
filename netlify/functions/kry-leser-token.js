// Koper-beskermd — reik 'n kort-leeftyd, eenmalige "leestoken" uit vir
// een spesifieke boek. NODIG omdat leser.html se <iframe> (vir die
// blaaier se ingeboude PDF-bekyker) geen Authorization-kopstuk kan
// stuur nie — 'n iframe se src is net 'n gewone GET-URL. Ons los dit op
// deur eers HIER (met 'n normale, geverifieerde fetch-versoek met
// Bearer-token) 'n kort token te kry, en dié dan as "?token="
// URL-parameter in die iframe se src te gebruik.
//
// Die token is 15 minute geldig en net vir hierdie een produk_slug +
// hierdie een koper bruikbaar — dit gee nie algemene toegang nie.

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const GELDIGHEID_MS = 15 * 60 * 1000; // 15 minute

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const produk_slug = event.queryStringParameters && event.queryStringParameters.produk_slug;
  if (!produk_slug) {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ontbrekende 'produk_slug'-parameter" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: JSON.stringify({ fout: "Meld eers aan" }) };
  }

  const token = crypto.randomBytes(24).toString("hex");
  const verval_op = Date.now() + GELDIGHEID_MS;

  try {
    const store = kry_store("leestokens");
    await store.setJSON(token, {
      gebruiker_id: gebruiker.id,
      gebruiker_epos: gebruiker.email,
      produk_slug,
      verval_op,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, verval_op }),
    };
  } catch (fout) {
    console.error("Kon nie leestoken skep nie:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie leestoken skep nie" }) };
  }
};
