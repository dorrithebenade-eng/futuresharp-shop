// netlify/functions/_aflewering.js
//
// HARDE KOPIEË OP BESTELLING (November 2026).
//
// 1. Drukkoste. 'n Harde kopie se prys in die katalogus is die boek se deel
//    plus die drukkoste (formate.harde_kopie.drukkoste_sent, tans R85). Die
//    koper sien een prys. Afslag (reekspakkette, koepons) en die verdeling
//    aan die outeurs en hosting geld net op die boek se deel; die drukkoste
//    bly altyd vol en bly in Future Sharp se hoofrekening.
//
// 2. Aflewering. Een keer per bestelling, volgens die getal harde kopieë:
//    koerier R90 vir 1 tot 10 boeke, R160 vir 11 tot 30, en so verder per
//    30. Afhaal in Pretoria is R0; die tyd en plek gaan per e-pos.
//    'n Boek kan sy eie koeriertarief hê (formate.harde_kopie.koerier_sent,
//    November 2026, bv. R120 vir "Ek het jou by jou naam geroep"). Die
//    bestelling gebruik dan die hoogste tarief van die boeke daarin vir die
//    eerste trap; die volgende trap skuif ewe veel op.
//    LET WEL: bestelling.versending is reeds die rekord van die versending
//    self (gestuur, spoornommer). Die keuse en die bedrag leef daarom by
//    aflewering.metode en afleweringskoste_sent.

const KOERIER_TRAPPE = [
  { tot: 10, sent: 9000 },
  { tot: 30, sent: 16000 },
];

function drukkoste_sent(formaat_data) {
  const d = Math.round(Number(formaat_data && formaat_data.drukkoste_sent) || 0);
  if (d <= 0) return 0;
  return Math.min(d, Math.round(Number(formaat_data.prys_sent) || 0));
}

function boekdeel_sent(formaat_data) {
  return Math.max(0, Math.round(Number(formaat_data && formaat_data.prys_sent) || 0) - drukkoste_sent(formaat_data));
}

function skoon_metode(m) {
  return m === "afhaal" ? "afhaal" : "koerier";
}

// Die boek se eie koeriertarief (0 = die standaard).
function koerier_tarief_sent(produk) {
  const hk = produk && produk.formate && produk.formate.harde_kopie;
  return Math.max(0, Math.round(Number(hk && hk.koerier_sent) || 0));
}

function afleweringskoste_sent(getal_harde_kopieë, metode, tarief_sent) {
  let oor = Math.max(0, Math.round(Number(getal_harde_kopieë) || 0));
  if (!oor || skoon_metode(metode) === "afhaal") return 0;
  const ekstra = Math.max(0, Math.round(Number(tarief_sent) || 0) - KOERIER_TRAPPE[0].sent);
  let som = 0;
  while (oor > 0) {
    const n = Math.min(oor, 30);
    som += (KOERIER_TRAPPE.find((t) => n <= t.tot) || KOERIER_TRAPPE[KOERIER_TRAPPE.length - 1]).sent + ekstra;
    oor -= n;
  }
  return som;
}

module.exports = { KOERIER_TRAPPE, drukkoste_sent, boekdeel_sent, skoon_metode, afleweringskoste_sent, koerier_tarief_sent };
