// netlify/functions/eenmalig-skrap-kw01961.js
//
// TYDELIK. HIERDIE LÊER WORD DIESELFDE DAG WEER VERWYDER.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM HY BESTAAN
//
// KW/01961 is toetsdata. Sy staan op `aanvaar`, en skrap-kwotasie.js weier
// 'n aanvaarde kwotasie UITDRUKLIK, ook een met die toetsstempel, omdat 'n
// faktuur na haar verwys en daardie faktuur permanent kan wees.
//
// Daardie rede val weg sodra FS/01961 uitgevee is: sy verwys dan na 'n
// faktuur wat nie meer bestaan nie, en dit is presies die toestand wat die
// weiering moes voorkom. Hierdie Function toets dit self, en weier as die
// faktuur nog daar is.
//
// Die reël in skrap-kwotasie.js bly onaangeraak. Sy is reg vir elke ander
// geval, en dit is die geval wat oorbly wanneer die toetsfase verby is.
//
// Dieselfde patroon as 4 September, toe FS/01961 en daarna KW/01961 en
// KW/01962 so uitgevee is (commits 4bd3520 en 4507444).
//
// ─────────────────────────────────────────────────────────────────────────
// VIER SLOTTE
//
//   1. DIE SLEUTEL IS HIER VASGESKRYF. Hy neem niks uit die versoek nie.
//      Bly hierdie lêer per ongeluk staan, kan hy NIKS anders raak nie, en
//      daardie rekord bestaan dan reeds nie meer nie.
//   2. DIE TOETSSTEMPEL MOET DAAR WEES. Sonder `toets: true` gebeur niks.
//   3. DIE FAKTUUR MOET WEG WEES. Bestaan FS-01961 nog, weier hy.
//   4. DIE ROL BLY GELD, plus 'n wagwoord in die liggaam, sodat 'n oproep
//      nie per ongeluk kan gebeur nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_kwotasies_store } = require("./_kwotasies");
const { kry_fakture_store } = require("./_fakture");

// Die enigste rekord wat hierdie lêer ooit kan raak.
const SLEUTEL = "KW-01961";
const FAKTUUR = "FS-01961";
const WAGWOORD = "skrap-kw01961";

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

  const store = kry_kwotasies_store();

  let rekord = null;
  try {
    rekord = await store.get(SLEUTEL, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie ${SLEUTEL} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie lees nie" };
  }

  if (!rekord) {
    return { statusCode: 404, body: `${SLEUTEL} bestaan nie` };
  }

  // Slot 2. Sonder die stempel is sy nie toetsdata nie en bly sy staan.
  if (rekord.toets !== true) {
    return { statusCode: 409, body: `${SLEUTEL} dra nie die toetsstempel nie` };
  }

  // Slot 3. Die hele redenasie hang hieraan: die faktuur moet weg wees.
  let faktuur = null;
  try {
    faktuur = await kry_fakture_store().get(FAKTUUR, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie ${FAKTUUR} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur lees nie" };
  }

  if (faktuur) {
    return {
      statusCode: 409,
      body: `${FAKTUUR} bestaan nog. Vee die faktuur eers met die Skrap-knoppie uit.`,
    };
  }

  // Die rekord word GELOG voordat hy weggaan. Dit is die een handeling
  // waarvan die rekord self niks meer kan sê nie: hy is weg.
  console.log(
    `EENMALIG: ${SLEUTEL} word geskrap deur ${(gebruiker && gebruiker.email) || "onbekend"}` +
      ` - stand ${rekord.stand}, faktuur ${rekord.faktuur_nommer || "geen"}, toets ${rekord.toets}`
  );

  try {
    await store.delete(SLEUTEL);
  } catch (fout) {
    console.error(`Kon nie ${SLEUTEL} skrap nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie skrap nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: SLEUTEL }),
  };
};
