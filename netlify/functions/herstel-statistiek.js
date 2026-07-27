// Personeel-beskermd — herstel een gekose teller na 0. Vandag/week/maand
// herstel reeds outomaties (sien tel-besoek.js) — hierdie Function is
// primêr vir "totaal", wat nooit vanself herstel nie. Die ander drie kan
// tegnies ook hiermee herstel word indien ooit nodig.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const GELDIGE_TELLERS = ["totaal", "daagliks", "weekliks", "maandeliks"];

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

  const teller = (invoer.teller || "").trim();
  if (!GELDIGE_TELLERS.includes(teller)) {
    return { statusCode: 400, body: `Ongeldige teller — moet een van wees: ${GELDIGE_TELLERS.join(", ")}` };
  }

  const store = kry_store("statistieke");

  if (teller === "totaal") {
    await store.setJSON("totaal", { telling: 0 });
  } else {
    await store.setJSON(teller, { sleutel: null, telling: 0 });
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ herstel: teller }),
  };
};
