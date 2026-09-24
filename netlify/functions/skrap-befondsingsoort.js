// netlify/functions/skrap-befondsingsoort.js
//
// Vee een befondsingsoort uit, of deaktiveer dit. Rol: boekhouding.
//
//   TOETS voor die naam, of geen toekenning gebruik dit nie  -> uitgevee
//   'n toekenning gebruik dit                                -> gedeaktiveer
//
// Ook 'n voorgelaaide soort mag weg; die saad-merk keer dat dit terugkom.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const { kry_soorte_store, saai, is_toets_naam } = require("./_befondsingsoorte");

async function tel_verwysings(id) {
  const store = kry_store("toekennings");
  const { blobs } = await store.list();
  const items = (
    await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);
  return items.filter((t) => t.soort === id).length;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }
  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const id = String(invoer.id || "").trim();
  if (!id || id.startsWith("_")) return { statusCode: 400, body: "Verpligte veld: id" };

  const store = kry_soorte_store();
  let soort;
  try {
    await saai(store);
    soort = await store.get(id, { type: "json" });
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die befondsingsoort laai nie" };
  }
  if (!soort) return { statusCode: 404, body: "Befondsingsoort nie gevind nie" };

  let verwysings;
  try {
    verwysings = await tel_verwysings(id);
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie nagaan of dit gebruik word nie. Niks is uitgevee nie." };
  }

  if (!is_toets_naam(soort.naam) && verwysings > 0) {
    try {
      await store.setJSON(id, { ...soort, aktief: false, bygewerk_op: new Date().toISOString() });
    } catch (fout) {
      return { statusCode: 500, body: "Kon nie deaktiveer nie" };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, uitgevee: false, gedeaktiveer: true, verwysings }),
    };
  }

  try {
    await store.delete(id);
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie uitvee nie" };
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, uitgevee: true, gedeaktiveer: false, verwysings }),
  };
};
