// netlify/functions/koppel-inskrywings.js
// Weergawe 1 (25 September 2026).
//
// Boekhouding-beskermd -- koppel joernaalinskrywings aan 'n toekenning, of maak
// hulle los.
//
// Invoer: { aksie: "koppel" | "ontkoppel", toekenning,
//           inskrywings: [{ id, datum, beskrywing, bedrag_sent, rigting, bron }] }
//
// Die skerm stuur die inskrywing se besonderhede saam soos kry-joernaal hulle
// gegee het; die koppeling onthou hulle vir die optel. 'n Inskrywing wat reeds
// aan 'n ANDER toekenning gekoppel is, word geweier en by die naam genoem.
// Alles word eers nagegaan en dan geskryf.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_toekennings_store } = require("./_toekennings");
const K = require("./_koppelings");

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
  const lys = Array.isArray(invoer.inskrywings) ? invoer.inskrywings.slice(0, 500) : [];
  if (!lys.length) return { statusCode: 400, body: "Kies ten minste een inskrywing." };

  let t;
  try {
    t = await kry_toekennings_store().get(String(invoer.toekenning || ""), { type: "json" });
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die toekenning laai nie" };
  }
  if (!t) return { statusCode: 404, body: "Toekenning nie gevind nie" };

  const store = K.kry_koppelings_store();

  // ── Nagaan ─────────────────────────────────────────────────────────
  const plan = [];
  for (const r of lys) {
    const id = String(r.id || "");
    if (!id) return { statusCode: 400, body: "'n Inskrywing sonder identiteit." };
    let bestaan;
    try {
      bestaan = await store.get(K.sleutel_van(id), { type: "json" });
    } catch (fout) {
      return { statusCode: 500, body: "Kon nie die koppelings lees nie" };
    }
    if (invoer.aksie === "koppel") {
      if (bestaan && bestaan.toekenning !== t.id) {
        return { statusCode: 409, body: `"${r.beskrywing || id}" is reeds aan 'n ander toekenning gekoppel.` };
      }
      const bedrag = Number(r.bedrag_sent);
      if (!Number.isInteger(bedrag) || bedrag < 0) return { statusCode: 400, body: "'n Inskrywing se bedrag is ongeldig." };
      plan.push({ id, r, bedrag });
    } else if (invoer.aksie === "ontkoppel") {
      if (bestaan && bestaan.toekenning === t.id) plan.push({ id });
    } else {
      return { statusCode: 400, body: "Onbekende aksie" };
    }
  }

  // ── Skryf ──────────────────────────────────────────────────────────
  const nou = new Date().toISOString();
  try {
    for (const p of plan) {
      if (invoer.aksie === "koppel") {
        await store.setJSON(K.sleutel_van(p.id), {
          id: p.id,
          toekenning: t.id,
          projek_id: t.projek_id,
          datum: String(p.r.datum || "").slice(0, 10),
          beskrywing: String(p.r.beskrywing || "").slice(0, 200),
          bedrag_sent: p.bedrag,
          rigting: p.r.rigting === "in" ? "in" : "uit",
          bron: String(p.r.bron || "").slice(0, 20),
          gekoppel_op: nou,
          gekoppel_deur: gebruiker.email || "",
        });
      } else {
        await store.delete(K.sleutel_van(p.id));
      }
    }
  } catch (fout) {
    console.error("Koppeling onvolledig:", fout);
    return { statusCode: 500, body: "Die koppeling is nie volledig gestoor nie. Herlaai en kyk weer." };
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toekenning: t.id, aantal: plan.length }),
  };
};
