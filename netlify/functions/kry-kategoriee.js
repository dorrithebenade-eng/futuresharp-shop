// PUBLIEK — geen personeel-rol vereis nie. Kategorie-name is nie
// sensitiewe inligting nie, en die katalogus-filter op die winkelfront
// (vir ALLE besoekers, aangemeld of nie) benodig hierdie lys om die
// filter-knoppies te bou. Personeel se paneelbord gebruik dieselfde
// endpoint vir sy eie kategorie-bestuur-lys.

const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const store = kry_store("kategoriee");
  const { blobs } = await store.list();

  const kategoriee = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  kategoriee.sort((a, b) => a.naam_af.localeCompare(b.naam_af, "af"));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kategoriee }),
  };
};
