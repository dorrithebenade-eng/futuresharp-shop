// netlify/functions/eenmalig-haal-stempel-af.js
//
// TYDELIK. HIERDIE LÊER WORD DIESELFDE DAG WEER VERWYDER.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM HY BESTAAN
//
// FS/01961 (Hannelie Swarts) en FS/01962 (Jessy Bekker) is geskep terwyl
// TOETSFASE in Netlify aan was, dus dra hulle die toetsstempel. Hulle is
// egter WERKLIKE fakture. Met die stempel kan hulle met een klik op Skrap
// uitgevee word, en skoon-toetsdata.js sou hulle saam met al die ander
// toetsdata wegvee.
//
// Die stempel word doelbewus net by skepping gestel en daarna nooit verander
// nie (sien _fakture.js). Daar is dus geen knoppie om hom af te haal nie, en
// daar behoort ook nie een te wees nie: 'n knoppie wat 'n faktuur
// onuitveebaar maak, sou net so maklik die omgekeerde doen.
//
// Hierdie lêer haal die stempel af van presies hierdie twee, en van die
// kwotasies waaruit hulle gekom het, as daar is. 'n Faktuur uit 'n
// kwotasie erf die kwotasie se stempel, dus sou 'n gestempelde kwotasie
// langs 'n ongestempelde faktuur bly lê en later uitgevee kon word.
//
// Dieselfde patroon as eenmalig-skrap-kw01961.js van 18 September.
//
// ─────────────────────────────────────────────────────────────────────────
// VIER SLOTTE
//
//   1. DIE NOMMERS IS HIER VASGESKRYF. Niks uit die versoek word gelees nie.
//   2. DIE ROL BOEKHOUDING GELD, plus 'n wagwoord in die liggaam.
//   3. NET `toets` VERANDER. Geen ander veld word aangeraak nie, en die
//      rekord word nie herbou nie: dit word gelees, die een veld word gestel,
//      en dit word teruggeskryf.
//   4. DIE VERANDERING WORD OP DIE REKORD SELF AANGETEKEN, in
//      `stempel_afgehaal`, met wie en wanneer. 'n Faktuur wat as toetsdata
//      begin het en dit nie meer is nie, moet dit kan sê.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store, nommer_na_sleutel: faktuur_sleutel } = require("./_fakture");
const { kry_kwotasies_store, nommer_na_sleutel: kwotasie_sleutel } = require("./_kwotasies");

// Die enigste fakture wat hierdie lêer ooit kan raak.
const FAKTURE = ["FS/01961", "FS/01962"];
const WAGWOORD = "haal-stempel-af";

async function haal_af(store, sleutel, wie, wanneer) {
  const rekord = await store.get(sleutel, { type: "json" });
  if (!rekord) return { sleutel, uitslag: "bestaan nie" };
  if (rekord.toets !== true) return { sleutel, uitslag: "het reeds geen stempel nie", rekord };

  rekord.toets = false;
  rekord.stempel_afgehaal = { deur: wie, op: wanneer };
  await store.setJSON(sleutel, rekord);
  return { sleutel, uitslag: "stempel afgehaal", rekord };
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
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  if (invoer.bevestig !== WAGWOORD) {
    return { statusCode: 400, body: "Geen bevestiging nie" };
  }

  const wie = (gebruiker && gebruiker.email) || "onbekend";
  const wanneer = new Date().toISOString();
  const f_store = kry_fakture_store();
  const k_store = kry_kwotasies_store();
  const verslag = [];

  for (const nommer of FAKTURE) {
    try {
      const f = await haal_af(f_store, faktuur_sleutel(nommer), wie, wanneer);
      verslag.push({ nommer, uitslag: f.uitslag });

      // Die kwotasie waaruit die faktuur gekom het, as daar een is.
      const kw_nommer = f.rekord && f.rekord.uit_kwotasie;
      if (kw_nommer) {
        const k = await haal_af(k_store, kwotasie_sleutel(kw_nommer), wie, wanneer);
        verslag.push({ nommer: kw_nommer, uitslag: k.uitslag });
      }
    } catch (fout) {
      verslag.push({ nommer, uitslag: `fout: ${fout.message || fout}` });
    }
  }

  console.log(`EENMALIG: toetsstempel afgehaal deur ${wie}:`, JSON.stringify(verslag));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(verslag),
  };
};
