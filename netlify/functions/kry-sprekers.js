// Personeel-beskermd — lys alle sprekers uit die "sprekers"-store. Word deur
// die paneelbord gebruik om die spreker-lys te wys, en later (Fase 2) om die
// verdeling-aftrekkieslyste op 'n talk se formaat te vul met spreker-name
// i.p.v. rou ACCT_-kodes.
//
// FutureSharp Talks: gekloon uit kry-outeurs.js. Die sprekers-register is
// die sesde register, op presies dieselfde patroon as die ander vyf.

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

  const store = kry_store("sprekers");
  const { blobs } = await store.list();

  const sprekers = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }))
  );

  // Alfabeties sorteer volgens naam — maak die aftrekkieslyste voorspelbaar
  const gesorteer = sprekers.filter(Boolean).sort((a, b) => a.naam.localeCompare(b.naam, "af"));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sprekers: gesorteer }),
  };
};
