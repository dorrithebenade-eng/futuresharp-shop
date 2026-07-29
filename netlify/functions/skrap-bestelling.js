// Personeel-beskermd — skrap 'n bestelling permanent uit die
// "bestellings"-store. Bedoel vir toets-bestellings wat die stelsel se
// werklike rekords/verslae/uitvoere onnodig oorheers — nie vir regte,
// betaalde bestellings nie (dit sou jou finansiële rekord vervals).

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

  const bestelnommer = (invoer.bestelnommer || "").trim();
  if (!bestelnommer) {
    return { statusCode: 400, body: "Verpligte veld: bestelnommer" };
  }

  const store = kry_store("bestellings");
  const bestaande = await store.get(bestelnommer, { type: "json" });
  if (!bestaande) {
    return { statusCode: 404, body: `Geen bestelling met nommer "${bestelnommer}" gevind nie` };
  }

  await store.delete(bestelnommer);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: bestelnommer }),
  };
};
