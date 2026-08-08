// netlify/functions/dien-in.js
//
// Die outeur dien sy vorm in. Dit is die enigste plek waar die stand van
// `konsep` na `ingedien` skuif — en van `op_rak` na `wysiging`.
//
// TWEE VERTREKPUNTE, EEN HANDELING:
//   konsep  → ingedien   'n nuwe titel wag vir prosessering
//   op_rak  → wysiging   'n boek op die rak, met 'n hangende voorstel
//
// Die boek op die rak BLY onaangeraak. Sy lewendige waardes staan in
// `data`; wat hy voorstel, staan in `hangend`. Eers by goedkeuring word
// die een die ander.
//
// WAT AFGEDWING WORD: die drie bevestigings, albei lêers, en 'n titel.
// Niks meer nie. Of die beskrywing goed genoeg is en of die prys sin maak,
// is 'n oordeel wat 'n mens vel — daarvoor is die goedkeuringskerm, en
// daarvoor is 'n opmerking wat die vorm terugstuur. 'n Vorm wat 'n outeur
// nie kan indien nie omdat 'n bediener oor sy sinne stry, help niemand nie.
//
// DIT MOET OP DIE BEDIENER STAAN, nie net in die knoppie nie. Die UI keer
// hom, maar die UI is die blaaier s'n.
//
// ROL: "koper". 'n Outeur is in Identity se oë 'n gewone koper; die grens
// is dat die vorm aan hom moet behoort.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_outeur } = require("./_my-outeur");
const { kry_indienings_store, voeg_geskiedenis_by, is_myne } = require("./_indienings");

function nommer_is_geldig(nommer) {
  return /^BV-\d{4}-\d{4}$/.test(String(nommer || ""));
}

// Wat kort nog? Die antwoord gaan terug na die outeur, so dit moet sê wat
// hy moet DOEN, nie wat die bediener afgekeur het nie.
function wat_kort(inhoud, leers) {
  const kort = [];
  const bev = (inhoud && inhoud.bevestigings) || {};

  if (!String((inhoud && inhoud.titel) || "").trim()) {
    kort.push("titel");
  }
  if (!leers || !leers.manuskrip) {
    kort.push("manuskrip");
  }
  if (!leers || !leers.omslag) {
    kort.push("omslag");
  }
  if (!bev.skepper || !bev.kopiereg || !bev.korrek) {
    kort.push("bevestigings");
  }

  return kort;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  const outeur = await kry_my_outeur(gebruiker);
  if (!outeur) {
    return { statusCode: 403, body: "Hierdie rekening is nie as 'n outeur geregistreer nie" };
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

  const store = kry_indienings_store();

  let rekord;
  try {
    rekord = await store.get(versoek.nommer, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die vorm indien nie" };
  }

  if (!rekord) {
    return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
  }
  if (!is_myne(rekord, outeur)) {
    return { statusCode: 403, body: "Hierdie vorm behoort nie aan hierdie rekening nie" };
  }

  // Reeds ingedien. Nie 'n fout nie — twee klikke, of 'n knoppie wat
  // tweekeer gevuur het. Sê wat die stand is en gaan aan.
  if (rekord.stand === "ingedien" || rekord.stand === "wysiging") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nommer: rekord.nommer, stand: rekord.stand, reeds: true }),
    };
  }

  if (rekord.stand !== "konsep" && rekord.stand !== "op_rak") {
    return { statusCode: 409, body: "Hierdie vorm kan nie in sy huidige stand ingedien word nie" };
  }

  // Op die rak dien hy sy HANGENDE voorstel in; 'n konsep dien sy data in.
  const is_wysiging = rekord.stand === "op_rak";
  const inhoud = is_wysiging ? rekord.hangend : rekord.data;

  if (is_wysiging && !inhoud) {
    return { statusCode: 409, body: "Daar is niks om in te dien nie \u2014 niks is gewysig nie" };
  }

  const kort = wat_kort(inhoud, rekord.leers);
  if (kort.length) {
    return {
      statusCode: 422,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kort }),
    };
  }

  const nou = new Date().toISOString();
  rekord.stand = is_wysiging ? "wysiging" : "ingedien";
  rekord.ingedien_op = nou;
  rekord.gewysig_op = nou;
  // 'n Opmerking hoort by die rondte waarin dit gegee is. Dien hy weer in,
  // is dit hanteer — anders staan die ou opmerking bo sy nuwe vorm.
  rekord.opmerking = "";

  voeg_geskiedenis_by(
    rekord,
    is_wysiging ? "wysiging ingedien" : "ingedien",
    gebruiker.email || outeur.naam || "",
    ""
  );

  try {
    await store.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    console.error("Kon nie die indiening stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die vorm indien nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nommer: rekord.nommer, stand: rekord.stand, ingedien_op: nou }),
  };
};
