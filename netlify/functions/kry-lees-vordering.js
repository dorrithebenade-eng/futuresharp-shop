// Koper-beskermd — gee die koper se gestoorde leesposisie (bladsynommer)
// vir 'n spesifieke e-boek terug, indien enige. Word deur leser.js
// aangeroep wanneer 'n boek oopgemaak word, sodat ons outomaties na
// waar hulle laas was kan spring (soos Kindle se "Sync to furthest
// page read").

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

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: JSON.stringify({ fout: "Meld eers aan" }) };
  }

  try {
    const store = kry_store("lees-vordering");
    const rekord = await store.get(`${produk_slug}--${gebruiker.id}`, { type: "json" });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bladsy: rekord ? rekord.bladsy : null }),
    };
  } catch (fout) {
    console.error("kry-lees-vordering fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie leesvordering laai nie" }) };
  }
};
