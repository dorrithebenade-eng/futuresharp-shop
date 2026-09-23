// Personeel-beskermd — lys alle talks uit die "talks"-store, nuutste eerste.
// FutureSharp Talks. Die publieke lys vir die FST-blad kom in Fase 3 en sal
// net aktiewe talks wys.

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

  const store = kry_store("talks");
  const { blobs } = await store.list();
  const talks = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }))))
    .filter(Boolean)
    .sort((a, b) => String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ talks }),
  };
};
