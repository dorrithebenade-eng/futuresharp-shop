// netlify/functions/aktiveer-befondsingsoort.js
//
// Heraktiveer een gedeaktiveerde befondsingsoort. Rol: boekhouding.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_soorte_store, saai } = require("./_befondsingsoorte");

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
  const store = kry_soorte_store();
  let soort;
  try {
    await saai(store);
    soort = await store.get(id, { type: "json" });
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die befondsingsoort laai nie" };
  }
  if (!soort) return { statusCode: 404, body: "Befondsingsoort nie gevind nie" };
  soort = { ...soort, aktief: true, bygewerk_op: new Date().toISOString() };
  try {
    await store.setJSON(id, soort);
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie aktiveer nie" };
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soort }),
  };
};
