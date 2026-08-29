// netlify/functions/stoor-fin-bank.js
//
// Boekhouding-beskermd — teken die bankbalans op 'n datum aan.
//
// DIE DATUM IS DIE SLEUTEL, dus vervang 'n tweede inskrywing op dieselfde dag
// die eerste. Dit is reg: daar is net een balans op 'n dag, en 'n tikfout moet
// oorgetik kan word sonder 'n skrapstap.
//
// GEEN KONTROLE TEEN DIE INSKRYWINGS NIE.
//
// Dit is verleidelik om die balans te weier wanneer hy nie met die staat klop
// nie. Dit sou die toets omkeer: die bankstaat is die WAARHEID en die
// inskrywings is wat ons daarvan weet. Klop hulle nie, is dit die inskrywings
// wat kort, en die stelsel se werk is om dit te WYS, nie om die meting te
// weier nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fin_bank_store, is_datum, nuwe_balans } = require("./_fin-bank");

const ROLLE = ["boekhouding"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const datum = String(invoer.datum || "").trim();
  if (!is_datum(datum)) return { statusCode: 400, body: "Gee 'n geldige datum" };

  const balans = Number(invoer.balans_sent);
  if (!Number.isFinite(balans)) {
    return { statusCode: 400, body: "Gee die balans" };
  }

  const store = kry_fin_bank_store();

  let bestaande = null;
  try {
    bestaande = await store.get(datum, { type: "json" });
  } catch {
    bestaande = null;
  }

  const nou = new Date().toISOString();
  const rekord = {
    ...(bestaande || nuwe_balans(datum, 0)),
    datum,
    balans_sent: Math.round(balans),
    nota: String(invoer.nota || "").trim().slice(0, 300),
    bygewerk_op: nou,
  };
  if (!bestaande) {
    rekord.geskep_op = nou;
    rekord.geskep_deur = (gebruiker && gebruiker.email) || "";
  }

  try {
    await store.setJSON(datum, rekord);
  } catch (fout) {
    console.error(`Kon nie die bankbalans vir ${datum} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die balans stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ balans: rekord }),
  };
};
