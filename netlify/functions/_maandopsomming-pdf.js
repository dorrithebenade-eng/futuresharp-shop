// netlify/functions/_maandopsomming-pdf.js
// Weergawe 1 (16 Oktober 2026).
//
// Bou die maandopsomming van een boekjaar as 'n PDF: dieselfde tabel as die
// skerm (opening, in, uit, sluit, joernaal netto, verskil en stand per maand)
// met die boekjaar se totale onderaan.
//
// DIE SYFERS WORD NIE HIER BEREKEN NIE. Die skerm stuur die klaar rye, net
// soos by die staat se PDF (_staat-pdf.js), sodat die PDF en die skerm nooit
// uitmekaar kan loop nie.
//
// DIESELFDE VOORKOMS AS DIE STAAT: briefhoof, palet, bedragvorm en voettekst
// kom uit _staat-pdf.js. Die bladsy is egter LANDSKAP, want agt kolomme pas
// nie leesbaar op 'n staande A4 nie.

const { PDFDocument, StandardFonts } = require("pdf-lib");
const S = require("./_staat-pdf");

const BREEDTE = 841.89;
const HOOGTE = 595.28;
const KANT = 40;
const REGS = BREEDTE - KANT;
const ONDERSTE = 80;

// Saldo soos op die bankstaat: R1 234,56 Cr, of Dr as dit oortrokke is.
function saldo(sent) {
  if (sent == null) return "-";
  const n = Number(sent) || 0;
  return S.rand(Math.abs(n)) + (n < 0 ? " Dr" : n > 0 ? " Cr" : "");
}

/**
 * @param {object} data
 *   boekjaar   "2025/26"
 *   van, tot   ISO-datums
 *   rye        [{ maand, opening_sent, in_sent, uit_sent, sluit_sent,
 *                 j_netto_sent, verskil_sent, stand, gedek }]
 *   totale     { in_sent, uit_sent, j_netto_sent }
 *   nota       teks
 * @param {object} maatskappy
 */
async function bou_maandopsomming_pdf(data, maatskappy) {
  const m = maatskappy || {};
  const pdf = await PDFDocument.create();
  const gewoon = await pdf.embedFont(StandardFonts.Helvetica);
  const vet = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Maandopsomming ${data.boekjaar}`);
  pdf.setProducer("Future Sharp");

  const logo = await S.kry_logo();
  let beeld = null;
  if (logo) {
    try { beeld = await pdf.embedPng(logo); } catch (f) { beeld = null; }
  }

  const blaaie = [];
  let bl = null;
  let y = 0;

  const skryf = (teks, x, ty, o = {}) =>
    bl.drawText(String(teks == null ? "" : teks), {
      x, y: ty, size: o.grootte || 9.5, font: o.vet ? vet : gewoon, color: o.kleur || S.SWART,
    });
  const regs = (teks, rx, ty, o = {}) => {
    const t = String(teks == null ? "" : teks);
    skryf(t, rx - (o.vet ? vet : gewoon).widthOfTextAtSize(t, o.grootte || 9.5), ty, o);
  };
  const lyn = (ly, kleur = S.LYN, dik = 0.7) =>
    bl.drawLine({ start: { x: KANT, y: ly }, end: { x: REGS, y: ly }, thickness: dik, color: kleur });

  // Die kolomme: links die maand, dan bedrae regs belyn, dan die stand.
  const K = {
    maand: KANT,
    opening: KANT + 230,
    in: KANT + 330,
    uit: KANT + 420,
    sluit: KANT + 530,
    jnetto: KANT + 630,
    verskil: KANT + 705,
    stand: KANT + 715,
  };

  function kop_rye() {
    const o = { grootte: 7.5, vet: true, kleur: S.GRYS };
    skryf("MAAND", K.maand, y, o);
    regs("OPENING", K.opening, y, o);
    regs("IN", K.in, y, o);
    regs("UIT", K.uit, y, o);
    regs("SLUIT", K.sluit, y, o);
    regs("JOERNAAL NETTO", K.jnetto, y, o);
    regs("VERSKIL", K.verskil, y, o);
    skryf("STAND", K.stand, y, o);
    y -= 6;
    lyn(y);
    y -= 15;
  }

  function nuwe_blad(eerste) {
    bl = pdf.addPage([BREEDTE, HOOGTE]);
    blaaie.push(bl);
    y = HOOGTE - KANT;
    if (!eerste) { y -= 6; kop_rye(); }
  }

  nuwe_blad(true);

  // ── briefhoof ──
  let tx = KANT;
  if (beeld) {
    const h = 46;
    const w = (beeld.width / beeld.height) * h;
    bl.drawImage(beeld, { x: KANT, y: y - h, width: w, height: h });
    tx = KANT + w + 12;
  }
  skryf(m.naam || "Future Sharp NPC", tx, y - 13, { grootte: 14, vet: true, kleur: S.TEAL });
  let ky = y - 27;
  [m.registrasienommer, m.adres, m.epos].forEach((r) => {
    if (!String(r || "").trim()) return;
    skryf(r, tx, ky, { grootte: 8, kleur: S.GRYS });
    ky -= 10;
  });
  y = Math.min(y - 52, ky) - 4;
  lyn(y, S.TEAL, 1.3);
  y -= 24;

  skryf(`Maandopsomming: boekjaar ${data.boekjaar}`, KANT, y, { grootte: 15, vet: true });
  y -= 15;
  skryf(`${S.datum_lank(data.van)} tot ${S.datum_lank(data.tot)} · alle bedrae in Suid-Afrikaanse rand`,
        KANT, y, { grootte: 9.5, kleur: S.GRYS });
  y -= 26;

  kop_rye();

  for (const r of data.rye || []) {
    if (y < ONDERSTE + 40) nuwe_blad(false);
    skryf(r.maand, K.maand, y);
    regs(saldo(r.opening_sent), K.opening, y);
    if (r.gedek) {
      regs(S.rand(r.in_sent), K.in, y);
      regs(S.rand(r.uit_sent), K.uit, y, { kleur: S.KORAAL });
    }
    regs(saldo(r.sluit_sent), K.sluit, y);
    regs(S.rand(r.j_netto_sent), K.jnetto, y);
    if (r.verskil_sent != null) regs(S.rand(r.verskil_sent), K.verskil, y, { kleur: r.verskil_sent ? S.KORAAL : S.SWART });
    skryf(r.stand, K.stand, y, { grootte: 8.5, kleur: r.stand === "Klaar" ? S.TEAL : S.GRYS });
    y -= 8;
    lyn(y);
    y -= 13;
  }

  // ── totale ──
  if (y < ONDERSTE + 40) nuwe_blad(false);
  y -= 2;
  lyn(y + 9, S.SWART, 1);
  const t = data.totale || {};
  skryf("Boekjaar", K.maand, y, { vet: true });
  regs(S.rand(t.in_sent), K.in, y, { vet: true });
  regs(S.rand(t.uit_sent), K.uit, y, { vet: true, kleur: S.KORAAL });
  regs(S.rand(t.j_netto_sent), K.jnetto, y, { vet: true });
  y -= 22;

  if (data.nota) {
    if (y < ONDERSTE + 30) nuwe_blad(false);
    S.breek(data.nota, gewoon, 8.5, REGS - KANT).forEach((r) => {
      skryf(r, KANT, y, { grootte: 8.5, kleur: S.GRYS });
      y -= 11;
    });
  }

  // ── voettekst ──
  const grondslag = "Bestuursopsomming op kontantbasis, deur die Future Sharp Boekhoudingstelsel opgestel.";
  const uitgereik = `Uitgereik ${S.datum_lank(new Date().toISOString())}`;
  blaaie.forEach((blad, i) => {
    bl = blad;
    const vy = 40;
    lyn(vy + 12);
    skryf(grondslag, KANT, vy, { grootte: 7.5, kleur: S.GRYS });
    regs(uitgereik, REGS, vy, { grootte: 7.5, kleur: S.GRYS });
    regs(`Bladsy ${i + 1} van ${blaaie.length}`, REGS, vy - 10, { grootte: 7.5, kleur: S.GRYS });
  });

  return await pdf.save();
}

module.exports = { bou_maandopsomming_pdf };
