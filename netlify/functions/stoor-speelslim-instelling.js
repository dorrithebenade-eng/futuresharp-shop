// netlify/functions/stoor-speelslim-instelling.js
//
// Wysig die Speel-Slim-prystabel. Rol: boekhouding.
//
// VIER VELDE, ELK MET DIE HAND GELEES. Die prys van 'n hoofverslag, die prys
// per bykomende vraelys by 'n gesamentlike verslag, die persentasie vir
// hosting, en die verdeling van die res. Niks gaan deur 'n spread nie.
//
// DIE VERDELING. 'n Leë lys beteken: verdeel die res gelyk tussen Dorrithé en
// Ignatius (los_ontvangers_op reken dit by elke aanvraag uit die hosting). 'n
// Lys met rye is 'n vaste verdeling. Elke ontvanger moet presies so in die
// begunstigde-register staan, anders kry hy by uitreiking geen subrekening
// nie en bly sy geld stilweg in die hoofrekening.
//
// HOOGSTENS 99,9% SAAM. By presies 100% loop die afronding by sommige bedrae
// een sent oor en keer faktuur-som.js die kwotasie as oorbestee.
//
// DIE REKORD IN DIE STORE WORD AANGEVUL, NIE VERVANG NIE. Ander velde wat
// daar mag staan (verdeling, kategorie_id, projek_id) bly soos hulle is.
//
// GELD NET VIR NUWE AANVRAE. 'n Kwotasie wat reeds uitgereik is, dra sy eie
// reëls en bedrae; hierdie instelling raak hom nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { INSTELLING_SLEUTEL, kry_instelling, los_ontvangers_op, begunstigde_name } = require("./_speelslim");

// R10 000 is ruim bo enige verslagprys; 'n hoër bedrag is byna seker 'n tikfout.
const MAKS_SENT = 1000000;
// Meer as die helfte vir hosting is nie 'n verdeling nie, dit is 'n tikfout.
const MAKS_HOSTING = 50;
// In honderdstes van 'n persent: 99,9%.
const MAKS_SAAM = 9990;
const MAKS_RYE = 6;

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

  // Die verdeling: weggelaat of leeg is gelyk; anders 'n vaste lys.
  let nuwe_verdeling = [];
  if (invoer.verdeling != null) {
    if (!Array.isArray(invoer.verdeling) || invoer.verdeling.length > MAKS_RYE) {
      return { statusCode: 400, body: `Die verdeling mag hoogstens ${MAKS_RYE} ontvangers hê.` };
    }
    const bekend = new Set(await begunstigde_name());
    const gesien = new Set();
    for (const ry of invoer.verdeling) {
      const ontvanger = String((ry && ry.ontvanger) || "").trim();
      if (!ontvanger) return { statusCode: 400, body: "Kies 'n ontvanger vir elke ry." };
      if (!bekend.has(ontvanger)) {
        return { statusCode: 400, body: `${ontvanger} staan nie in die begunstigde-register nie.` };
      }
      if (gesien.has(ontvanger)) return { statusCode: 400, body: `${ontvanger} staan twee keer in die verdeling.` };
      const n = Number(ry && ry.waarde);
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        return { statusCode: 400, body: `Die persentasie vir ${ontvanger} moet bo 0% en hoogstens 100% wees.` };
      }
      gesien.add(ontvanger);
      nuwe_verdeling.push({ ontvanger, tipe: "pct", waarde: Math.round(n * 100) / 100 });
    }
    const saam = Math.round(hosting_pct * 100) + nuwe_verdeling.reduce((s, v) => s + Math.round(v.waarde * 100), 0);
    if (saam > MAKS_SAAM) {
      return {
        statusCode: 400,
        body: `Hosting en die ontvangers is saam ${(saam / 100).toString().replace(".", ",")}%. Dit mag hoogstens 99,9% wees.`,
      };
    }
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
  if (invoer.verdeling != null) rekord.verdeling = nuwe_verdeling;
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
      begunstigdes: await begunstigde_name(),
      bygewerk_op: rekord.bygewerk_op,
      bygewerk_deur: rekord.bygewerk_deur,
    }),
  };
};
