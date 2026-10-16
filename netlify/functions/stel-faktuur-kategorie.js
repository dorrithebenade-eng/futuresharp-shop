// netlify/functions/stel-faktuur-kategorie.js
// Weergawe 1 (16 Oktober 2026).
//
// Stel die KATEGORIE van een of meer reels op 'n reeds uitgereikte faktuur
// reg. Rol: boekhouding.
//
// Invoer: { sleutel, reels: [indeks, ...], kategorie_id }
//
// WAAROM DIT MAG, AL MAG 'N UITGEREIKTE FAKTUUR NIE VERANDER NIE. Die
// kategorie verskyn nerens op die dokument nie (sien stoor-faktuur.js): die
// kliënt se faktuur, die bedrae en die verdeling bly presies soos uitgereik.
// Net die reel waaronder die staat die inkomste optel, verander. Elke
// verandering word in die faktuur se geskiedenis aangeteken.
//
// DIE KATEGORIE MOET 'N INKOMSTEKATEGORIE WEES en bestaan. 'n Kostereel word
// nie aangeraak nie; sy val altyd onder Diensinkomste.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_fakture_store, is_konsep_sleutel, voeg_geskiedenis_by } = require("./_fakture");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try { invoer = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Ongeldige JSON" }; }
  const sleutel = String(invoer.sleutel || "");
  const ix = (Array.isArray(invoer.reels) ? invoer.reels : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0);
  const kategorie_id = String(invoer.kategorie_id || "");
  if (!sleutel || is_konsep_sleutel(sleutel) || !ix.length || !kategorie_id) {
    return { statusCode: 400, body: "Onvolledige versoek" };
  }

  let kat = null;
  if (kategorie_id === "diensinkomste") {
    kat = { id: "diensinkomste", naam: "Diensinkomste", rigting: "in" };
  } else {
    try {
      kat = await kry_store("fin-kategoriee").get(kategorie_id, { type: "json" });
    } catch (fout) {
      console.error("Kon nie die kategorie lees nie:", fout);
      return { statusCode: 500, body: "Kon nie die kategorie lees nie" };
    }
  }
  if (!kat) return { statusCode: 400, body: "Die kategorie bestaan nie." };
  if (kat.rigting !== "in") return { statusCode: 409, body: "Kies 'n inkomstekategorie." };

  const store = kry_fakture_store();
  let f;
  try {
    f = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die faktuur lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die faktuur lees nie" };
  }
  if (!f) return { statusCode: 404, body: "Faktuur nie gevind nie" };
  const reels = Array.isArray(f.reels) ? f.reels : [];

  const verander = [];
  for (const i of ix) {
    const r = reels[i];
    if (!r) return { statusCode: 400, body: `Reel ${i + 1} bestaan nie op hierdie faktuur nie.` };
    if (r.soort === "koste") continue;
    if (r.kategorie_id === kategorie_id) continue;
    verander.push(`${r.beskrywing || "reel " + (i + 1)}: ${r.kategorie_id || "geen"} → ${kat.naam || kategorie_id}`);
    r.kategorie_id = kategorie_id;
  }
  if (verander.length) {
    voeg_geskiedenis_by(f, "kategorie_regstel", gebruiker.email || "", verander.join("; "));
    try {
      await store.setJSON(sleutel, f);
    } catch (fout) {
      console.error("Kon nie die faktuur stoor nie:", fout);
      return { statusCode: 500, body: "Kon nie die faktuur stoor nie" };
    }
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verander: verander.length }),
  };
};
