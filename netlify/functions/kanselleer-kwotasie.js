// netlify/functions/kanselleer-kwotasie.js
//
// Kanselleer 'n uitgereikte kwotasie. Rol: boekhouding.
//
// DIT IS DIE STAND "verwerp" UIT _kwotasies.js, met die hand gestel. Die
// publieke bladsy het doelbewus geen verwerp-knoppie nie; Dorrithé of Ignatius
// kanselleer self nadat hulle bevestig het dat die persoon dit nie aanvaar
// nie (besluit, 24 Oktober 2026: kwotasies verval nie vanself nie).
//
// 'n Gekanselleerde kwotasie is TOE: sy kan nie meer aanvaar of hersien word
// nie (is_toe() in _kwotasies.js). Die rekord bly bestaan as bewys van wat
// aangebied is.
//
// KOM SY UIT 'N SPEEL-SLIM-AANVRAAG, word FSF se Apps Script teruggeroep met
// status "Gekanselleer" (_speelslim.js). Misluk daardie terugroep, bly die
// kansellasie staan; die uitslag word op die aanvraag aangeteken.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_kwotasies_store,
  sleutel_na_nommer,
  voeg_geskiedenis_by,
} = require("./_kwotasies");
const { meld_kwotasie_gekanselleer } = require("./_speelslim");

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

  // Net 'n genommerde kwotasie. 'n Konsep word geskrap, nie gekanselleer nie.
  const sleutel = String(invoer.sleutel || "").trim();
  if (!sleutel_na_nommer(sleutel)) {
    return { statusCode: 400, body: "Ongeldige kwotasiesleutel" };
  }
  const rede = String(invoer.rede || "").trim().slice(0, 300);

  const store = kry_kwotasies_store();
  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Kwotasie nie gevind nie" };

  if (rekord.stand === "aanvaar" || rekord.faktuur_nommer) {
    return {
      statusCode: 409,
      body: "Hierdie kwotasie is reeds aanvaar en het 'n faktuur. Kanselleer eerder die faktuur.",
    };
  }
  if (rekord.stand === "verwerp") {
    return { statusCode: 409, body: "Hierdie kwotasie is reeds gekanselleer." };
  }
  if (rekord.stand !== "uitgereik") {
    return { statusCode: 409, body: "Net 'n uitgereikte kwotasie kan gekanselleer word." };
  }

  const wie = (gebruiker && gebruiker.email) || "";
  const nou = new Date().toISOString();
  rekord.stand = "verwerp";
  rekord.verwerp_op = nou;
  rekord.verwerp_deur = wie;
  rekord.verwerp_rede = rede || "Gekanselleer";
  rekord.bygewerk_op = nou;
  voeg_geskiedenis_by(rekord, "gekanselleer", wie, rede);

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie kanselleer nie" };
  }

  const terugroep = await meld_kwotasie_gekanselleer(rekord);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sleutel,
      nommer: rekord.nommer,
      stand: rekord.stand,
      verwerp_op: nou,
      // null as die kwotasie nie uit Speel-Slim kom nie.
      fsf_ingelig: terugroep ? terugroep.ok === true : null,
      fsf_fout: terugroep && !terugroep.ok ? terugroep.fout : null,
    }),
  };
};
