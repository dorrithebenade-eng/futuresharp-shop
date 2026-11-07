// Harde-kopie-opsies (November 2026).
//
// 'n Boek kan meer as een gedrukte opsie hê, elk 'n stel fisiese items
// (sien die "fisiese_items"-store en stoor-fisiese-item.js) met een prys en
// een verdeling. Voorbeeld: "Joernaal-jaarboek in 'n geskenkboks" =
// A4 joernaal + geskenkboks, R1 250.
//
// Vorm in die katalogus:
//   formate.harde_kopie.opsies = [{
//     sleutel, naam, prys_sent, beskikbaar,
//     items: [{ item_id, aantal }],
//     kaartjie,            // vra 'n kaartjieboodskap op die betaalbladsy
//     verdelings, hosting, // dieselfde vorm as by 'n formaat
//   }]
//
// 'n Opsie het dieselfde velde as 'n formaat (prys_sent, verdelings,
// hosting), sodat kode wat met 'n formaat werk, met kry_formaat_data() 'n
// opsie in sy plek kan kry.

const MAKS_OPSIES = 12;
const MAKS_ITEMS = 10;

function maak_sleutel(teks) {
  return String(teks || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// geldige_verdelings en geldige_hosting kom van die roeper (skep-produk.js
// en wysig-produk.js het elk sy eie), sodat die reëls op een plek bly.
function kry_geldige_opsies(opsies, geldige_verdelings, geldige_hosting) {
  if (!Array.isArray(opsies)) return [];
  const gesien = new Set();
  const uit = [];
  for (const o of opsies.slice(0, MAKS_OPSIES)) {
    if (!o || typeof o !== "object") continue;
    const naam = String(o.naam || "").trim().slice(0, 80);
    const prys_sent = Math.round(Number(o.prys_sent));
    if (!naam || !Number.isFinite(prys_sent) || prys_sent <= 0) continue;
    let sleutel = maak_sleutel(o.sleutel || naam);
    if (!sleutel) continue;
    let n = 2;
    while (gesien.has(sleutel)) sleutel = `${maak_sleutel(o.sleutel || naam)}-${n++}`;
    gesien.add(sleutel);
    const items = (Array.isArray(o.items) ? o.items : [])
      .slice(0, MAKS_ITEMS)
      .map((it) => ({
        item_id: maak_sleutel(it && it.item_id),
        aantal: Math.min(20, Math.max(1, Math.round(Number(it && it.aantal) || 1))),
      }))
      .filter((it) => it.item_id);
    uit.push({
      sleutel,
      naam,
      prys_sent,
      beskikbaar: o.beskikbaar !== false,
      items,
      kaartjie: o.kaartjie === true,
      verdelings: geldige_verdelings(o.verdelings),
      hosting: geldige_hosting(o.hosting),
    });
  }
  return uit;
}

// Gee 'n foutboodskap as 'n opsie se verdeling te min vir die hoofrekening
// los, anders null.
function kontroleer_opsies_minimum(opsies, oorskry, beskryf_minimum) {
  for (const o of opsies || []) {
    if (o.beskikbaar && oorskry(o.verdelings || [], o.hosting, o.prys_sent)) {
      return `Die harde-kopie-opsie "${o.naam}" se verdeling(s) plus Hosting los te min oor vir Future Sharp se hoofrekening. Paystack se fooi (2,9% + R1 + BTW) moet gedek word: laat ${beskryf_minimum(o.prys_sent)} oor.`;
    }
  }
  return null;
}

function het_opsies(produk) {
  const hk = produk && produk.formate && produk.formate.harde_kopie;
  return !!(hk && Array.isArray(hk.opsies) && hk.opsies.length);
}

// Die formaat se data vir 'n bestelde item. By 'n harde kopie met opsies
// moet 'n opsie gekies wees; die opsie se prys, verdelings en hosting
// vervang dan die formaat s'n. Gee null as die keuse ongeldig is.
function kry_formaat_data(produk, formaat, opsie_sleutel) {
  const f = produk && produk.formate && produk.formate[formaat];
  if (!f) return null;
  if (formaat !== "harde_kopie" || !het_opsies(produk)) return f;
  const o = f.opsies.find((x) => x.sleutel === opsie_sleutel);
  if (!o) return null;
  return {
    ...f,
    beskikbaar: !!f.beskikbaar && o.beskikbaar !== false,
    prys_sent: o.prys_sent,
    verdelings: o.verdelings || [],
    hosting: o.hosting || null,
    opsie: o,
  };
}

// Die laagste beskikbare opsieprys, vir "vanaf"-vertoning op kaarte.
function laagste_opsie_prys(opsies) {
  const pryse = (opsies || []).filter((o) => o.beskikbaar !== false).map((o) => o.prys_sent);
  return pryse.length ? Math.min(...pryse) : 0;
}

module.exports = {
  maak_sleutel,
  kry_geldige_opsies,
  kontroleer_opsies_minimum,
  het_opsies,
  kry_formaat_data,
  laagste_opsie_prys,
};
