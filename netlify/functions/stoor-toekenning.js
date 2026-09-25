// netlify/functions/stoor-toekenning.js
// Weergawe 1 (25 September 2026).
//
// Boekhouding-beskermd -- skep of wysig een toekenning.
//
// SKEP: projek, befondser en soort is verplig. Die projek en die befondser moet
// bestaan en aktief wees; die soort ook. Die kontrolelys word uit die soort
// gekopieer.
//
// 'N SOORT WAT ART. 18A-GOEDKEURING VEREIS, WORD GEWEIER solank Future Sharp
// nie die goedkeuring het nie. 'n 18A-sertifikaat mag nie voor die tyd
// uitgereik word nie; die soort word vrygestel wanneer die goedkeuring in die
// stelsel aangeteken word (latere stap).
//
// WYSIG: net die bedrag, die tydperk, die voorwaardes en die aantekening. Die
// befondser en die soort bly, want die kontrolelys hang van hulle af.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const T = require("./_toekennings");
const { kry_projekte_store } = require("./_projekte");
const { kry_befondsers_store } = require("./_befondsers");
const { kry_soorte_store, lees_almal: lees_soorte } = require("./_befondsingsoorte");

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

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

  const bedrag = T.sent_uit(invoer.bedrag);
  if (bedrag === null) return { statusCode: 400, body: "Gee 'n geldige bedrag, byvoorbeeld 25000,00." };
  const van = String(invoer.van || "");
  const tot = String(invoer.tot || "");
  if ((van && !DATUM.test(van)) || (tot && !DATUM.test(tot))) {
    return { statusCode: 400, body: "Die tydperk se datums is ongeldig." };
  }
  if (van && tot && tot < van) return { statusCode: 400, body: "Die einddatum is voor die begindatum." };

  const store = T.kry_toekennings_store();
  const nou = new Date().toISOString();

  // ── Wysig ──────────────────────────────────────────────────────────
  if (invoer.id) {
    let t;
    try {
      t = await store.get(String(invoer.id), { type: "json" });
    } catch (fout) {
      return { statusCode: 500, body: "Kon nie die toekenning laai nie" };
    }
    if (!t) return { statusCode: 404, body: "Toekenning nie gevind nie" };
    Object.assign(t, {
      bedrag_sent: bedrag, van, tot,
      voorwaardes: invoer.voorwaardes === true,
      nota: String(invoer.nota || "").trim().slice(0, 500),
      bygewerk_op: nou, bygewerk_deur: gebruiker.email || "",
    });
    try {
      await store.setJSON(t.id, t);
    } catch (fout) {
      return { statusCode: 500, body: "Kon nie die toekenning stoor nie" };
    }
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toekenning: t }) };
  }

  // ── Skep ───────────────────────────────────────────────────────────
  const projek_id = String(invoer.projek_id || "").trim();
  const befondser = String(invoer.befondser || "").trim();
  const soort_id = String(invoer.soort || "").trim();
  if (!projek_id || !befondser || !soort_id) {
    return { statusCode: 400, body: "Kies die befondser en die soort befondsing." };
  }

  let projek, bf, soort;
  try {
    projek = await kry_projekte_store().get(projek_id, { type: "json" });
    bf = await kry_befondsers_store().get(befondser, { type: "json" });
    soort = (await lees_soorte(kry_soorte_store())).find((s) => s.id === soort_id);
  } catch (fout) {
    console.error("Kon nie vir die toekenning lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die projek, befondser of soort laai nie" };
  }
  if (!projek || projek.aktief === false) return { statusCode: 400, body: "Die projek bestaan nie of is onaktief." };
  if (!bf || bf.aktief === false) return { statusCode: 400, body: "Die befondser bestaan nie of is onaktief." };
  if (!soort || soort.aktief === false) return { statusCode: 400, body: "Die soort befondsing bestaan nie of is onaktief." };
  if (soort.vereis_18a) {
    return {
      statusCode: 409,
      body: `"${soort.naam}" vereis Art. 18A-goedkeuring, en Future Sharp het dit nog nie. Kies 'n ander soort.`,
    };
  }

  const t = {
    id: T.nuwe_id(),
    projek_id,
    befondser,
    soort: soort.id,
    soort_naam: soort.naam,          // vir die geval dat die soort later uitgevee word
    bedrag_sent: bedrag,
    van, tot,
    voorwaardes: invoer.voorwaardes === true,
    nota: String(invoer.nota || "").trim().slice(0, 500),
    kontrolelys: T.kontrolelys_uit_soort(soort),
    geskep_op: nou,
    geskep_deur: gebruiker.email || "",
    bygewerk_op: nou,
  };
  try {
    await store.setJSON(t.id, t);
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die toekenning stoor nie" };
  }
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toekenning: t }) };
};
