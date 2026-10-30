// netlify/functions/_reekspakkette.js
//
// REEKSPAKKETTE (Oktober 2026). Wie al die e-boeke van een reeks in die
// mandjie het, betaal 'n pakketprys in plaas van die som van die boeke,
// sonder 'n kode. Eerste gebruik: Black Friday 2026, 31 Okt tot 30 Nov,
// die 6 Speel-Slim- of Play-Smart-boeke vir R1 000 en die 3 Fokus-boeke
// vir R500.
//
// STORE "reekspakkette", sleutel "lys": rekords
//   { id, naam_af, naam_en, slugs: [...], prys_sent, van, tot, aktief }
// van en tot is ISO-tye (tot is inklusief tot op die sekonde).
//
// REËLS
// - Net e-boeke. 'n Pakket geld net as AL sy slugs as e-boek in die mandjie is.
// - Die pakketprys word oor die boeke versprei (gelyke dele, die oorblywende
//   sent by die eerste boeke), sodat elke boek se verdeling soos altyd werk.
// - Ander koepons geld nie op boeke in 'n pakket nie (begin-betaling.js en
//   verifieer-koepon.js slaan hulle oor).
// - 'n Boek kan net in een pakket val; die eerste pakket in die lys wen.

const { kry_store } = require("./_blob-store");

const store = () => kry_store("reekspakkette");

async function lees_pakkette() {
  return (await store().get("lys", { type: "json" })) || [];
}

async function skryf_pakkette(lys) {
  await store().setJSON("lys", lys);
}

function is_aktief_nou(pakket, nou = new Date()) {
  if (!pakket || !pakket.aktief) return false;
  if (!Array.isArray(pakket.slugs) || pakket.slugs.length < 2) return false;
  if (!(pakket.prys_sent > 0)) return false;
  if (pakket.van && new Date(pakket.van) > nou) return false;
  if (pakket.tot && new Date(pakket.tot) < nou) return false;
  return true;
}

async function kry_aktiewe_pakkette(nou = new Date()) {
  return (await lees_pakkette()).filter((p) => is_aktief_nou(p, nou));
}

// Versprei 'n bedrag oor n dele: gelyke dele, die oorblywende sent by die eerste.
function versprei(bedrag_sent, n) {
  const basis = Math.floor(bedrag_sent / n);
  const oor = bedrag_sent - basis * n;
  return Array.from({ length: n }, (_, i) => basis + (i < oor ? 1 : 0));
}

// items: [{ produk_slug, formaat, prys_sent }] met die KATALOGUS se pryse.
// Gee terug:
//   per_item: [{ pakket_id, prys_sent } | null] in dieselfde volgorde
//   toegepas: [{ id, naam_af, naam_en, slugs, oorspronklike_sent, prys_sent, afslag_sent }]
// 'n Pakket word net toegepas as dit goedkoper is as die boeke los.
function pas_pakkette_toe(items, pakkette) {
  const per_item = items.map(() => null);
  const toegepas = [];
  const reeds_gebruik = new Set();

  for (const pakket of pakkette) {
    const indekse = pakket.slugs.map((slug) =>
      items.findIndex(
        (it, i) => it.formaat === "eboek" && it.produk_slug === slug && !reeds_gebruik.has(i)
      )
    );
    if (indekse.some((i) => i < 0)) continue;

    const oorspronklik = indekse.reduce((som, i) => som + (items[i].prys_sent || 0), 0);
    if (pakket.prys_sent >= oorspronklik) continue;

    const dele = versprei(pakket.prys_sent, indekse.length);
    indekse.forEach((i, k) => {
      reeds_gebruik.add(i);
      per_item[i] = { pakket_id: pakket.id, prys_sent: dele[k] };
    });
    toegepas.push({
      id: pakket.id,
      naam_af: pakket.naam_af,
      naam_en: pakket.naam_en,
      slugs: pakket.slugs,
      oorspronklike_sent: oorspronklik,
      prys_sent: pakket.prys_sent,
      afslag_sent: oorspronklik - pakket.prys_sent,
    });
  }
  return { per_item, toegepas };
}

module.exports = {
  lees_pakkette,
  skryf_pakkette,
  is_aktief_nou,
  kry_aktiewe_pakkette,
  pas_pakkette_toe,
  versprei,
};
