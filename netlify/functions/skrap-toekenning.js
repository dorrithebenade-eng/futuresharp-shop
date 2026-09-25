// netlify/functions/skrap-toekenning.js
// Weergawe 3 (25 September 2026): gekoppelde joernaalinskrywings (fase D) keer
// die skrap; maak hulle eers los.
// Weergawe 2: die bewysstukke gaan saam weg.
//
// Boekhouding-beskermd -- vee een toekenning uit, saam met sy kontrolelys.
// Vir 'n toekenning wat verkeerd opgestel is. Joernaal- en bankreels wat
// later (fase D) aan 'n toekenning gekoppel word, keer die skrap; tot dan is
// daar niks wat daarna verwys nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_toekennings_store } = require("./_toekennings");
const { vee_uit_vir } = require("./_bewysstukke");
const { kry_koppelings_store, lees_almal: lees_koppelings } = require("./_koppelings");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const id = String(invoer.id || "");
  const store = kry_toekennings_store();

  try {
    const t = await store.get(id, { type: "json" });
    if (!t) return { statusCode: 404, body: "Toekenning nie gevind nie" };
    const gebruik = (await lees_koppelings(kry_koppelings_store())).filter((k) => k.toekenning === id).length;
    if (gebruik) {
      return { statusCode: 409, body: `Hierdie toekenning word deur ${gebruik} joernaalinskrywing(s) gebruik en kan nie uitgevee word nie.` };
    }
    await vee_uit_vir(t);
    await store.delete(id);
  } catch (fout) {
    console.error("Kon nie die toekenning uitvee nie:", fout);
    return { statusCode: 500, body: "Kon nie die toekenning uitvee nie" };
  }
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, uitgevee: true }) };
};
