// Personeel-beskermd — lys alle vennote uit die "vennote"-store. Word deur
// die paneelbord gebruik om die vennote-lys te wys, en om die
// verdeling-aftrekkieslyste (op elke boek se e-boek/harde-kopie-formaat)
// te vul met vennoot-name i.p.v. rou ACCT_-kodes.

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

  const store = kry_store("vennote");
  const { blobs } = await store.list();

  const vennote = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }))
  );

  // Alfabeties sorteer volgens naam — maak die aftrekkieslyste voorspelbaar
  const gesorteer = vennote.filter(Boolean).sort((a, b) => a.naam.localeCompare(b.naam, "af"));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vennote: gesorteer }),
  };
};
