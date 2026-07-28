// Personeel-beskermd — skrap 'n kategorie. Blokkeer NIE skrapping as dit
// reeds op boeke gebruik word nie — die paneelbord wys 'n waarskuwing
// vooraf (soos die ander registers) en laat personeel self besluit.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const kategorie_id = (invoer.kategorie_id || "").trim();
  if (!kategorie_id) {
    return { statusCode: 400, body: "Verpligte veld: kategorie_id" };
  }

  const store = kry_store("kategoriee");
  const bestaande = await store.get(kategorie_id, { type: "json" });
  if (!bestaande) {
    return { statusCode: 404, body: `Geen kategorie met ID "${kategorie_id}" gevind nie` };
  }

  await store.delete(kategorie_id);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: kategorie_id }),
  };
};
