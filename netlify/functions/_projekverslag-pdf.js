// netlify/functions/_projekverslag-pdf.js
// Weergawe 1 (17 Oktober 2026).
//
// Bou die projekverslag van een boekjaar as 'n PDF: dieselfde tabel as die
// skerm, gegroepeer volgens finansiering, met subtotale en die totaal.
//
// DIE SYFERS WORD NIE HIER BEREKEN NIE. Die skerm stuur die klaar rye
// (faktuurpaneel-projekverslag.js), soos by die staat en die maandopsomming.
//
// DIESELFDE VOORKOMS: briefhoof, palet, bedragvorm en voettekst kom uit
// _staat-pdf.js. LANDSKAP, soos die maandopsomming, want agt kolomme pas nie
// leesbaar op 'n staande A4 nie.

const { PDFDocument, StandardFonts } = require("pdf-lib");
const S = require("./_staat-pdf");

const BREEDTE = 841.89;
const HOOGTE = 595.28;
const KANT = 40;
const REGS = BREEDTE - KANT;
const ONDERSTE = 80;

async function bou_projekverslag_pdf(data, maatskappy) {
  const m = maatskappy || {};
  const pdf = await PDFDocument.create();
  const gewoon = await pdf.embedFont(StandardFonts.Helvetica);
  const vet = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Projekverslag ${data.boekjaar}`);
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
  // Kort teks tot die breedte wat beskikbaar is.
  const pas = (teks, breedte, grootte, font) => {
    let s = String(teks || "");
    const f = font || gewoon;
    if (f.widthOfTextAtSize(s, grootte) <= breedte) return s;
    while (s.length > 1 && f.widthOfTextAtSize(s + "…", grootte) > breedte) s = s.slice(0, -1);
    return s + "…";
  };

  const K = {
    nr: KANT,
    projek: KANT + 66,
    instansie: KANT + 290,
    ontvang: KANT + 445,
    koste: KANT + 530,
    oor: KANT + 615,
    bydrae: KANT + 660,
    uitstaande: KANT + 672,
  };

  function kop_rye() {
    const o = { grootte: 7.5, vet: true, kleur: S.GRYS };
    skryf("NR", K.nr, y, o);
    skryf("PROJEK", K.projek, y, o);
    skryf("INSTANSIE", K.instansie, y, o);
    regs("ONTVANG", K.ontvang, y, o);
    regs("PROJEKKOSTE", K.koste, y, o);
    regs("OOR", K.oor, y, o);
    regs("BYDRAE", K.bydrae, y, o);
    skryf("UITSTAANDE", K.uitstaande, y, o);
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

  skryf(`Projekverslag: boekjaar ${data.boekjaar}`, KANT, y, { grootte: 15, vet: true });
  y -= 15;
  skryf(`${S.datum_lank(data.van)} tot ${S.datum_lank(data.tot)}`, KANT, y, { grootte: 9.5, kleur: S.GRYS });
  y -= 22;

  // ── die vier syfers ──
  const tl = data.teels || {};
  const teel_b = (REGS - KANT - 3 * 10) / 4;
  [
    ["PROJEKTE", String(tl.projekte || 0), `${tl.aktief || 0} aktief`],
    ["ONTVANG", S.rand(tl.ontvang_sent), "op projekte"],
    ["PROJEKKOSTE", S.rand(tl.koste_sent), `waarvan ${S.rand(tl.vergoeding_sent)} vergoeding`],
    ["OOR NA PROJEKKOSTE", S.rand(tl.oor_sent), "beskikbaar vir bedryfskoste"],
  ].forEach(([e, b, k], i) => {
    const x = KANT + i * (teel_b + 10);
    skryf(e, x, y, { grootte: 7.5, vet: true, kleur: S.GRYS });
    skryf(b, x, y - 15, { grootte: 13, vet: true });
    skryf(k, x, y - 27, { grootte: 8, kleur: S.GRYS });
  });
  y -= 50;

  kop_rye();

  const bedrae = (r, o) => {
    regs(S.rand(r.ontvang_sent), K.ontvang, y, o);
    regs(S.rand(r.koste_sent), K.koste, y, { ...o, kleur: S.KORAAL });
    regs(S.rand(r.oor_sent), K.oor, y, o);
  };

  for (const g of data.groepe || []) {
    if (y < ONDERSTE + 50) nuwe_blad(false);
    skryf(String(g.titel || "").toUpperCase(), K.nr, y, { grootte: 8, vet: true, kleur: S.TEAL });
    y -= 15;
    for (const r of g.rye || []) {
      if (y < ONDERSTE + 40) nuwe_blad(false);
      skryf(r.nr, K.nr, y, { vet: true, grootte: 9 });
      skryf(pas(r.naam, K.instansie - K.projek - 10, 9.5), K.projek, y);
      skryf(pas(r.instansie, K.ontvang - 62 - K.instansie, 9), K.instansie, y, { grootte: 9 });
      bedrae(r, {});
      regs(r.bydrae, K.bydrae, y, { grootte: 9 });
      // Uitstaande breek oor hoogstens twee reels.
      const u = S.breek(r.uitstaande || "niks", gewoon, 8, REGS - K.uitstaande).slice(0, 2);
      u.forEach((reel, i) => skryf(reel, K.uitstaande, y - i * 10, { grootte: 8, kleur: r.uitstaande ? S.KORAAL : S.GRYS }));
      const onder = [r.besonder, r.nog_bestee ? "oor is nog te bestee" : ""].filter(Boolean).join(" · ");
      if (onder) {
        y -= 11;
        skryf(pas(onder, K.ontvang - 90 - K.projek, 7.5), K.projek, y, { grootte: 7.5, kleur: S.GRYS });
      } else if (u.length > 1) {
        y -= 10;
      }
      y -= 8;
      lyn(y);
      y -= 13;
    }
    if (g.sub) {
      if (y < ONDERSTE + 30) nuwe_blad(false);
      skryf("Subtotaal", K.projek, y, { vet: true });
      bedrae(g.sub, { vet: true });
      y -= 8;
      lyn(y, S.GRYS);
      y -= 15;
    }
    y -= 4;
  }

  // ── totaal ──
  if (y < ONDERSTE + 40) nuwe_blad(false);
  lyn(y + 9, S.SWART, 1);
  skryf("Totaal", K.projek, y, { vet: true });
  bedrae(data.totaal || {}, { vet: true });
  y -= 24;

  if (y < ONDERSTE + 30) nuwe_blad(false);
  S.breek(
    "Ontvang en projekkoste is die geld wat in die boekjaar op elke projek in- en uitgegaan het. Bydrae is die deel van wat ontvang is wat by Future Sharp bly; by 'n toelae of skenking word dit nie gewys nie, want die oorblywende geld is beperk tot die projek.",
    gewoon, 8.5, REGS - KANT
  ).forEach((r) => {
    skryf(r, KANT, y, { grootte: 8.5, kleur: S.GRYS });
    y -= 11;
  });

  // ── voettekst ──
  const grondslag = "Bestuursverslag op kontantbasis, deur die Future Sharp Boekhoudingstelsel opgestel.";
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

module.exports = { bou_projekverslag_pdf };
