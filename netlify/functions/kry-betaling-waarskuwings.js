// Personeel-beskermd — lys alle bestellings waar die betaling-splitsing
// misluk het en op die hoofrekening-vangnet teruggeval het (sien
// begin-betaling.js se split_fout-veld). Nuutste eerste.

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

  const store = kry_store("bestellings");
  const { blobs } = await store.list();

  const alle_bestellings = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));

  const waarskuwings = alle_bestellings
    .filter((b) => b && b.split_fout)
    .sort((a, b) => new Date(b.geskep_op) - new Date(a.geskep_op));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ waarskuwings }),
  };
};
