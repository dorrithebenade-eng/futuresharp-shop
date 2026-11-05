// netlify/functions/kry-uitligte.js
//
// Koper-beskermd (ook personeel, vir die paneel-leser). Gee die aangemelde
// leser se eie uitligte vir een e-boek terug (November 2026).
//
// Store "uitligte", sleutel `${produk_slug}--${gebruiker.id}`. Sien
// stoor-uitlig.js vir die vorm van 'n uitlig.

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
    const rekord = await kry_store("uitligte").get(`${produk_slug}--${gebruiker.id}`, { type: "json" });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ uitligte: (rekord && Array.isArray(rekord.uitligte)) ? rekord.uitligte : [] }),
    };
  } catch (fout) {
    console.error("kry-uitligte fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie uitligte laai nie" }) };
  }
};
