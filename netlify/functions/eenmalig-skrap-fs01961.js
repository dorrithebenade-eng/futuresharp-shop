// netlify/functions/eenmalig-skrap-fs01961.js
//
// TYDELIK. HIERDIE LÊER WORD DIESELFDE DAG WEER VERWYDER.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM HY BESTAAN
//
// FS/01961 is die eerste faktuur wat ooit uitgereik is, en hy is toetsdata --
// 'n opgemaakte kliënt, opgemaakte bedrae, uitgereik om die ketting te toets.
// Hy is egter geskep VOORDAT die bou wat TOETSFASE=aan in werking gestel het,
// deur was, en dra dus geen toetsstempel nie.
//
// skrap-faktuur.js laat presies twee dinge toe: 'n konsep, of 'n rekord met
// die stempel. Dit is doelbewus, en dit bly so -- die afwesigheid van 'n derde
// pad is presies wat moet oorbly wanneer die toetsfase verby is. Hierdie lêer
// maak nie daardie pad oop nie; hy loop langs hom, een keer, en gaan dan weg.
//
// ─────────────────────────────────────────────────────────────────────────
// DRIE SLOTTE
//
//   1. DIE SLEUTEL IS HIER VASGESKRYF. Hy neem geen sleutel uit die versoek
//      nie. Bly hierdie lêer per ongeluk staan, kan hy NIKS anders uitvee as
//      FS-01961 nie -- en daardie rekord bestaan dan reeds nie meer nie.
//   2. DIE ROL BLY GELD. Sonder `boekhouding` gebeur niks.
//   3. 'N WAGWOORD IN DIE LIGGAAM. Nie sekuriteit nie -- die rol is die
//      sekuriteit -- maar 'n tweede handeling, sodat 'n oproep nie per ongeluk
//      kan gebeur nie.
//
// ─────────────────────────────────────────────────────────────────────────
// WAT DIT NIE RAAK NIE
//
// Die transaksie en die split by Paystack bly staan waar hulle is. Ons rekord
// verdwyn; hulle s'n nie. Dieselfde voorbehoud as by skrap-faktuur.js.
//
// DIE NOMMERREEKS SPRING TERUG. FS/01961 en FS/01962 raak albei weg, en die
// volgende uitreiking word weer FS/01961 -- skep_nommer() lees die hoogste
// bestaande sleutel. Dit is die punt van hierdie oefening.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store } = require("./_fakture");

// Die enigste rekord wat hierdie lêer ooit kan raak.
const SLEUTEL = "FS-01961";
const WAGWOORD = "skrap-die-eerste-toetsfaktuur";

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
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  if (invoer.bevestig !== WAGWOORD) {
    return { statusCode: 400, body: "Geen bevestiging nie" };
  }

  const store = kry_fakture_store();

  let rekord;
  try {
    rekord = await store.get(SLEUTEL, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie ${SLEUTEL} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) {
    return { statusCode: 404, body: `${SLEUTEL} bestaan nie` };
  }

  // Die rekord word GELOG voordat hy weggaan. Dit is die een handeling
  // waarvan die rekord self niks meer kan sê nie.
  console.log(
    `EENMALIG: ${SLEUTEL} word geskrap deur ${(gebruiker && gebruiker.email) || "onbekend"}` +
      ` — stand ${rekord.stand}, totaal ${rekord.totaal_sent}, klient ${
        (rekord.klient && rekord.klient.naam) || ""
      }`
  );

  try {
    await store.delete(SLEUTEL);
  } catch (fout) {
    console.error(`Kon nie ${SLEUTEL} skrap nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur skrap nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      geskrap: SLEUTEL,
      stand: rekord.stand,
      totaal_sent: rekord.totaal_sent,
    }),
  };
};
