// Personeel-beskermd: lys die register van fisiese items (sien
// _fisiese-items.js).

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_alle_items } = require("./_fisiese-items");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }
  try {
    const items = await kry_alle_items();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    };
  } catch (fout) {
    console.error("Kon nie fisiese items laai nie:", fout);
    return { statusCode: 500, body: "Kon nie fisiese items laai nie" };
  }
};
