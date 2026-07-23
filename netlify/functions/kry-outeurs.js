// Personeel-beskermd — lys alle outeurs uit die "outeurs"-store. Word deur
// die paneelbord gebruik om die outeur-lys te wys, en om die
// verdeling-aftrekkieslyste (op elke boek se e-boek/harde-kopie-formaat)
// te vul met outeur-name i.p.v. rou ACCT_-kodes.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  const store = kry_store("outeurs");
  const { blobs } = await store.list();

  const outeurs = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }))
  );

  // Alfabeties sorteer volgens naam — maak die aftrekkieslyste voorspelbaar
  const gesorteer = outeurs.filter(Boolean).sort((a, b) => a.naam.localeCompare(b.naam, "af"));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outeurs: gesorteer }),
  };
};
