// EENMALIGE MIGRASIE-FUNCTION — skakel bestaande boeke se OU
// verdeling-skema { outeur_id, tipe, waarde } om na die NUWE skema
// { rol_tipe: "outeur", entiteit_id, tipe, waarde }.
//
// GEBRUIK: gaan een keer na
//   https://<jou-werf>/.netlify/functions/migreer-verdelings
// direk in jou blaaiser (GEEN aanmelding nodig nie — tydelik, net vir
// hierdie eenmalige oorskakeling). Dit gee 'n opsomming terug van watter
// boeke bygewerk is.
//
// BELANGRIK: skrap hierdie lêer heeltemal ná gebruik — dit het geen
// rol-kontrole nie en moet nooit permanent op die werf bly nie.

const { kry_store } = require("./_blob-store");

function is_ou_skema(v) {
  return v && v.outeur_id && !v.rol_tipe && !v.entiteit_id;
}

function skakel_om(verdelings) {
  if (!Array.isArray(verdelings)) return verdelings;
  return verdelings.map((v) => {
    if (is_ou_skema(v)) {
      return { rol_tipe: "outeur", entiteit_id: v.outeur_id, tipe: v.tipe, waarde: v.waarde };
    }
    return v;
  });
}

exports.handler = async (event, context) => {
  const store = kry_store("katalogus");
  const { blobs } = await store.list();

  const opsomming = [];

  for (const { key } of blobs) {
    const produk = await store.get(key, { type: "json" });
    if (!produk || !produk.formate) continue;

    let iets_verander = false;
    const nuwe_formate = { ...produk.formate };

    for (const formaat_naam of ["eboek", "harde_kopie"]) {
      const f = nuwe_formate[formaat_naam];
      if (f && Array.isArray(f.verdelings) && f.verdelings.some(is_ou_skema)) {
        nuwe_formate[formaat_naam] = { ...f, verdelings: skakel_om(f.verdelings) };
        iets_verander = true;
      }
    }

    if (iets_verander) {
      const bygewerk = { ...produk, formate: nuwe_formate };
      await store.setJSON(key, bygewerk);
      opsomming.push({ slug: produk.slug, titel: produk.titel, status: "bygewerk" });
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      {
        boodskap: opsomming.length
          ? `${opsomming.length} boek(e) se verdelings is omgeskakel na die nuwe skema.`
          : "Geen boeke met die ou verdeling-skema gevind nie — niks om te migreer nie.",
        opsomming,
      },
      null,
      2
    ),
  };
};
