// Personeel-beskermd — merk 'n harde-kopie-bestelling se drukstatus
// (bestelling_geplaas by die druk-op-aanvraag-verskaffer, met 'n
// opsionele nota). Raak NIKS anders aan die bestelling nie.

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
  const bestelling = await store.get(bestelnommer, { type: "json" });
  if (!bestelling) {
    return { statusCode: 404, body: `Geen bestelling met nommer "${bestelnommer}" gevind nie` };
  }
  if (!bestelling.bevat_harde_kopie) {
    return { statusCode: 400, body: "Hierdie bestelling bevat geen harde kopie nie" };
  }

  const bygewerk = {
    ...bestelling,
    drukker: {
      bestelling_geplaas: !!invoer.bestelling_geplaas,
      geplaas_op: invoer.bestelling_geplaas ? new Date().toISOString() : null,
      nota: invoer.nota ? String(invoer.nota).trim().slice(0, 300) : "",
    },
    bygewerk_op: new Date().toISOString(),
  };

  await store.setJSON(bestelnommer, bygewerk);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bygewerk),
  };
};
