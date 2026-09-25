// netlify/functions/kry-toekennings.js
// Weergawe 3 (25 September 2026): elke toekenning dra ook `ontvang_sent`,
// `bestee_sent` en `koppelings`, uit die gekoppelde joernaalinskrywings.
// Weergawe 2: elke toekenning dra ook `nuwe_items`, die
// items wat die soort sedert die skep gekry het. Die skerm bied hulle aan; hulle
// word nie outomaties bygevoeg nie (sien wysig-kontrolelys.js, "neem_oor").
//
// Boekhouding-beskermd. ?projek=<id> gee daardie projek se toekennings; sonder
// projek almal. Die befondser en die soort se name word hier opgesoek, nie
// gestoor nie, sodat 'n hernoeming oral deurwerk.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_toekennings_store, lees_almal } = require("./_toekennings");
const { kry_befondsers_store } = require("./_befondsers");
const { kry_soorte_store, lees_almal: lees_soorte } = require("./_befondsingsoorte");
const { kry_koppelings_store, lees_almal: lees_koppelings } = require("./_koppelings");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  const projek = String((event.queryStringParameters || {}).projek || "").trim();

  let toekennings, soorte;
  try {
    toekennings = (await lees_almal(kry_toekennings_store()))
      .filter((t) => !projek || t.projek_id === projek);
    soorte = await lees_soorte(kry_soorte_store());
  } catch (fout) {
    console.error("Kon nie die toekennings lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die toekennings laai nie" };
  }

  // Die koppelings per toekenning. 'n Leesfout laat die bedrae nul eerder as
  // om die toekennings self te verloor.
  const per_tk = new Map();
  try {
    (await lees_koppelings(kry_koppelings_store())).forEach((k) => {
      if (!per_tk.has(k.toekenning)) per_tk.set(k.toekenning, []);
      per_tk.get(k.toekenning).push(k);
    });
  } catch (fout) {
    console.error("Kon nie die koppelings lees nie:", fout);
  }

  const bstore = kry_befondsers_store();
  const befondsers = new Map();
  await Promise.all([...new Set(toekennings.map((t) => t.befondser))].map(async (n) => {
    try {
      const b = await bstore.get(n, { type: "json" });
      if (b) befondsers.set(n, b);
    } catch { /* word as "bestaan nie meer" gewys */ }
  }));

  const uit = toekennings
    .map((t) => {
      const b = befondsers.get(t.befondser);
      const s = soorte.find((x) => x.id === t.soort);
      const items = t.kontrolelys || [];
      const het = new Set(items.map((i) => i.id));
      const nuwe_items = s ? [
        ...(s.uitreik || []).filter((i) => !het.has("u-" + i.id)).map((i) => i.naam),
        ...(s.rekords || []).filter((i) => !het.has("r-" + i.id)).map((i) => i.naam),
      ] : [];
      return {
        ...t,
        befondser_naam: b ? b.naam : "",
        befondser_weg: !b,
        soort_naam: s ? s.naam : t.soort_naam || t.soort,
        klaar_tel: items.filter((i) => i.klaar).length,
        items_tel: items.length,
        nuwe_items,
        koppelings: (per_tk.get(t.id) || []).sort((a, b) => String(a.datum).localeCompare(String(b.datum))),
        ontvang_sent: (per_tk.get(t.id) || []).filter((k) => k.rigting === "in").reduce((a, k) => a + k.bedrag_sent, 0),
        bestee_sent: (per_tk.get(t.id) || []).filter((k) => k.rigting === "uit").reduce((a, k) => a + k.bedrag_sent, 0),
      };
    })
    .sort((a, b) => String(a.van || "").localeCompare(String(b.van || "")) ||
      String(a.geskep_op).localeCompare(String(b.geskep_op)));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toekennings: uit }),
  };
};
