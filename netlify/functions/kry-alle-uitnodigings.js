// Personeel-beskermd — lys alle uitnodigings (hangend + voltooi), nuutste
// eerste, sodat personeel 'n rekord het van wie uitgenooi is en of hulle
// reeds gereageer het.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  const store = kry_store("uitnodigings");
  const { blobs } = await store.list();

  const uitnodigings = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }))
  );

  uitnodigings.sort((a, b) => new Date(b.geskep_op) - new Date(a.geskep_op));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uitnodigings }),
  };
};
