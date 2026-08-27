// netlify/functions/skrap-kwotasie.js
//
// Vee 'n kwotasie uit. Rol: boekhouding.
//
// TWEE DINGE MAG UITGEVEE WORD, EN NIKS ANDERS NIE:
//
//   1. 'N KONSEP, ALTYD. Hy het nog geen nommer, dus laat hy geen gaping in
//      die reeks nie, en niemand buite die paneel het hom ooit gesien nie.
//
//   2. 'N REKORD MET DIE TOETSSTEMPEL. Sien is_toetsfase() in _kwotasies.js.
//
// EN DAAR IS GEEN DERDE PAD NIE. Geen `dwing`-vlag, geen bevestigingswoord
// wat 'n mens kan intik. Die afwesigheid van daardie pad is presies wat moet
// oorbly wanneer die toetsfase verby is.
//
// 'N AANVAARDE KWOTASIE WORD NOOIT GESKRAP NIE, ook nie met die toetsstempel
// nie. Sy is die bewys van wat aanvaar is, en die faktuur wat daaruit gekom
// het, verwys na haar. Skrap 'n mens haar, dra daardie faktuur 'n
// `uit_kwotasie` wat na niks wys — en dan is die vraag "waarvoor is hierdie
// R25 072 gefaktureer?" onbeantwoordbaar.
//
// 'N VERWERPTE KWOTASIE MAG WEL WEG, want niks verwys na haar nie. Sy val
// onder reël 1 of 2 soos enige ander.
//
// DIE VERSKIL MET 'N FAKTUUR: 'n uitgereikte faktuur word GEKANSELLEER,
// nooit uitgevee nie, want die nommerreeks se gaping is die bewys. Dieselfde
// geld hier, en om dieselfde rede.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_kwotasies_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
} = require("./_kwotasies");

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

  // Twee geldige vorme, want 'n kwotasie het twee identiteite in sy lewe: 'n
  // konsep-sleutel voor uitreiking, en KW-01961 daarna. Albei toetse is DIE
  // KWOTASIE S'N, dus kan hierdie Function nooit 'n faktuur raak nie — ook
  // nie as iemand 'n FS-sleutel instuur nie.
  if (!sleutel || (!is_konsep_sleutel(sleutel) && !sleutel_na_nommer(sleutel))) {
    return { statusCode: 400, body: "Ongeldige sleutel" };
  }

  const store = kry_kwotasies_store();

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Kwotasie nie gevind nie" };

  // Die aanvaarde kwotasie word eerste getoets. Sy is die enigste geval waar
  // die toetsstempel NIE genoeg is nie: 'n faktuur verwys na haar, en daardie
  // faktuur kan permanent wees ook al was sy self toetsdata.
  if (rekord.stand === "aanvaar") {
    return {
      statusCode: 409,
      body: "Hierdie kwotasie is aanvaar en 'n faktuur verwys daarna. Sy bly staan as die rekord van wat aanvaar is.",
    };
  }

  const mag = rekord.stand === "konsep" || rekord.toets === true;

  if (!mag) {
    return {
      statusCode: 409,
      body: "Hierdie kwotasie is uitgereik en dra nie die toetsstempel nie. 'n Gaping in die nommerreeks is hoe 'n mens sien dat niks verdwyn het nie.",
    };
  }

  try {
    await store.delete(sleutel);
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} skrap nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie skrap nie" };
  }

  // Aangeteken, want dit is die een handeling waarvan die rekord self niks
  // meer kan sê nie: hy is weg.
  console.log(
    `Kwotasie ${sleutel} geskrap deur ${(gebruiker && gebruiker.email) || "onbekend"}` +
      ` — stand ${rekord.stand}, toets ${rekord.toets === true}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: sleutel }),
  };
};
