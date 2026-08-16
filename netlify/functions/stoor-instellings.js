// netlify/functions/stoor-instellings.js
//
// Wysig die maatskappy se besonderhede. Rol: boekhouding.
//
// ELKE VELD WORD MET DIE HAND GELEES, gesnoei en begrens. Niks gaan deur 'n
// `...wysigings`-spread nie: 'n nuwe veld wat ongevalideer deurglip, is
// presies waar wysig-produk.js al gebyt het.
//
// NIKS IS VERPLIG NIE. Die bankvelde mag leeg bly — hulle keer geen faktuur
// nie, en 'n vorm wat weier om te stoor omdat 'n takkode ontbreek, dwing
// iemand om die res van sy werk te verloor. Die skerm WAARSKU in plaas
// daarvan.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_instellings_store,
  MAATSKAPPY_SLEUTEL,
  SKRYFBARE_VELDE,
  skoon_veld,
  bank_onvolledig,
  kry_maatskappy,
} = require("./_instellings");

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

  // Begin by wat reeds gestoor is, sodat 'n veld wat nie gestuur is nie, bly
  // staan in plaas van leeg te word.
  const rekord = await kry_maatskappy();

  SKRYFBARE_VELDE.forEach((veld) => {
    if (Object.prototype.hasOwnProperty.call(invoer, veld)) {
      rekord[veld] = skoon_veld(veld, invoer[veld]);
    }
  });

  // Die naam is die enigste veld wat nie leeg mag wees nie: sonder hom dra
  // die faktuur se kop niks.
  if (!rekord.naam) {
    return { statusCode: 400, body: "Die maatskappy se naam mag nie leeg wees nie." };
  }

  rekord.bygewerk_op = new Date().toISOString();
  rekord.bygewerk_deur = (gebruiker && gebruiker.email) || "";

  try {
    await kry_instellings_store().setJSON(MAATSKAPPY_SLEUTEL, rekord);
  } catch (fout) {
    console.error("Kon nie die instellings stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die instellings stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maatskappy: rekord,
      bank_onvolledig: bank_onvolledig(rekord),
    }),
  };
};
