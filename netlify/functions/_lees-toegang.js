// netlify/functions/_lees-toegang.js
//
// BEDIENERLEER. Mag hierdie gebruiker hierdie e-boek lees? (November 2026)
//
// Dieselfde toets as stoor-lees-vordering.js en kry-eboek-inhoud.js, op een
// plek vir die nuwer Functions (boekmerke). Ja as:
//   1. 'n betaalde bestelling 'n e-boek van hierdie boek bevat wat nie as
//      geskenk vir iemand anders gekoop is nie; of
//   2. 'n betaalde bestelling 'n leen bevat wat nog nie verval het nie; of
//   3. eie toegang geld: admin of outeur (_eie-toegang.js).
//
// Die ouer Functions hou voorlopig hul eie kopie van die toets: hulle werk,
// en om hulle nou te verander is 'n risiko sonder wins.

const { kry_store } = require("./_blob-store");
const { eie_toegang_vir_boek } = require("./_eie-toegang");

async function besit_boek(gebruiker_id, produk_slug) {
  const bestellings_store = kry_store("bestellings");
  const { blobs } = await bestellings_store.list();

  for (const item of blobs) {
    let bestelling;
    try {
      bestelling = await bestellings_store.get(item.key, { type: "json" });
    } catch {
      continue;
    }
    if (!bestelling) continue;
    if (!bestelling.koper || bestelling.koper.netlify_identity_id !== gebruiker_id) continue;
    if (bestelling.status !== "Nuut") continue;

    const items = Array.isArray(bestelling.items) ? bestelling.items : [];
    if (items.some((i) => i.produk_slug === produk_slug && i.formaat === "eboek" && i.geskenk !== true)) {
      return true;
    }
    const leen = items.find((i) => i.produk_slug === produk_slug && i.formaat === "leen");
    if (leen && leen.verval_op && new Date(leen.verval_op) > new Date()) return true;
  }
  return false;
}

async function mag_lees(gebruiker, produk_slug) {
  if (!gebruiker || !produk_slug) return false;
  if (await eie_toegang_vir_boek(gebruiker, produk_slug)) return true;
  return besit_boek(gebruiker.id, produk_slug);
}

module.exports = { mag_lees };
