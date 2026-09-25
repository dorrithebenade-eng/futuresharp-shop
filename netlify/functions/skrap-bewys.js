// netlify/functions/skrap-bewys.js
// Weergawe 1 (25 September 2026).
//
// Boekhouding-beskermd -- vee een bewysstuk uit en maak dit los van sy item.
// Invoer: { toekenning, item, sleutel }

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_toekennings_store } = require("./_toekennings");
const { kry_bewys_store } = require("./_bewysstukke");

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

  const tstore = kry_toekennings_store();
  let t;
  try {
    t = await tstore.get(String(invoer.toekenning || ""), { type: "json" });
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die toekenning laai nie" };
  }
  if (!t) return { statusCode: 404, body: "Toekenning nie gevind nie" };
  const item = (t.kontrolelys || []).find((i) => i.id === invoer.item);
  if (!item || !(item.dokumente || []).some((d) => d.sleutel === invoer.sleutel)) {
    return { statusCode: 404, body: "Bewysstuk nie gevind nie" };
  }

  // Eers die koppeling, dan die leer: misluk die tweede, bly net 'n wees in
  // die store agter, nie 'n item wat na 'n leer wys wat nie bestaan nie.
  item.dokumente = item.dokumente.filter((d) => d.sleutel !== invoer.sleutel);
  t.bygewerk_op = new Date().toISOString();
  try {
    await tstore.setJSON(t.id, t);
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die toekenning stoor nie" };
  }
  try {
    await kry_bewys_store().delete(invoer.sleutel);
  } catch (fout) {
    console.error(`Kon nie bewysstuk ${invoer.sleutel} uitvee nie:`, fout);
  }
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toekenning: t }) };
};
