// netlify/functions/laai-bewys-op.js
// Weergawe 1 (25 September 2026).
//
// Boekhouding-beskermd -- laai een bewysstuk op by een kontrolelys-item.
//
// Invoer: { toekenning, item, leernaam, inhoud_tipe, data_base64 }
//
// Die leer word eers gestoor en dan eers aan die item gekoppel. Misluk die
// koppeling, word die leer weer uitgevee, sodat daar nie 'n wees in die store
// agterbly nie.
//
// Die item word NIE outomaties afgemerk nie. 'n Opgelaaide leer se nog nie of
// dit die regte een is nie; dit bly 'n mens se besluit.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_toekennings_store } = require("./_toekennings");
const B = require("./_bewysstukke");

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

  const tipe = String(invoer.inhoud_tipe || "");
  if (!B.TIPES[tipe]) {
    return { statusCode: 400, body: "Net PDF, foto (JPG, PNG, WebP), Word of Excel word aanvaar." };
  }
  let data;
  try {
    data = Buffer.from(String(invoer.data_base64 || ""), "base64");
  } catch {
    return { statusCode: 400, body: "Die lêer kon nie gelees word nie." };
  }
  if (!data.length) return { statusCode: 400, body: "Die lêer is leeg." };
  if (data.length > B.MAKS_GREPE) return { statusCode: 413, body: "Die lêer is groter as 4 MB. Maak dit eers kleiner." };

  const tstore = kry_toekennings_store();
  let t;
  try {
    t = await tstore.get(String(invoer.toekenning || ""), { type: "json" });
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die toekenning laai nie" };
  }
  if (!t) return { statusCode: 404, body: "Toekenning nie gevind nie" };
  const item = (t.kontrolelys || []).find((i) => i.id === invoer.item);
  if (!item) return { statusCode: 404, body: "Item nie gevind nie" };

  const naam = String(invoer.leernaam || "bewysstuk").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
  const sleutel = B.skep_sleutel(t.id, item.id, tipe);
  const bstore = B.kry_bewys_store();

  try {
    await bstore.set(sleutel, data, { metadata: { inhoud_tipe: tipe, naam } });
  } catch (fout) {
    console.error("Kon nie die bewysstuk stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die lêer stoor nie" };
  }

  item.dokumente = Array.isArray(item.dokumente) ? item.dokumente : [];
  item.dokumente.push({
    sleutel, naam, tipe, grootte: data.length,
    op: new Date().toISOString(), deur: gebruiker.email || "",
  });
  t.bygewerk_op = new Date().toISOString();
  try {
    await tstore.setJSON(t.id, t);
  } catch (fout) {
    console.error("Kon nie die bewysstuk koppel nie:", fout);
    try { await bstore.delete(sleutel); } catch { /* die log hierbo se genoeg */ }
    return { statusCode: 500, body: "Kon nie die lêer aan die item koppel nie" };
  }
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toekenning: t }) };
};
