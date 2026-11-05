// netlify/functions/_eie-toegang.js
//
// BEDIENERLEER. Toegang tot 'n e-boek SONDER 'n bestelling (November 2026).
//
// Twee groepe lees 'n boek sonder om dit te koop:
//   1. ADMIN: wie die "personeel"-rol in die token dra (Dorrithé). Sy sien
//      elke boek in die katalogus wat 'n e-boek-PDF het, ook een wat nog
//      nie vrygestel of geaktiveer is nie. Dieselfde reël as kry-kyk-token.js
//      vir die talks.
//   2. OUTEUR: wie deur _my-outeur.js as outeur herken word. Hy sien elke
//      boek waarby hy betrokke is (outeur_ids of 'n outeur-verdeling in
//      enige formaat), via outeur_by_produk_betrokke(): dieselfde toets as
//      die outeurspaneel se My titels. 'n Mede-outeur tel dus ook.
//
// Die rede ("admin" of "outeur") gaan saam met die boek na die Leeskamer.
// Is iemand albei, wen "outeur" vir sy eie boeke: dit is die eerliker
// etiket.
//
// GEEN BESTELLING WORD GESKEP NIE. Hierdie toegang verskyn nêrens in die
// boekhouding, verkope of outeursyfers nie; dit is 'n leesreg, nie 'n
// transaksie nie.

const { kry_store } = require("./_blob-store");
const { kry_my_outeur } = require("./_my-outeur");
const { outeur_by_produk_betrokke } = require("./_outeur-aandeel");

function is_admin(gebruiker) {
  const rolle = (gebruiker && gebruiker.app_metadata && gebruiker.app_metadata.roles) || [];
  return rolle.includes("personeel");
}

function het_eboek_pdf(produk) {
  return Boolean(produk && produk.formate && produk.formate.eboek && produk.formate.eboek.eboek_sleutel);
}

// Een keer per versoek: is hierdie gebruiker admin, en watter outeur is hy?
async function kry_konteks(gebruiker) {
  if (!gebruiker || !gebruiker.id) return { admin: false, outeur_id: null };
  let outeur_id = null;
  try {
    const outeur = await kry_my_outeur(gebruiker);
    outeur_id = (outeur && outeur.outeur_id) || null;
  } catch (fout) {
    console.warn("Eie toegang: kon nie outeur opsoek nie:", fout);
  }
  return { admin: is_admin(gebruiker), outeur_id };
}

function rede_vir_produk(konteks, produk) {
  if (!het_eboek_pdf(produk)) return null;
  if (konteks.outeur_id && outeur_by_produk_betrokke(produk, konteks.outeur_id)) return "outeur";
  if (konteks.admin) return "admin";
  return null;
}

// Vir die leser: mag hierdie gebruiker hierdie een boek lees sonder 'n
// bestelling? Gee "admin", "outeur" of null.
async function eie_toegang_vir_boek(gebruiker, produk_slug) {
  if (!gebruiker || !produk_slug) return null;
  const konteks = await kry_konteks(gebruiker);
  if (!konteks.admin && !konteks.outeur_id) return null;
  try {
    const produk = await kry_store("katalogus").get(produk_slug, { type: "json" });
    return rede_vir_produk(konteks, produk);
  } catch {
    return null;
  }
}

// Vir My Leeskamer: al die boeke wat hierdie gebruiker so mag lees.
// Gee [{ produk, rede }] terug, alfabeties op titel.
async function kry_eie_toegang_boeke(gebruiker) {
  const konteks = await kry_konteks(gebruiker);
  if (!konteks.admin && !konteks.outeur_id) return [];

  const store = kry_store("katalogus");
  const { blobs } = await store.list();
  const produkte = await Promise.all(
    (blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null))
  );

  const uitslag = [];
  for (const produk of produkte) {
    if (!produk || !produk.slug) continue;
    const rede = rede_vir_produk(konteks, produk);
    if (rede) uitslag.push({ produk, rede });
  }
  uitslag.sort((a, b) => String(a.produk.titel || "").localeCompare(String(b.produk.titel || ""), "af"));
  return uitslag;
}

module.exports = { eie_toegang_vir_boek, kry_eie_toegang_boeke, is_admin };
