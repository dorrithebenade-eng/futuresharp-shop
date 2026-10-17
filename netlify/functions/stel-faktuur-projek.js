// netlify/functions/stel-faktuur-projek.js
// Weergawe 1 (17 Oktober 2026).
//
// Stel die PROJEK van een faktuur, ook as dit reeds uitgereik of betaal is.
// Rol: boekhouding.
//
// Invoer: { sleutel, projek_id }   (leeg projek_id maak dit los)
//
// WAAROM DIT MAG, AL MAG 'N UITGEREIKTE FAKTUUR NIE VERANDER NIE. Die projek
// verskyn nerens op die dokument nie: die kliënt se faktuur, die bedrae en die
// verdeling bly presies soos uitgereik. Net die projek waarby die staat en die
// projekkaart die geld tel, verander. Elke verandering kom in die faktuur se
// geskiedenis. Dieselfde rede as stel-faktuur-kategorie.js.
//
// 'N NUWE KEUSE MOET 'N AKTIEWE PROJEK WEES. 'n Gedeaktiveerde projek wat
// reeds gekies was, mag bly.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_fakture_store, voeg_geskiedenis_by } = require("./_fakture");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try { invoer = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Ongeldige JSON" }; }
  const sleutel = String(invoer.sleutel || "").trim();
  const projek_id = String(invoer.projek_id || "").trim().slice(0, 120);
  if (!sleutel) return { statusCode: 400, body: "Onvolledige versoek" };

  const store = kry_fakture_store();
  let f;
  try {
    f = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die faktuur lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die faktuur lees nie" };
  }
  if (!f) return { statusCode: 404, body: "Faktuur nie gevind nie" };

  const ou = f.projek_id || "";
  if (ou === projek_id) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projek_id, verander: false }) };
  }

  let p = null;
  if (projek_id) {
    try {
      p = await kry_store("projekte").get(projek_id, { type: "json" });
    } catch (fout) {
      console.error("Kon nie die projek lees nie:", fout);
      return { statusCode: 503, body: "Kon nie die projek nagaan nie" };
    }
    if (!p) return { statusCode: 400, body: "Die projek bestaan nie." };
    if (p.aktief === false) return { statusCode: 409, body: "Die projek is gedeaktiveer." };
  }

  f.projek_id = projek_id;
  voeg_geskiedenis_by(f, "projek", gebruiker.email || "",
    projek_id ? `${(p && p.nr) || projek_id} ${(p && p.naam) || ""}`.trim() : "projek losgemaak");
  try {
    await store.setJSON(sleutel, f);
  } catch (fout) {
    console.error("Kon nie die faktuur stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die faktuur stoor nie" };
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projek_id, verander: true }),
  };
};
