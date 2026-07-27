// PUBLIEK (geen aanmelding nodig nie) — die outeur/vennoot self maak
// hierdie skakel oop. Gee OPSETLIK minimale inligting terug: net hul
// naam, en per boek waarop hulle voorkom, besigtigings + aankope-tellings
// per formaat. GEEN geldbedrae, opbrengs, of koper-inligting nie — dis
// 'n bewuste ontwerpbesluit, nie 'n vergeetjie nie.

const { kry_store } = require("./_blob-store");

const ROL_KONFIG = {
  outeur: { store: "outeurs", idveld: "outeur_id" },
  vennoot: { store: "vennote", idveld: "vennoot_id" },
};

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const token = (event.queryStringParameters && event.queryStringParameters.token || "").trim();
  if (!token) {
    return { statusCode: 400, body: "Verpligte parameter: token" };
  }

  const skakels_store = kry_store("verslag-skakels");
  const skakel = await skakels_store.get(token, { type: "json" });
  if (!skakel) {
    return { statusCode: 404, body: "Hierdie skakel is nie geldig nie" };
  }

  const konfig = ROL_KONFIG[skakel.rol_tipe];
  if (!konfig) {
    return { statusCode: 500, body: "Ongeldige rol op skakel" };
  }

  const register_store = kry_store(konfig.store);
  const entiteit = await register_store.get(skakel.entiteit_id, { type: "json" });
  if (!entiteit) {
    return { statusCode: 404, body: "Hierdie profiel bestaan nie meer nie" };
  }

  // Deursoek die katalogus vir enige boek waar hierdie entiteit in 'n
  // verdeling voorkom (e-boek OF harde-kopie-formaat).
  const katalogus_store = kry_store("katalogus");
  const { blobs } = await katalogus_store.list();
  const alle_produkte = await Promise.all(blobs.map((b) => katalogus_store.get(b.key, { type: "json" })));

  const boeke = [];
  for (const produk of alle_produkte) {
    if (!produk) continue;
    const eboek_verdelings = (produk.formate?.eboek?.verdelings) || [];
    const hk_verdelings = (produk.formate?.harde_kopie?.verdelings) || [];
    const kom_voor = [...eboek_verdelings, ...hk_verdelings].some(
      (v) => v && v.rol_tipe === skakel.rol_tipe && v.entiteit_id === skakel.entiteit_id
    );
    if (!kom_voor) continue;

    boeke.push({
      titel: produk.titel,
      besigtigings: produk.besigtigings || 0,
      aankope_eboek: produk.aankope_eboek || 0,
      aankope_harde_kopie: produk.aankope_harde_kopie || 0,
    });
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      naam: entiteit.naam,
      rol_tipe: skakel.rol_tipe,
      boeke,
    }),
  };
};
