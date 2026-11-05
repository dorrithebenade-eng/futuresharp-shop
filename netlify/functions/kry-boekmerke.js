// netlify/functions/kry-boekmerke.js
//
// Koper-beskermd (ook personeel, vir die paneel-leser). Gee die aangemelde
// leser se eie boekmerke vir een e-boek terug (November 2026).
//
// Store "boekmerke", sleutel `${produk_slug}--${gebruiker.id}`, net soos die
// leesvordering. Elke boekmerk dra die weergawe en bladsytotaal van die PDF
// waarop dit gemerk is, sodat die leser dit na 'n opgedateerde PDF kan
// verskuif (bepaal_beginbladsy in leser.js).

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const produk_slug = event.queryStringParameters && event.queryStringParameters.produk_slug;
  if (!produk_slug) {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ontbrekende 'produk_slug'-parameter" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["koper", "personeel"]);
  if (!gebruiker) {
    return { statusCode: 401, body: JSON.stringify({ fout: "Meld eers aan" }) };
  }

  try {
    const rekord = await kry_store("boekmerke").get(`${produk_slug}--${gebruiker.id}`, { type: "json" });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ merke: (rekord && Array.isArray(rekord.merke)) ? rekord.merke : [] }),
    };
  } catch (fout) {
    console.error("kry-boekmerke fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie boekmerke laai nie" }) };
  }
};
