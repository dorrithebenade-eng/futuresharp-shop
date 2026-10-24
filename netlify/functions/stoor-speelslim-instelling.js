// netlify/functions/stoor-speelslim-instelling.js
//
// Wysig die Speel-Slim-prystabel. Rol: boekhouding.
//
// DRIE VELDE, ELK MET DIE HAND GELEES. Die prys van 'n hoofverslag, die prys
// per bykomende vraelys by 'n gesamentlike verslag, en die persentasie vir
// hosting. Niks gaan deur 'n spread nie.
//
// DIE REKORD IN DIE STORE WORD AANGEVUL, NIE VERVANG NIE. Ander velde wat
// daar mag staan (verdeling, kategorie_id, projek_id) bly soos hulle is.
//
// GELD NET VIR NUWE AANVRAE. 'n Kwotasie wat reeds uitgereik is, dra sy eie
// reëls en bedrae; hierdie instelling raak hom nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { INSTELLING_SLEUTEL, kry_instelling, los_ontvangers_op } = require("./_speelslim");

// R10 000 is ruim bo enige verslagprys; 'n hoër bedrag is byna seker 'n tikfout.
const MAKS_SENT = 1000000;
// Meer as die helfte vir hosting is nie 'n verdeling nie, dit is 'n tikfout.
const MAKS_HOSTING = 50;

function sent_uit(waarde) {
  const n = Number(waarde);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MAKS_SENT) return null;
  return n;
}

function pct_uit(waarde) {
  const n = Number(waarde);
  if (!Number.isFinite(n) || n < 0 || n > MAKS_HOSTING) return null;
  return Math.round(n * 100) / 100;
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

  const hoof_sent = sent_uit(invoer.hoof_sent);
  const ekstra_sent = sent_uit(invoer.ekstra_sent);
  const hosting_pct = pct_uit(invoer.hosting_pct);

  if (hoof_sent === null || hoof_sent === 0) {
    return { statusCode: 400, body: "Die prys van 'n verslag moet tussen R0,01 en R10 000 wees." };
  }
  if (ekstra_sent === null) {
    return { statusCode: 400, body: "Die prys per bykomende vraelys moet tussen R0 en R10 000 wees." };
  }
  if (hosting_pct === null) {
    return { statusCode: 400, body: `Hosting moet tussen 0% en ${MAKS_HOSTING}% wees.` };
  }

  const store = kry_store("instellings");
  let rekord = {};
  try {
    rekord = (await store.get(INSTELLING_SLEUTEL, { type: "json" })) || {};
  } catch (fout) {
    console.error("Speel-Slim: kon nie die instelling lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die instelling laai nie" };
  }

  rekord.hoof_sent = hoof_sent;
  rekord.ekstra_sent = ekstra_sent;
  rekord.hosting_pct = hosting_pct;
  rekord.bygewerk_op = new Date().toISOString();
  rekord.bygewerk_deur = (gebruiker && gebruiker.email) || "";

  try {
    await store.setJSON(INSTELLING_SLEUTEL, rekord);
  } catch (fout) {
    console.error("Speel-Slim: kon nie die instelling stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die instelling stoor nie" };
  }

  // Lees terug deur dieselfde pad as 'n aanvraag, sodat die antwoord wys wat
  // werklik sal geld.
  const instelling = await kry_instelling();
  const verdeling = await los_ontvangers_op(instelling);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hoof_sent: Number(instelling.hoof_sent) || 0,
      ekstra_sent: Number(instelling.ekstra_sent) || 0,
      hosting_pct: Number(instelling.hosting_pct) || 0,
      vaste_verdeling: Array.isArray(instelling.verdeling) && instelling.verdeling.length > 0,
      ontvangers: verdeling.map((v) => v.ontvanger),
      verdeling,
      bygewerk_op: rekord.bygewerk_op,
      bygewerk_deur: rekord.bygewerk_deur,
    }),
  };
};
