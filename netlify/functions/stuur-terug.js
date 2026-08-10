// netlify/functions/stuur-terug.js
//
// Stuur 'n indiening terug na die outeur, met 'n opmerking.
//
// DAAR IS GEEN AFKEUR NIE. 'n Afkeur eindig 'n gesprek; 'n opmerking hou
// hom aan die gang, en die geskiedenis wys later hoe die boek by sy finale
// vorm uitgekom het. Kan iets werklik nie, staan dit in die opmerking en
// die outeur skrap sy eie konsep.
//
// DIE OPMERKING IS VERPLIG. 'n Vorm wat sonder rede terugkom, laat die
// outeur raai, en dan kom hy terug met dieselfde vorm.
//
// SPIEËLBEELD VAN keur-goed.js:
//   ingedien → konsep    hy werk verder aan sy vorm
//   wysiging → op_rak    die boek bly op die rak, die voorstel bly hangend
//
// DIE LÊERS BLY STAAN, en die hangende voorstel ook. Hy maak een ding reg;
// hy begin nie oor nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_indienings_store, voeg_geskiedenis_by } = require("./_indienings");
const { stuur_terugstuur_kennisgewing } = require("./_kennisgewing-indiening");

const MAKS_OPMERKING = 4000;

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

  const opmerking = String(versoek.opmerking || "").trim().slice(0, MAKS_OPMERKING);
  if (!opmerking) {
    return { statusCode: 400, body: "'n Opmerking is verplig — die outeur moet weet wat om reg te maak" };
  }

  const store = kry_indienings_store();

  let rekord;
  try {
    rekord = await store.get(versoek.nommer, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die vorm terugstuur nie" };
  }

  if (!rekord) {
    return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
  }
  if (rekord.stand !== "ingedien" && rekord.stand !== "wysiging") {
    return { statusCode: 409, body: "Slegs 'n ingediende vorm kan teruggestuur word" };
  }

  const nou = new Date().toISOString();
  rekord.stand = rekord.stand === "wysiging" ? "op_rak" : "konsep";
  rekord.opmerking = opmerking;
  rekord.ingedien_op = null;
  rekord.gewysig_op = nou;

  voeg_geskiedenis_by(rekord, "teruggestuur met 'n opmerking", gebruiker.email || "", opmerking);

  try {
    await store.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    console.error("Kon nie die terugstuur stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die vorm terugstuur nie" };
  }

  // NÁ die stoor, en nooit voor. Die handeling is klaar; die pos is 'n
  // gunsie bo-op. stuur_terugstuur_kennisgewing() gooi nie en gee { gestuur,
  // rede } terug, sodat 'n stukkende posbediener nie 'n terugstuur wat
  // reeds gestoor is, as 'n 500 laat lyk nie.
  const pos = await stuur_terugstuur_kennisgewing(rekord, opmerking);
  if (!pos.gestuur) {
    console.warn(`Terugstuur-pos vir ${rekord.nommer} nie gestuur nie: ${pos.rede}`);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    // `pos_gestuur` sodat die paneelbord later kan sê of die outeur ingelig
    // is. Die skerm gebruik dit nog nie; die veld kos niks en die inligting
    // is andersins net in die logs.
    body: JSON.stringify({ nommer: rekord.nommer, stand: rekord.stand, pos_gestuur: pos.gestuur }),
  };
};
