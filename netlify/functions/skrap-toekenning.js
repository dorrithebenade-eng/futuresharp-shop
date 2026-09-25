// netlify/functions/skrap-toekenning.js
// Weergawe 1 (25 September 2026).
//
// Boekhouding-beskermd -- vee een toekenning uit, saam met sy kontrolelys.
// Vir 'n toekenning wat verkeerd opgestel is. Joernaal- en bankreels wat
// later (fase D) aan 'n toekenning gekoppel word, keer die skrap; tot dan is
// daar niks wat daarna verwys nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_toekennings_store } = require("./_toekennings");

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
    const js = kry_store("joernaal");
    const { blobs } = await js.list();
    const items = (await Promise.all((blobs || []).map((b) => js.get(b.key, { type: "json" })))).filter(Boolean);
    const gebruik = items.filter((r) => r.toekenning === id).length;
    if (gebruik) {
      return { statusCode: 409, body: `Hierdie toekenning word deur ${gebruik} joernaalinskrywing(s) gebruik en kan nie uitgevee word nie.` };
    }
    await store.delete(id);
  } catch (fout) {
    console.error("Kon nie die toekenning uitvee nie:", fout);
    return { statusCode: 500, body: "Kon nie die toekenning uitvee nie" };
  }
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, uitgevee: true }) };
};
