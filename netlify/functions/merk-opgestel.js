// netlify/functions/merk-opgestel.js
//
// Die laaste skakel: 'n goedgekeurde indiening wat 'n boek geword het.
//
// WAT HIER GEBEUR: die stand skuif van `goedgekeur` na `op_rak` en die
// produk se slug word op die rekord geskryf. Meer nie.
//
// WAAROM DIT 'N EIE FUNCTION IS: `keur-goed.js` berei voor, die produkvorm
// publiseer, en niks het tot dusver die twee aan mekaar geknoop nie. Sonder
// hierdie stap bly 'n boek vir altyd as "wag om opgestel te word" gelys
// terwyl hy reeds in die winkel staan.
//
// DIE PRODUK WORD NAGEGAAN. Die kliënt se sein is dat die produkvorm
// toegegaan het, en 'n vorm gaan ook toe wanneer iemand kanselleer. Ons
// glo dus nie die sein nie — die katalogus moet werklik 'n rekord met
// hierdie slug hê. 'n Verkeerde sein doen dan niks.
//
// ROL: personeel. 'n Outeur raak nooit die winkel nie, en hierdie handeling
// sê presies dat 'n boek in die winkel is.
//
// TWEE PAAIE, EEN FUNCTION. Die eerste is hierbo: `goedgekeur → op_rak`,
// 'n nuwe boek. Die tweede is 'n goedgekeurde WYSIGING aan 'n boek wat
// reeds op die rak staan — daar skuif niks nie, want die stand is klaar
// `op_rak`. Wat dan gebeur, is dat `bywerking_wagtend` afgehaal word, en
// die Werk by-knoppie verdwyn.
//
// Dieselfde kontrole geld vir albei: die katalogus moet werklik 'n rekord
// met hierdie slug hê. 'n Vorm wat gekanselleer is, mag niks merk nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_indienings_store, voeg_geskiedenis_by } = require("./_indienings");

function nommer_is_geldig(nommer) {
  return /^BV-\d{4}-\d{4}$/.test(String(nommer || ""));
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let versoek;
  try {
    versoek = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  if (!nommer_is_geldig(versoek.nommer)) {
    return { statusCode: 400, body: "Ongeldige vormnommer" };
  }

  const slug = String(versoek.slug || "").trim();
  if (!slug) {
    return { statusCode: 400, body: "Geen slug nie" };
  }

  const indienings = kry_indienings_store();

  let rekord;
  try {
    rekord = await indienings.get(versoek.nommer, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die indiening lees nie" };
  }

  if (!rekord) {
    return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
  }
  // Pad een: 'n nuwe boek. Pad twee: 'n goedgekeurde wysiging aan 'n boek
  // wat reeds op die rak staan.
  const is_bywerking = rekord.stand === "op_rak" && Boolean(rekord.bywerking_wagtend);

  if (rekord.stand !== "goedgekeur" && !is_bywerking) {
    return { statusCode: 409, body: "Hierdie vorm wag nie om opgestel of bygewerk te word nie" };
  }

  // Die produk moet werklik bestaan. Sien die nota bo-aan: die kliënt se
  // sein is nie 'n bewys nie.
  let produk;
  try {
    produk = await kry_store("katalogus").get(slug, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die katalogus lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die katalogus lees nie" };
  }

  if (!produk) {
    return { statusCode: 409, body: "Daar is nog geen boek met hierdie slug in die katalogus nie" };
  }

  const nou = new Date().toISOString();

  rekord.stand = "op_rak";
  rekord.produk_id = slug;
  rekord.bywerking_wagtend = false;
  rekord.gewysig_op = nou;

  voeg_geskiedenis_by(
    rekord,
    is_bywerking ? "wysiging in die katalogus bygewerk" : "opgestel in die katalogus",
    gebruiker.email || "",
    slug
  );

  try {
    await indienings.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    console.error("Kon nie die stand stoor nie:", fout);
    return { statusCode: 500, body: "Die boek is geskep maar die stand kon nie stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nommer: rekord.nommer,
      stand: rekord.stand,
      produk_id: slug,
      bywerking_wagtend: false,
    }),
  };
};
