// Personeel-beskermd: stoor die hele lys afdelings vir die Boeke-bladsy.
// Sien _afdelings.js. Die paneel stuur altyd die volledige lys.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { skryf_afdelings, skryf_band } = require("./_afdelings");

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
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  // Die tuisblad se band kan apart gestoor word ({ band } sonder afdelings).
  if (!Array.isArray(invoer.afdelings) && !invoer.band) {
    return { statusCode: 400, body: "Verpligte veld: afdelings (lys) of band" };
  }
  const uit = {};
  if (Array.isArray(invoer.afdelings)) uit.afdelings = await skryf_afdelings(invoer.afdelings);
  if (invoer.band) uit.band = await skryf_band(invoer.band);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(uit),
  };
};
