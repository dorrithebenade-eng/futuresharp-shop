// netlify/functions/wysig-kontrolelys.js
// Weergawe 1 (25 September 2026).
//
// Boekhouding-beskermd -- een toekenning se kontrolelys.
//
//   aksie "merk"      { id, item, klaar, nota? }  merk af of weer oop; die
//                     datum en wie word aangeteken
//   aksie "voeg_by"   { id, lys, naam, dokument } 'n eie item net vir hierdie
//                     toekenning
//   aksie "verwyder"  { id, item }                net 'n eie item; die soort se
//                     items bly, want hulle is die afspraak met die befondser

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
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

  const store = kry_toekennings_store();
  let t;
  try {
    t = await store.get(String(invoer.id || ""), { type: "json" });
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die toekenning laai nie" };
  }
  if (!t) return { statusCode: 404, body: "Toekenning nie gevind nie" };
  t.kontrolelys = Array.isArray(t.kontrolelys) ? t.kontrolelys : [];

  const nou = new Date().toISOString();
  if (invoer.aksie === "merk") {
    const i = t.kontrolelys.find((x) => x.id === invoer.item);
    if (!i) return { statusCode: 404, body: "Item nie gevind nie" };
    i.klaar = invoer.klaar === true;
    i.datum = i.klaar ? nou.slice(0, 10) : "";
    i.deur = i.klaar ? (gebruiker.email || "") : "";
    if (invoer.nota !== undefined) i.nota = String(invoer.nota || "").trim().slice(0, 300);
  } else if (invoer.aksie === "voeg_by") {
    const naam = String(invoer.naam || "").trim().slice(0, 160);
    if (!naam) return { statusCode: 400, body: "Beskryf die item." };
    const lys = invoer.lys === "uitreik" ? "uitreik" : "rekords";
    t.kontrolelys.push({
      id: "e-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      lys, naam, dokument: lys === "rekords" && invoer.dokument === true,
      klaar: false, datum: "", deur: "", nota: "", eie: true,
    });
  } else if (invoer.aksie === "verwyder") {
    const i = t.kontrolelys.find((x) => x.id === invoer.item);
    if (!i) return { statusCode: 404, body: "Item nie gevind nie" };
    if (!i.eie) return { statusCode: 409, body: "Net 'n eie item kan verwyder word; die soort se items is die afspraak met die befondser." };
    t.kontrolelys = t.kontrolelys.filter((x) => x !== i);
  } else {
    return { statusCode: 400, body: "Onbekende aksie" };
  }

  t.bygewerk_op = nou;
  t.bygewerk_deur = gebruiker.email || "";
  try {
    await store.setJSON(t.id, t);
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die kontrolelys stoor nie" };
  }
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toekenning: t }) };
};
