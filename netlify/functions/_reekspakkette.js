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
//
// TRAPPE (November 2026): "meer boeke, groter afslag". 'n Pakket kan ook
//   trappe:   [{ min, prys_per_boek_sent }]  bv. 2 boeke of meer: R240 elk
//   tel_nie:  [slug]  boeke wat nie meetel nie en hul eie prys hou
//             (bv. Grondslag: die basis van die reeks)
//   koepon_toegelaat: true  koepons (bv. SPEELSLIM) geld bo-op die
//             pakket- of trapprys, per boek
// dra. Is AL die slugs in die mandjie, geld prys_sent (die hele reeks).
// Anders tel ons die boeke in die mandjie (sonder tel_nie) en gee elkeen die
// prys van die hoogste trap waarvoor die getal kwalifiseer. Die winkel keer
// niemand nie: Grondslag is nooit verpligtend nie.

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
// E-boeke en harde kopieë tel albei (November 2026). By 'n harde kopie is
// prys_sent hier net die boek se deel, sonder die drukkoste (_aflewering.js).
const BOEK_FORMATE = new Set(["eboek", "harde_kopie"]);

function trap_vir(trappe, getal) {
  let beste = null;
  for (const t of Array.isArray(trappe) ? trappe : []) {
    if (getal >= t.min && (!beste || t.min > beste.min)) beste = t;
  }
  return beste;
}

function pas_pakkette_toe(items, pakkette) {
  const per_item = items.map(() => null);
  const toegepas = [];
  const reeds_gebruik = new Set();

  for (const pakket of pakkette) {
    const koepon_toegelaat = pakket.koepon_toegelaat === true;
    const indekse = pakket.slugs.map((slug) =>
      items.findIndex(
        (it, i) => BOEK_FORMATE.has(it.formaat) && it.produk_slug === slug && !reeds_gebruik.has(i)
      )
    );

    // 1. Die hele reeks.
    if (indekse.every((i) => i >= 0)) {
      const oorspronklik = indekse.reduce((som, i) => som + (items[i].prys_sent || 0), 0);
      if (pakket.prys_sent < oorspronklik) {
        const dele = versprei(pakket.prys_sent, indekse.length);
        indekse.forEach((i, k) => {
          reeds_gebruik.add(i);
          per_item[i] = { pakket_id: pakket.id, prys_sent: dele[k], koepon_toegelaat };
        });
        toegepas.push({
          id: pakket.id,
          naam_af: pakket.naam_af,
          naam_en: pakket.naam_en,
          slugs: pakket.slugs,
          oorspronklike_sent: oorspronklik,
          prys_sent: pakket.prys_sent,
          afslag_sent: oorspronklik - pakket.prys_sent,
          volledig: true,
        });
        continue;
      }
    }

    // 2. Trappe: 'n deel van die reeks.
    if (!Array.isArray(pakket.trappe) || !pakket.trappe.length) continue;
    const tel_nie = new Set(pakket.tel_nie || []);
    const tel = indekse.filter((i, k) => i >= 0 && !tel_nie.has(pakket.slugs[k]));
    const trap = trap_vir(pakket.trappe, tel.length);
    if (!trap) continue;
    let oorspronklik = 0;
    let prys = 0;
    for (const i of tel) {
      const nuut = Math.min(items[i].prys_sent || 0, trap.prys_per_boek_sent);
      if (nuut < (items[i].prys_sent || 0)) {
        oorspronklik += items[i].prys_sent || 0;
        prys += nuut;
        reeds_gebruik.add(i);
        per_item[i] = { pakket_id: pakket.id, prys_sent: nuut, koepon_toegelaat };
      }
    }
    if (prys < oorspronklik) {
      toegepas.push({
        id: pakket.id,
        naam_af: pakket.naam_af,
        naam_en: pakket.naam_en,
        slugs: pakket.slugs,
        oorspronklike_sent: oorspronklik,
        prys_sent: prys,
        afslag_sent: oorspronklik - prys,
        volledig: false,
        getal: tel.length,
      });
    }
  }
  return { per_item, toegepas };
}

// WENKE vir die mandjie: hoeveel boeke tot die volgende trap of die hele
// reeks, en of die basisboek (tel_nie) ontbreek. Net e-boeke, net die
// koper se eie items (nie geskenke nie).
function bou_wenke(items, pakkette) {
  const wenke = [];
  const eie = items.filter((it) => BOEK_FORMATE.has(it.formaat) && !it.geskenk);
  const in_mandjie = new Set(eie.map((it) => it.produk_slug));
  for (const p of pakkette) {
    const tel_nie = new Set(p.tel_nie || []);
    const tel_slugs = p.slugs.filter((s) => !tel_nie.has(s));
    const het = tel_slugs.filter((s) => in_mandjie.has(s)).length;
    const het_iets = p.slugs.some((s) => in_mandjie.has(s));
    if (!het_iets) continue;
    if (het > 0) {
      for (const s of tel_nie) {
        if (!in_mandjie.has(s)) wenke.push({ soort: "basis", pakket_id: p.id, slug: s });
      }
    }
    const ontbreek_almal = p.slugs.filter((s) => !in_mandjie.has(s)).length;
    if (ontbreek_almal === 0) continue;
    const volgende = (Array.isArray(p.trappe) ? p.trappe : [])
      .filter((t) => t.min > het)
      .sort((a, b) => a.min - b.min)[0];
    if (volgende && volgende.min - het <= 2) {
      wenke.push({ soort: "trap", pakket_id: p.id, nodig: volgende.min - het, prys_per_boek_sent: volgende.prys_per_boek_sent });
    } else if (ontbreek_almal <= 2) {
      wenke.push({ soort: "reeks", pakket_id: p.id, nodig: ontbreek_almal, prys_sent: p.prys_sent, naam_af: p.naam_af, naam_en: p.naam_en });
    }
  }
  return wenke;
}

// GESKENKE (November 2026): 'n Mandjie kan dieselfde boek vir die koper self
// én as geskenk bevat. 'n Pakket mag nie die twee meng nie, daarom word die
// koper se eie items en die geskenk-items elk apart nagegaan. items dra
// `geskenk: true` waar dit 'n geskenk is. Dieselfde vorm as pas_pakkette_toe.
function pas_pakkette_toe_per_groep(items, pakkette) {
  const per_item = items.map(() => null);
  const toegepas = [];
  for (const is_geskenk of [false, true]) {
    const indekse = [];
    items.forEach((it, i) => {
      if (!!it.geskenk === is_geskenk) indekse.push(i);
    });
    if (!indekse.length) continue;
    const uitslag = pas_pakkette_toe(indekse.map((i) => items[i]), pakkette);
    uitslag.per_item.forEach((p, k) => {
      per_item[indekse[k]] = p;
    });
    for (const t of uitslag.toegepas) toegepas.push(is_geskenk ? { ...t, geskenk: true } : t);
  }
  return { per_item, toegepas };
}

module.exports = {
  pas_pakkette_toe_per_groep,
  bou_wenke,
  trap_vir,
  lees_pakkette,
  skryf_pakkette,
  is_aktief_nou,
  kry_aktiewe_pakkette,
  pas_pakkette_toe,
  versprei,
};
