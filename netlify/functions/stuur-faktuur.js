// netlify/functions/stuur-faktuur.js
//
// Reik 'n faktuur uit. Rol: boekhouding.
//
// HY IS DIE POORT, NIE DIE UITREIKING NIE. Sedert 27 Augustus 2026 leef die
// uitreiking self in _faktuur-uitreik.js, want die kwotasie het 'n tweede
// ingang nodig gehad: 'n kliënt wat op die publieke bladsy aanvaar, kan nie
// die boekhouding-rol dra nie.
//
// Wat HIER bly, is die bewys en niks anders nie:
//
//   * die metode
//   * die boekhouding-rol
//   * 'n geldige konsep-sleutel
//   * die rekord bestaan en staan op "konsep"
//
// Alles daarna -- die keerings, die begunstigdes, die som, die vries, die
// nommer, Paystack, die skryf en die pos -- gebeur in die module, en
// aanvaar-kwotasie.js roep presies dieselfde funksie aan.
//
// DIE BEWYS MAG NOOIT NA DIE MODULE SKUIF NIE. Sou hy daar woon, kon 'n derde
// ingang hom omseil deur 'n vlag deur te gee. Elke ingang doen sy eie
// kontrole, en die module vertrou dat dit gebeur het.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store, is_konsep_sleutel } = require("./_fakture");
const { reik_faktuur_uit } = require("./_faktuur-uitreik");

function teks(waarde) {
  return String(waarde == null ? "" : waarde).trim();
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const sleutel = teks(invoer.sleutel);
  if (!sleutel || !is_konsep_sleutel(sleutel)) {
    return { statusCode: 400, body: "Ongeldige konsep-sleutel" };
  }

  const store = kry_fakture_store();
  const wie = (gebruiker && gebruiker.email) || "";

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };
  if (rekord.stand !== "konsep") {
    return { statusCode: 409, body: "Hierdie faktuur is reeds uitgereik." };
  }

  // Alles hierna leef in _faktuur-uitreik.js. Die module gee 'n gewone
  // HTTP-antwoord terug en ons gee dit deur -- die foutkodes is dus dieselfde
  // ongeag watter ingang gebruik is.
  return await reik_faktuur_uit(store, sleutel, rekord, wie);
};
