// netlify/functions/skrap-begunstigde-indiening.js
//
// Boekhouding-beskermd - vee 'n wagkamer-indiening weg sonder om 'n
// begunstigde te skep.
//
// DRIE GEVALLE: rommel, 'n duplikaat wat niks nuuts dra nie, of iemand wat
// besluit het hy word met die hand betaal en nooit 'n subrekening kry nie.
//
// DIT RAAK NOOIT DIE REGISTER NIE. Hierdie Function kan net binne die
// wagkamer skrap - die IN--voorvoegsel word afgedwing, sodat 'n verkeerde
// sleutel nie 'n begunstigde of die koersteller kan tref nie.
//
// GEEN HERSTELPAD NIE. Die indiening is weg, en die persoon dien weer in.
// Dieselfde beginsel as die registers, wat met die CLI skoongemaak word.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const ROLLE = ["boekhouding"];
const WAGKAMER = "begunstigde-indienings";

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie - boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const sleutel = String(invoer.sleutel || "").trim();
  if (!sleutel || sleutel.indexOf("IN-") !== 0) {
    return { statusCode: 400, body: "Verpligte veld: sleutel" };
  }

  try {
    await kry_store(WAGKAMER).delete(sleutel);
  } catch (fout) {
    console.error("Kon nie die indiening skrap nie:", fout);
    return { statusCode: 500, body: "Kon nie die indiening skrap nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
