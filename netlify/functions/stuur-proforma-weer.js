// netlify/functions/stuur-proforma-weer.js
//
// Stuur 'n uitgereikte faktuur se proforma-pos weer. Rol: boekhouding.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAAN
//
// stuur-faktuur.js werk slegs op 'n KONSEP: dit is die poort na die
// uitreiking, en 'n uitreiking gebeur een keer. Daar was dus geen manier om
// 'n faktuur se dokument weer te stuur nie.
//
// Dit is nie 'n randgeval nie. 'n Kliënt verloor sy pos, vra dat dit na 'n
// kollega gestuur word, of het 'n herinnering nodig voor die vervaldatum.
// Elke besigheid stuur 'n faktuur weer.
//
// Die onmiddellike aanleiding was 24 September 2026: FS/01962 en FS/01963 se
// e-posse het Paystack se ou adres gedra, wat verval het. Die dokument weer
// stuur is die professionele antwoord daarop -- die klient kry dieselfde
// faktuur, met 'n adres wat nie meer kan verval nie, en niks daaraan lees
// soos regmaakwerk nie.
// ─────────────────────────────────────────────────────────────────────────
//
// DIT REIK NIKS UIT NIE.
//
// Geen nuwe nommer, geen nuwe verdeling, geen nuwe Paystack-transaksie. Die
// bedrag en die verdeling bly gevries soos hulle by uitreiking was, want dit
// is presies wat 'n gevriesde verdeling beteken: die dokument wat die klient
// het, bly geld.
//
// Wat WEL nuut is, is die PDF, want hy word by elke pos gebou. Hy dra dus die
// betaalbladsy se adres in plaas van Paystack se ou een, en dit is die hele
// punt.
//
// DIT SKRYF NIKS BEHALWE DIE GESKIEDENIS NIE. Die pos self is die daad; die
// rekord hou net by dat dit gebeur het, en deur wie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fakture_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
  voeg_geskiedenis_by,
} = require("./_fakture");
const { stuur_proforma } = require("./_faktuur-uitreik");

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
  if (!sleutel || !sleutel_na_nommer(sleutel)) {
    return { statusCode: 400, body: "Ongeldige sleutel" };
  }
  if (is_konsep_sleutel(sleutel)) {
    return {
      statusCode: 400,
      body: "'n Konsep het nog geen proforma nie. Reik hom eers uit.",
    };
  }

  const store = kry_fakture_store();
  const nou = new Date().toISOString();
  const wie = (gebruiker && gebruiker.email) || "";

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };

  // ── Wanneer dit NIE mag loop nie ────────────────────────────────────────

  if (rekord.stand === "konsep") {
    return { statusCode: 409, body: "Hierdie faktuur is nog nie uitgereik nie." };
  }

  // GEKANSELLEER. 'n Dokument wat vra om betaal te word vir 'n faktuur wat
  // dood is, is erger as geen dokument.
  if (rekord.stand === "gekanselleer") {
    return {
      statusCode: 409,
      body: "Hierdie faktuur is gekanselleer. Reik 'n nuwe een uit.",
    };
  }

  // BETAAL. Wat 'n betaalde faktuur hoort te stuur, is 'n kwitansie, nie 'n
  // proforma wat vra om betaal te word nie. Dit bestaan nog nie, en 'n
  // proforma in sy plek sou die klient laat dink hy skuld nog geld.
  if (rekord.stand === "betaal") {
    return {
      statusCode: 409,
      body: "Hierdie faktuur is reeds betaal. 'n Proforma vra om betaling en sou die kliënt verwar.",
    };
  }

  const aan = teks(rekord.klient && rekord.klient.epos);
  if (!aan) {
    return {
      statusCode: 409,
      body: "Hierdie kliënt het geen e-posadres nie, en die proforma het dus nêrens om heen te gaan nie.",
    };
  }

  // ── Die pos ─────────────────────────────────────────────────────────────
  //
  // DIESELFDE FUNKSIE as by uitreiking, nie 'n kopie nie. Sou dit 'n kopie
  // wees, kry die klient mettertyd 'n ander dokument as die een wat hy
  // oorspronklik ontvang het, sonder dat iemand dit agterkom.
  //
  // `gratis` is vals: 'n R0-faktuur staan reeds op "betaal" en is hierbo
  // gekeer. Die laaste vlag is `herstuur`, wat een sin bo-aan die pos byvoeg.
  const pos = await stuur_proforma(rekord, sleutel, false, true);

  if (!pos.ok) {
    console.error(`Kon nie ${sleutel} se proforma weer stuur nie:`, pos.fout);
    return {
      statusCode: 502,
      body: `Die pos kon nie uitgaan nie: ${pos.fout || "onbekende fout"}.`,
    };
  }

  // ── Die geskiedenis ─────────────────────────────────────────────────────
  //
  // NA die pos, en 'n mislukte skryf keer nie die antwoord nie. Die klient het
  // sy dokument; dat ons dit nie aangeteken het nie, is hinderlik en nie 'n
  // rede om vir Dorrithe te se die pos het misluk nie.

  voeg_geskiedenis_by(rekord, "proforma weer gestuur", wie, aan);
  rekord.bygewerk_op = nou;

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error(`Kon nie ${sleutel} se geskiedenis skryf nie:`, fout);
  }

  const nommer = teks(rekord.nommer) || sleutel_na_nommer(sleutel);
  console.log(`Proforma vir ${nommer} weer gestuur aan ${aan} deur ${wie}`);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nommer, aan }),
  };
};
