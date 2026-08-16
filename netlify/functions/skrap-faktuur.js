// netlify/functions/skrap-faktuur.js
//
// Vee 'n faktuur uit. Rol: boekhouding.
//
// TWEE DINGE MAG UITGEVEE WORD, EN NIKS ANDERS NIE:
//
//   1. 'N KONSEP, ALTYD. Hy het nog geen nommer, dus laat hy geen gaping in
//      die reeks nie, en niemand buite die paneel het hom ooit gesien nie.
//      Dieselfde reël as die outeur wat sy eie konsep-indiening mag skrap.
//
//   2. 'N REKORD MET DIE TOETSSTEMPEL. Sien is_toetsfase() in _fakture.js:
//      terwyl TOETSFASE aan is, kry elke nuwe faktuur `toets: true`, en dit
//      verander daarna nooit. Verwyder 'n mens die veranderlike, dra nuwe
//      fakture geen stempel en is hulle permanent.
//
// EN DAAR IS GEEN DERDE PAD NIE. Geen `dwing`-vlag, geen omweg, geen
// bevestigingswoord wat 'n mens kan intik. Dit is doelbewus: die afwesigheid
// van daardie pad is presies wat moet oorbly wanneer die toetsfase verby is.
// 'n Uitgereikte faktuur word GEKANSELLEER, nooit uitgevee nie — die punt van
// 'n deurlopende nommerreeks is dat 'n gaping sigbaar is.
//
// WAT DIT NIE RAAK NIE: die transaksie en die split by Paystack. Dié bly
// staan waar hulle is. Ons rekord verdwyn; hulle s'n nie.
//
// DIE KLIËNT BLY. 'n Faktuur skrap maak die kliënt nie skrapbaar deur homself
// nie — dit maak hom net skrapbaar. Die volgorde is faktuur eerste, dan die
// kliënt, en dit is die volgorde waarin toetsdata opgeruim word.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fakture_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
} = require("./_fakture");

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

  const sleutel = String(invoer.sleutel || "").trim();

  // Twee geldige vorme, want 'n faktuur het twee identiteite in sy lewe: 'n
  // konsep-sleutel voor uitreiking, en FS-01957 daarna. Enigiets anders is nie
  // een van ons sleutels nie en word nie eers gevra nie.
  if (!sleutel || (!is_konsep_sleutel(sleutel) && !sleutel_na_nommer(sleutel))) {
    return { statusCode: 400, body: "Ongeldige sleutel" };
  }

  const store = kry_fakture_store();

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };

  const mag =
    rekord.stand === "konsep" || rekord.toets === true;

  if (!mag) {
    return {
      statusCode: 409,
      body: "Hierdie faktuur is uitgereik en dra nie die toetsstempel nie. Kanselleer hom eerder — 'n gaping in die nommerreeks is hoe 'n mens sien dat niks verdwyn het nie.",
    };
  }

  try {
    await store.delete(sleutel);
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} skrap nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur skrap nie" };
  }

  // Aangeteken, want dit is die een handeling waarvan die rekord self niks
  // meer kan sê nie: hy is weg.
  console.log(
    `Faktuur ${sleutel} geskrap deur ${(gebruiker && gebruiker.email) || "onbekend"}` +
      ` — stand ${rekord.stand}, toets ${rekord.toets === true}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: sleutel }),
  };
};
