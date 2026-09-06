// netlify/functions/_staat-pdf.js
//
// Bou die staat van inkomste en uitgawes as 'n PDF.
//
// DIE SYFERS WORD NIE HIER BEREKEN NIE.
//
// Die staat se optelwerk -- die boom, die eie bedrae teenoor die totale, die
// stapsgewyse aftrekking per uitgawekop -- leef in
// public/js/faktuurpaneel-fin-staat.js. Sou hierdie leer dit oordoen, kon die
// PDF en die skerm uitmekaar loop sonder dat iemand dit sien, en dan is die
// vraag watter een die waarheid is.
//
// Die skerm stuur dus die REEDS BEREKENDE reels; hierdie leer teken hulle.
// Een bron vir die syfers.
//
// WAT DIE PDF NIE DRA NIE. Die hostingvergelyking, die rekonsiliasie en die
// "wag vir 'n kategorie"-lys is werkhulpmiddels. Hulle hoort op die skerm van
// die persoon wat die boeke doen, nie op 'n dokument wat aan 'n derde party
// gaan.
//
// DIESELFDE VOORKOMS AS DIE FAKTUUR. Kant, palet, logo en Helvetica kom uit
// _faktuur-pdf.js se patroon. 'n Tweede uitleg vir dieselfde onderneming sou
// beteken dat 'n leser twee dokumente moet leer ken.

const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

// ── palet, uit styl.css se :root ──
const TEAL = rgb(0x47 / 255, 0x9f / 255, 0x91 / 255);
const SWART = rgb(0x17 / 255, 0x17 / 255, 0x17 / 255);
const GRYS = rgb(0x5b / 255, 0x5b / 255, 0x5b / 255);
const KORAAL = rgb(0xe8 / 255, 0x58 / 255, 0x2c / 255);
const LYN = rgb(0xe7 / 255, 0xe4 / 255, 0xde / 255);

const BREEDTE = 595.28;
const HOOGTE = 841.89;
const KANT = 46;
const REGS = BREEDTE - KANT;

// Waar 'n nuwe bladsy begin word. Onder hierdie punt pas geen ry meer nie
// sonder om die voettekst te tref.
const ONDERSTE = 96;

let logo_grepe = null;

async function kry_logo() {
  if (logo_grepe !== null) return logo_grepe;
  try {
    const basis = process.env.URL || `https://${process.env.SITE_NAME}.netlify.app`;
    const resp = await fetch(`${basis}/images/future-sharp-logo.png`);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    logo_grepe = new Uint8Array(await resp.arrayBuffer());
  } catch (fout) {
    // Nie fataal nie. 'n Staat sonder logo is 'n staat.
    console.error("Staat-PDF: kon nie die logo haal nie:", fout && fout.message);
    logo_grepe = false;
  }
  return logo_grepe;
}

// R1 234,56 -- spasie as duisendskeier, komma as desimaal, soos oral in
// hierdie stelsel. Die minus staan VOOR die R, want dit hoort by die bedrag
// en nie by die eenheid nie.
//
// 'n GEWONE KOPPELTEKEN, NIE U+2212 NIE. Helvetica word in WinAnsi gekodeer
// en pdf-lib breek op 'n wiskundige minus: `WinAnsi cannot encode "-"`.
// Op die skerm is U+2212 reg; in die PDF nie.
function rand(sent) {
  const n = Number(sent) || 0;
  const teken = n < 0 ? "- " : "";
  const heel = Math.floor(Math.abs(n) / 100);
  const res = String(Math.abs(n) % 100).padStart(2, "0");
  return `${teken}R${String(heel).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")},${res}`;
}

function datum_lank(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const maande = ["Januarie", "Februarie", "Maart", "April", "Mei", "Junie",
                  "Julie", "Augustus", "September", "Oktober", "November", "Desember"];
  return `${d.getDate()} ${maande[d.getMonth()]} ${d.getFullYear()}`;
}

// Breek teks oor reels binne 'n gegewe breedte. pdf-lib doen dit nie self nie.
function breek(teks, font, grootte, breedte) {
  const woorde = String(teks || "").split(/\s+/).filter(Boolean);
  const reels = [];
  let huidig = "";
  for (const w of woorde) {
    const probeer = huidig ? `${huidig} ${w}` : w;
    if (font.widthOfTextAtSize(probeer, grootte) <= breedte) {
      huidig = probeer;
    } else {
      if (huidig) reels.push(huidig);
      huidig = w;
    }
  }
  if (huidig) reels.push(huidig);
  return reels;
}

/**
 * @param {object} data
 *   van, tot            ISO-datums
 *   blokke              [{ titel, rye: [{ naam, vlak, eie_sent, totaal_sent, hoof }],
 *                          som_sent }]
 *   slot                [{ naam, bedrag_sent, soort: "reel"|"aftrek"|"tussen"|"som" }]
 *   nota                { kop, teks } of null
 * @param {object} maatskappy  uit _instellings.js
 * @returns {Promise<Uint8Array>}
 */
async function bou_staat_pdf(data, maatskappy) {
  const m = maatskappy || {};
  const pdf = await PDFDocument.create();
  const gewoon = await pdf.embedFont(StandardFonts.Helvetica);
  const vet = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.setTitle(`Staat van inkomste en uitgawes ${data.van} tot ${data.tot}`);
  pdf.setProducer("Future Sharp");

  const logo = await kry_logo();
  let beeld = null;
  if (logo) {
    try {
      beeld = await pdf.embedPng(logo);
    } catch (fout) {
      console.error("Staat-PDF: kon nie die logo inbed nie:", fout && fout.message);
    }
  }

  const blaaie = [];
  let bl = null;
  let y = 0;

  const skryf = (teks, x, ty, o = {}) =>
    bl.drawText(String(teks == null ? "" : teks), {
      x, y: ty,
      size: o.grootte || 10,
      font: o.vet ? vet : gewoon,
      color: o.kleur || SWART,
    });

  const regs = (teks, regs_x, ty, o = {}) => {
    const t = String(teks == null ? "" : teks);
    const f = o.vet ? vet : gewoon;
    const g = o.grootte || 10;
    skryf(t, regs_x - f.widthOfTextAtSize(t, g), ty, o);
  };

  const lyn = (ly, kleur = LYN, dik = 0.7) =>
    bl.drawLine({ start: { x: KANT, y: ly }, end: { x: REGS, y: ly },
                  thickness: dik, color: kleur });

  // 'n NUWE BLADSY DRA DIE BRIEFHOOF NIE, net die tabel. Die kop hoort op die
  // eerste bladsy; die voettekst op elke een, en dit word aan die einde
  // geteken wanneer die aantal bladsye bekend is.
  function nuwe_blad(eerste) {
    bl = pdf.addPage([BREEDTE, HOOGTE]);
    blaaie.push(bl);
    y = HOOGTE - KANT;
    if (!eerste) y -= 10;
  }

  function ruimte(nodig) {
    if (y - nodig < ONDERSTE) nuwe_blad(false);
  }

  nuwe_blad(true);

  // ── die briefhoof ──────────────────────────────────────────────────────
  let teks_x = KANT;
  if (beeld) {
    const h = 54;
    const w = (beeld.width / beeld.height) * h;
    bl.drawImage(beeld, { x: KANT, y: y - h, width: w, height: h });
    teks_x = KANT + w + 14;
  }

  skryf(m.naam || "Future Sharp NPC", teks_x, y - 14, { grootte: 15, vet: true, kleur: TEAL });
  let ky = y - 29;
  [m.registrasienommer, m.adres, m.epos].forEach((reel) => {
    if (!String(reel || "").trim()) return;
    breek(reel, gewoon, 8.5, 250).forEach((r) => {
      skryf(r, teks_x, ky, { grootte: 8.5, kleur: GRYS });
      ky -= 11;
    });
  });

  y = Math.min(y - 60, ky) - 6;
  lyn(y, TEAL, 1.4);
  y -= 26;

  // ── titel en tydperk ───────────────────────────────────────────────────
  skryf("Staat van inkomste en uitgawes", KANT, y, { grootte: 16, vet: true });
  y -= 16;
  skryf(`${datum_lank(data.van)} tot ${datum_lank(data.tot)}`, KANT, y,
        { grootte: 10, kleur: GRYS });
  y -= 12;
  skryf("Alle bedrae in Suid-Afrikaanse rand", KANT, y, { grootte: 8.5, kleur: GRYS });
  y -= 24;

  // ── die blokke ─────────────────────────────────────────────────────────
  //
  // TWEE BEDRAGKOLOMME, soos op die skerm: die kategorie se EIE bedrag en die
  // totaal met haar subkategoriee ingesluit. 'n Hoofkategorie sonder eie
  // inskrywings laat die eerste kolom leeg -- dan lees 'n mens dadelik dat
  // die getal 'n optelsom is en nie 'n inskrywing nie.
  const EIE_X = REGS - 130;
  const TOT_X = REGS;

  for (const blok of data.blokke || []) {
    if (!blok || !Array.isArray(blok.rye) || !blok.rye.length) continue;

    ruimte(70);
    skryf(String(blok.titel || "").toUpperCase(), KANT, y,
          { grootte: 9, vet: true, kleur: TEAL });
    y -= 6;
    lyn(y);
    y -= 15;

    for (const r of blok.rye) {
      ruimte(30);
      const inspring = KANT + Math.min(Number(r.vlak) || 0, 4) * 14;
      skryf(r.naam, inspring, y, { grootte: 10, vet: Boolean(r.hoof) });
      if (r.eie_sent) regs(rand(r.eie_sent), EIE_X, y, { grootte: 10, kleur: GRYS });
      regs(rand(r.totaal_sent), TOT_X, y, { grootte: 10, vet: Boolean(r.hoof) });
      y -= 17;
    }

    ruimte(28);
    y -= 3;
    lyn(y);
    y -= 15;
    skryf(blok.titel, KANT, y, { grootte: 10, vet: true });
    regs(rand(blok.som_sent), TOT_X, y, { grootte: 10, vet: true });
    y -= 26;
  }

  // ── die slottabel ──────────────────────────────────────────────────────
  ruimte(40 + (data.slot || []).length * 18);
  y -= 4;
  lyn(y, GRYS, 1);
  y -= 17;

  for (const r of data.slot || []) {
    ruimte(30);
    const is_som = r.soort === "som";
    const is_aftrek = r.soort === "aftrek";

    if (is_som) {
      // 'n DUBBELE LYN OM DIE SURPLUS, soos 'n staat dit dra. Die boonste een
      // word HIER geteken, bo die teks; die onderste nadat y afgeskuif het.
      y -= 6;
      lyn(y + 20, SWART, 1);
    }
    skryf(r.naam, KANT, y, {
      grootte: is_som ? 12 : 10,
      vet: is_som || r.soort === "tussen",
      kleur: is_aftrek ? KORAAL : SWART,
    });
    regs(is_aftrek ? `- ${rand(r.bedrag_sent)}` : rand(r.bedrag_sent), TOT_X, y, {
      grootte: is_som ? 12 : 10,
      vet: is_som || r.soort === "tussen",
      kleur: is_aftrek ? KORAAL : SWART,
    });
    y -= is_som ? 24 : 17;
    if (is_som) lyn(y + 10, SWART, 1);
  }

  // ── die nota ───────────────────────────────────────────────────────────
  if (data.nota && data.nota.teks) {
    ruimte(70);
    y -= 16;
    skryf(String(data.nota.kop || "").toUpperCase(), KANT, y,
          { grootte: 8.5, vet: true, kleur: GRYS });
    y -= 13;
    breek(data.nota.teks, gewoon, 9, REGS - KANT).forEach((r) => {
      skryf(r, KANT, y, { grootte: 9, kleur: GRYS });
      y -= 12;
    });
  }

  // ── die voettekst, op elke bladsy ──────────────────────────────────────
  //
  // Dit word HIER geteken en nie tydens die bou nie, want die aantal bladsye
  // is eers nou bekend. Die reel oor die grondslag staan op elke bladsy: 'n
  // bladsy wat alleen aangestuur word, moet self se wat dit is.
  const grondslag =
    "Bestuurstaat op kontantbasis, deur die Future Sharp Boekhoudingstelsel opgestel.";
  const uitgereik = `Uitgereik ${datum_lank(new Date().toISOString())}`;

  blaaie.forEach((blad, i) => {
    bl = blad;
    const vy = 58;
    lyn(vy + 12);
    skryf(grondslag, KANT, vy, { grootte: 7.5, kleur: GRYS });
    regs(uitgereik, REGS, vy, { grootte: 7.5, kleur: GRYS });
    regs(`Bladsy ${i + 1} van ${blaaie.length}`, REGS, vy - 10, { grootte: 7.5, kleur: GRYS });
  });

  return await pdf.save();
}

module.exports = { bou_staat_pdf };
