// netlify/functions/_faktuur-pdf.js
//
// Bou die proforma as 'n PDF, op die bediener, sodat hy by die e-pos
// aangeheg kan word.
//
// WAAROM 'N AANHEGSEL EN NIE 'N SKAKEL NIE: 'n skool se finansiële afdeling
// laai 'n PDF in sy eie stelsel. 'n Skakel help hulle nie — hulle moet 'n
// dokument hê om te liasseer, en 'n proforma wat eers oopgemaak en gedruk
// moet word, is 'n stap wat iemand anders moet doen voordat hy betaal kan
// word.
//
// ─────────────────────────────────────────────────────────────────────────
// EEN BRON VIR DIE WOORDE.
//
// Die dokument se terme kom uit taal.js se WOORDEBOEK — dieselfde lêer wat
// die skerm laai — met t_in(sleutel, taal) en die FAKTUUR se eie taalveld.
// 'n Tweede woordelys hier sou beteken die PDF en die skerm kan uitmekaar
// loop sonder dat iemand dit sien.
// ─────────────────────────────────────────────────────────────────────────
//
// HELVETICA, NIE MONTSERRAT EN POPPINS NIE. Om 'n eie lettertipe in te bed,
// verg fontkit plus sowat 300KB per Function. Die uitleg, die kleure en die
// inhoud is dieselfde as die skerm s'n; net die letters verskil. Wil 'n mens
// dit ooit presies hê, is dit `@pdf-lib/fontkit` en twee TTF-lêers.
//
// DIE QR WORD AS BLOKKIES GETEKEN, nie as 'n beeld nie. qrcode-generator gee
// vir elke module 'n waar/onwaar, en 'n reghoek per donker module is skerper
// as enige gerasterde beeld — en dit spaar 'n beeld-inbedding.

const { PDFDocument, StandardFonts, PDFString, PDFName, rgb } = require("pdf-lib");
const qrcode = require("../../public/js/qrcode.js");
const { t_in, t_rand } = require("../../public/js/taal.js");
const { datum_dokument } = require("./_fakture");

// ── palet, uit styl.css se :root ──
const TEAL = rgb(0x47 / 255, 0x9f / 255, 0x91 / 255);
const SWART = rgb(0x17 / 255, 0x17 / 255, 0x17 / 255);
const GRYS = rgb(0x5b / 255, 0x5b / 255, 0x5b / 255);
const LYN = rgb(0xe7 / 255, 0xe4 / 255, 0xde / 255);
const LIG = rgb(0xf7 / 255, 0xf6 / 255, 0xf4 / 255);

// A4 in punte.
const BREEDTE = 595.28;
const HOOGTE = 841.89;
const KANT = 46;
const REGS = BREEDTE - KANT;

// Die logo word EEN KEER gehaal en in module-skoop gehou. 'n Function-instansie
// bedien meer as een oproep, en die logo verander nooit tussen hulle nie.
let logo_grepe = null;

async function kry_logo() {
  if (logo_grepe !== null) return logo_grepe;
  try {
    const basis = process.env.URL || `https://${process.env.SITE_NAME}.netlify.app`;
    const resp = await fetch(`${basis}/images/future-sharp-logo.png`);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    logo_grepe = new Uint8Array(await resp.arrayBuffer());
  } catch (fout) {
    // Nie fataal nie. 'n Faktuur sonder logo is 'n faktuur; 'n faktuur wat
    // nie uitgaan nie, is niks.
    console.error("PDF: kon nie die logo haal nie:", fout && fout.message);
    logo_grepe = false;
  }
  return logo_grepe;
}

function datum_kort(iso, taal) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const maande = t_in("fd_maande", taal).split(",");
  return `${d.getDate()} ${maande[d.getMonth()]} ${d.getFullYear()}`;
}

// 'n Datumveld word as JJJJ-MM-DD gestoor en so op die skerm gedruk.
// Die omskakeling leef in _fakture.js, want stuur-faktuur.js se pos dra
// dieselfde datum en het presies dieselfde fout gehad.
function datum_veld(waarde) {
  return datum_dokument(waarde);
}

// Breek teks oor reëls binne 'n gegewe breedte. pdf-lib doen dit nie self
// nie, en 'n adres of 'n aantekening wat oor die rand loop, word stilweg
// afgesny.
function breek(teks, font, grootte, maks) {
  const uit = [];
  String(teks || "")
    .split(/\r?\n/)
    .forEach((paragraaf) => {
      const woorde = paragraaf.split(/\s+/).filter(Boolean);
      if (!woorde.length) {
        uit.push("");
        return;
      }
      let reel = "";
      woorde.forEach((w) => {
        const poging = reel ? `${reel} ${w}` : w;
        if (font.widthOfTextAtSize(poging, grootte) <= maks) {
          reel = poging;
        } else {
          if (reel) uit.push(reel);
          reel = w;
        }
      });
      if (reel) uit.push(reel);
    });
  return uit;
}

/**
 * Bou die proforma as 'n PDF.
 *
 * @param {object} rekord      die faktuur, met sy gevriesde velde
 * @param {object} maatskappy  uit _instellings.js
 * @returns {Promise<Uint8Array>}
 */
/* EEN LEER, TWEE DOKUMENTE.

   'n Kwotasie is dieselfde uitleg met ander woorde en EEN BLOK MINDER. Twee
   lers sou beteken 'n regstelling aan die een word later op die ander vergeet
   -- en albei gaan na 'n klient se finansiele afdeling.

   WAT VERSKIL:
     die etiket bo die nommer      Kwotasie      i.p.v. Proforma-faktuur
     wie dit ontvang               Gekwoteer aan i.p.v. Gefaktureer aan
     die datumveld                 Geldig tot    i.p.v. Betaalbaar teen
     die slotsom                   Totaal        i.p.v. Totaal verskuldig
     die hersieningsmerk           slegs vanaf hersiening 2
     die betaalblok                VAL WEG

   DIE BETAALBLOK VAL WEG, en dit is die belangrikste een. 'n Kwotasie is nie
   betaalbaar nie. 'n Bankrekening op 'n aanbod nooi 'n betaling uit vir iets
   wat nog nie gefaktureer is nie, en dan land geld in die hoofrekening sonder
   'n faktuur om dit teen af te skryf. In sy plek staan die geldigheidsband. */
async function bou_faktuur_pdf(rekord, maatskappy, opsies) {
  const taal = rekord.taal === "en" ? "en" : "af";
  const m = maatskappy || {};
  const IS_KW = Boolean(opsies && opsies.soort === "kwotasie");

  const pdf = await PDFDocument.create();
  const bl = pdf.addPage([BREEDTE, HOOGTE]);
  const gewoon = await pdf.embedFont(StandardFonts.Helvetica);
  const vet = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.setTitle(`${(rekord.nommer || "").replace(/\//g, "-")} — ${m.naam || ""}`);
  pdf.setProducer("Future Sharp");

  const skryf = (teks, x, y, opsies = {}) => {
    bl.drawText(String(teks == null ? "" : teks), {
      x,
      y,
      size: opsies.grootte || 10,
      font: opsies.vet ? vet : gewoon,
      color: opsies.kleur || SWART,
    });
  };

  const regs_skryf = (teks, regs_x, y, opsies = {}) => {
    const t = String(teks == null ? "" : teks);
    const f = opsies.vet ? vet : gewoon;
    const g = opsies.grootte || 10;
    skryf(t, regs_x - f.widthOfTextAtSize(t, g), y, opsies);
  };

  let y = HOOGTE - KANT;

  // ── die kop ────────────────────────────────────────────────────────────
  const logo = await kry_logo();
  let teks_x = KANT;
  if (logo) {
    try {
      const beeld = await pdf.embedPng(logo);
      // Die logo is STAANDE (354x545). Op 'n faktuurkop, wat breed en laag
      // is, word hy op HOOGTE begrens en die breedte volg — begrens 'n mens
      // hom op breedte, vul hy die halwe bladsy.
      const h = 54;
      const w = (beeld.width / beeld.height) * h;
      bl.drawImage(beeld, { x: KANT, y: y - h, width: w, height: h });
      teks_x = KANT + w + 14;
    } catch (fout) {
      console.error("PDF: kon nie die logo inbed nie:", fout && fout.message);
    }
  }

  skryf(m.naam || "", teks_x, y - 14, { grootte: 15, vet: true, kleur: TEAL });
  let ky = y - 29;
  [m.registrasienommer, m.adres, m.epos].forEach((reel) => {
    if (!String(reel || "").trim()) return;
    breek(reel, gewoon, 8.5, 250).forEach((r) => {
      skryf(r, teks_x, ky, { grootte: 8.5, kleur: GRYS });
      ky -= 11;
    });
  });

  regs_skryf(
    t_in(IS_KW ? "fd_kwotasie" : "fd_proforma", taal).toUpperCase(),
    REGS,
    y - 10,
    { grootte: 7.5, kleur: GRYS }
  );
  regs_skryf(rekord.nommer || t_in("fd_stand_konsep", taal), REGS, y - 30, {
    grootte: 20,
    vet: true,
  });

  /* DIE HERSIENINGSMERK. Die nommer bly deur die hele onderhandeling dieselfde,
     dus kan die klient twee uitdrukke met KW/01962 op sy lessenaar he en twee
     verskillende totale. Eers vanaf hersiening 2: 'n eerste aanbod wat
     "Hersiening 1" lees, laat 'n mens wonder wat jy gemis het. */
  const hersiening = Number(rekord.hersiening) || 1;
  if (IS_KW && hersiening > 1) {
    regs_skryf(
      `${t_in("fd_kw_hersiening", taal).toUpperCase()} ${hersiening}`,
      REGS,
      y - 44,
      { grootte: 7.5, kleur: GRYS }
    );
  }

  y = Math.min(ky, y - 62) - 12;

  // Die teal reël onder die kop.
  bl.drawRectangle({ x: KANT, y, width: REGS - KANT, height: 1.6, color: TEAL });
  y -= 26;

  // ── gefaktureer aan / besonderhede ─────────────────────────────────────
  const mid = KANT + (REGS - KANT) * 0.55;

  skryf(t_in(IS_KW ? "fd_gekwoteer_aan" : "fd_gefaktureer_aan", taal).toUpperCase(), KANT, y, {
    grootte: 7.5,
    kleur: GRYS,
  });
  skryf(t_in("fd_besonderhede", taal).toUpperCase(), mid, y, {
    grootte: 7.5,
    kleur: GRYS,
  });
  y -= 16;

  const klient = rekord.klient || {};
  let ly = y;
  skryf(klient.naam || "", KANT, ly, { grootte: 11, vet: true });
  ly -= 15;
  [klient.kontak, klient.adres].forEach((reel) => {
    if (!String(reel || "").trim()) return;
    breek(reel, gewoon, 9.5, mid - KANT - 20).forEach((r) => {
      skryf(r, KANT, ly, { grootte: 9.5, kleur: GRYS });
      ly -= 13;
    });
  });

  let ry = y;
  const besonderheid = (etiket, waarde) => {
    if (!String(waarde || "").trim()) return;
    skryf(etiket, mid, ry, { grootte: 9.5, kleur: GRYS });
    regs_skryf(waarde, REGS, ry, { grootte: 9.5, vet: true });
    ry -= 15;
  };
  // `dokument_datum` is die enigste datum wat op die dokument hoort. Die twee
  // agter hom is die terugval vir rekords van voor 4 September 2026.
  besonderheid(
    t_in("fd_datum", taal),
    datum_kort(rekord.dokument_datum || rekord.uitgereik_op || rekord.geskep_op, taal)
  );
  // ELKE DOKUMENT SE EIE DATUMVELD. `geldig_tot` KEER die aanvaarding;
  // `betaalbaar_teen` keer niks. Twee velde met twee betekenisse.
  if (IS_KW) besonderheid(t_in("fd_geldig_tot", taal), datum_veld(rekord.geldig_tot));
  else besonderheid(t_in("fd_betaalbaar_teen", taal), datum_veld(rekord.betaalbaar_teen));
  besonderheid(t_in("fd_bestelnommer", taal), rekord.bestelnommer);

  y = Math.min(ly, ry) - 14;

  // ── die reëls ──────────────────────────────────────────────────────────
  const k_hoev = KANT + (REGS - KANT) * 0.56;
  const k_prys = KANT + (REGS - KANT) * 0.75;
  const k_bedr = REGS;

  skryf(t_in("fd_kol_beskrywing", taal).toUpperCase(), KANT, y, { grootte: 7.5, kleur: GRYS });
  regs_skryf(t_in("fd_kol_hoeveelheid", taal).toUpperCase(), k_hoev, y, { grootte: 7.5, kleur: GRYS });
  regs_skryf(t_in("fd_kol_eenheidsprys", taal).toUpperCase(), k_prys, y, { grootte: 7.5, kleur: GRYS });
  regs_skryf(t_in("fd_kol_bedrag", taal).toUpperCase(), k_bedr, y, { grootte: 7.5, kleur: GRYS });
  y -= 8;
  bl.drawRectangle({ x: KANT, y, width: REGS - KANT, height: 0.7, color: LYN });
  y -= 18;

  /* DIE REELS WORD GEGROEPEER VOORDAT HULLE DRUK.

     'n Reel met `vou_in` se bedrag tel by die reel BO HAAR. Die VOLGORDE is
     dus die groepering: geen tweede naamveld nie, want die naam wat die klient
     sien, is 'n gewone reel wat reeds getik word. Sien
     Reels-Invou-En-Volgorde-Ontwerp.md.

     DIT IS DIESELFDE SOM AS groepeer_vir_druk() IN faktuur-vorm.js, en dit
     MOET dieselfde bly: die skerm se voorskou en hierdie dokument moet
     identies wees, anders sien 'n mens een ding voor die uitreiking en die
     klient 'n ander daarna.

     ELKE REEL HOORT AAN PRESIES EEN GROEP, dus tel die gedrukte bedrae altyd
     tot die totaal. Dit mag nooit op 'n dokument breek nie.

     'n GROEP DRA GEEN HOEVEELHEID EN GEEN EENHEIDSPRYS NIE. Drie items met
     verskillende eenhede het nie een eenheidsprys nie, en 'n "1" daar sou se
     die groep is een ding wat een keer gekoop is. */
  const gedruk = [];
  (rekord.reels || []).forEach((r) => {
    const hoev = Number(r.hoeveelheid) || 0;
    const prys = Number(r.prys_pp_sent) || 0;
    const bedrag = Math.round(hoev * prys);

    // Die EERSTE reel vou nooit in nie -- daar is niks bo haar nie.
    // stoor-faktuur.js dwing dit ook af; hierdie toets is die tweede slot.
    if (r.vou_in !== true || !gedruk.length) {
      gedruk.push({ beskrywing: r.beskrywing || "", hoev, prys, bedrag, lede: 0 });
    } else {
      const g = gedruk[gedruk.length - 1];
      g.bedrag += bedrag;
      g.lede += 1;
    }
  });

  gedruk.forEach((g) => {
    const reels = breek(g.beskrywing, gewoon, 10, k_hoev - KANT - 30);
    reels.forEach((teks, i) => skryf(teks, KANT, y - i * 13, { grootte: 10 }));

    if (!g.lede) {
      regs_skryf(String(g.hoev), k_hoev, y, { grootte: 10 });
      regs_skryf(t_rand(g.prys, taal).replace(/^R/, ""), k_prys, y, { grootte: 10 });
    }
    regs_skryf(t_rand(g.bedrag, taal), k_bedr, y, { grootte: 10, vet: true });

    y -= Math.max(1, reels.length) * 13 + 7;
    bl.drawRectangle({ x: KANT, y: y + 6, width: REGS - KANT, height: 0.7, color: LYN });
    y -= 12;
  });

  // ── die totale ─────────────────────────────────────────────────────────
  const t_links = KANT + (REGS - KANT) * 0.52;
  const som = (etiket, bedrag, sterk) => {
    skryf(etiket, t_links, y, { grootte: sterk ? 11 : 9.5, vet: sterk, kleur: sterk ? SWART : GRYS });
    regs_skryf(t_rand(bedrag, taal), REGS, y, { grootte: sterk ? 12 : 9.5, vet: true });
    y -= sterk ? 20 : 15;
  };

  const reelsom = (rekord.reels || []).reduce(
    (s, r) => s + Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0)),
    0
  );
  const afslag = Number(rekord.afslag_sent) || 0;
  const skenking = Number(rekord.skenking_sent) || 0;

  y -= 4;
  if (afslag > 0 || skenking > 0) {
    som(t_in("fd_subtotaal", taal), reelsom, false);
    if (afslag > 0) som(t_in("fd_afslag", taal), -afslag, false);
    if (skenking > 0) som(t_in("fd_skenking", taal), skenking, false);
  }

  bl.drawRectangle({ x: t_links, y: y + 12, width: REGS - t_links, height: 1.2, color: SWART });
  y -= 6;
  som(
    t_in(IS_KW ? "fd_totaal" : "fd_totaal_verskuldig", taal),
    Number(rekord.totaal_sent) || 0,
    true
  );
  y -= 12;

  /* ── die aantekening ───────────────────────────────────────────────────

     `dokument_nota`, NIE `nota` NIE. Albei rekords — die faktuur en die
     kwotasie — stoor die dokument se aantekening as `dokument_nota`. Hierdie
     blok het `rekord.nota` gelees, wat op geen van die twee bestaan nie, dus
     het die aantekening nog NOOIT op enige PDF verskyn nie. Op die skerm het sy
     altyd reg gewys, want die vorm lees die regte veld.

     `nota` bly as terugval staan vir 'n ou rekord wat dit dalk dra; die skoon
     lees hieronder keer dat 'n leefwit waarde 'n leë opskrif druk. */
  const aantekening = String(rekord.dokument_nota || rekord.nota || "").trim();
  if (aantekening) {
    skryf(t_in("fd_aantekening", taal).toUpperCase(), KANT, y, { grootte: 7.5, kleur: GRYS });
    y -= 15;
    breek(aantekening, gewoon, 9.5, REGS - KANT).forEach((r) => {
      skryf(r, KANT, y, { grootte: 9.5 });
      y -= 13;
    });
    y -= 12;
  }

  /* ══ DIE GELDIGHEIDSBAND — SLEGS OP 'N KWOTASIE ══════════════════

     In die plek van die betaalblok. Sy se twee dinge: tot wanneer die aanbod
     staan, en wat gebeur as die klient hom aanvaar. Geen bankrekening, geen
     QR, geen betaalknoppie -- 'n kwotasie is nie betaalbaar nie. */
  if (IS_KW) {
    const kop = `${t_in("fd_kw_geldig_kop", taal)} ${
      datum_veld(rekord.geldig_tot) || "\u2014"
    }`;
    const lei = breek(t_in("fd_kw_geldig_lei", taal), gewoon, 9, REGS - KANT - 32);
    const hoog = 20 + 15 + lei.length * 12;
    const bo = y;
    const onder = bo - hoog;

    bl.drawRectangle({
      x: KANT,
      y: onder,
      width: REGS - KANT,
      height: hoog,
      color: LIG,
    });
    bl.drawRectangle({ x: KANT, y: onder, width: 2.5, height: hoog, color: TEAL });

    let gy = bo - 20;
    skryf(kop, KANT + 16, gy, { grootte: 9.5, vet: true });
    gy -= 15;
    lei.forEach((r) => {
      skryf(r, KANT + 16, gy, { grootte: 9, kleur: GRYS });
      gy -= 12;
    });

    return pdf.save();
  }

  // ── die betaalblok ─────────────────────────────────────────────────────
  //
  // ALBEI PAAIE WORD GEDRUK. Die skakel vir wie hom kan gebruik, en die
  // bankbesonderhede vir 'n finansiële afdeling wat net teen 'n bankrekening
  // betaal. Die faktuurnommer is die verwysing; sonder dit sit 'n mens met 'n
  // bedrag in 'n bankstaat en geen naam nie.
  // DIE HOOGTE WORD GEMEET, NIE GERAAI NIE. Die eerste weergawe het 150 punte
  // aangeneem en die QR met sy byskrif het onder die raam uitgehang — 'n
  // faktuur wat lyk of iets afgesny is.
  const lei_reels = breek(
    t_in("fd_eft_lei", taal),
    gewoon,
    8.5,
    (REGS - KANT) * 0.52 - 36
  );

  const links_hoog =
    14 + lei_reels.length * 11 + (rekord.betaalskakel ? 6 + 22 + 10 + 66 + 14 : 0);

  const bank_aantal =
    2 +
    (String(m.bank || "").trim() ? 1 : 0) +
    (String(m.bank_rekeningtipe || "").trim() ? 1 : 0) +
    2; // rekening, takkode, verwysing
  const regs_hoog = 15 + bank_aantal * 12;

  const blok_hoogte = Math.max(links_hoog, regs_hoog) + 30;
  const blok_bo = y;
  const blok_onder = blok_bo - blok_hoogte;

  bl.drawRectangle({
    x: KANT,
    y: blok_onder,
    width: REGS - KANT,
    height: blok_hoogte,
    color: LIG,
    borderColor: LYN,
    borderWidth: 0.7,
  });

  const b_links = KANT + 16;
  const b_regs = KANT + (REGS - KANT) * 0.52;
  let by = blok_bo - 20;

  skryf(t_in("fd_eft_kop", taal), b_links, by, { grootte: 9, vet: true });
  by -= 14;
  lei_reels.forEach((r) => {
    skryf(r, b_links, by, { grootte: 8.5, kleur: GRYS });
    by -= 11;
  });

  if (rekord.betaalskakel) {
    by -= 6;
    const knop_teks = `${t_in("fd_betaal_knop", taal)} ${rekord.nommer || ""}`.trim();
    const knop_w = gewoon.widthOfTextAtSize(knop_teks, 9) + 24;
    bl.drawRectangle({
      x: b_links,
      y: by - 6,
      width: knop_w,
      height: 22,
      borderColor: TEAL,
      borderWidth: 0.9,
    });
    skryf(knop_teks, b_links + 12, by, { grootte: 9, vet: true, kleur: TEAL });

    // DIE SKAKEL BLY KLIKBAAR IN DIE PDF. Dit is die punt van die knoppie —
    // op papier is hy 'n omlynde blok, in 'n PDF is hy 'n skakel.
    bl.node.addAnnot(
      pdf.context.register(
        pdf.context.obj({
          // DIE URI MOET 'N PDF-STRING WEES. 'n Kaal JS-string word 'n
          // PDF-naam, en dan lees 'n leser dit as "Illegal URI-type link" en
          // die knoppie doen niks — presies dieselfde soort stil mislukking
          // as die onclick op die skerm se Betaal-knoppie.
          Type: "Annot",
          Subtype: "Link",
          Rect: [b_links, by - 6, b_links + knop_w, by + 16],
          Border: [0, 0, 0],
          A: {
            Type: "Action",
            S: PDFName.of("URI"),
            URI: PDFString.of(rekord.betaalskakel),
          },
        })
      )
    );
    by -= 24;

    // Die QR: een blokkie per donker module. Skerper as 'n gerasterde beeld,
    // en dit spaar 'n inbedding.
    try {
      const q = qrcode(0, "M");
      q.addData(rekord.betaalskakel);
      q.make();
      const n = q.getModuleCount();
      const kant = 66 / n;
      const qx = b_links;
      const qy = by - 70;
      for (let r = 0; r < n; r += 1) {
        for (let c = 0; c < n; c += 1) {
          if (!q.isDark(r, c)) continue;
          bl.drawRectangle({
            x: qx + c * kant,
            y: qy + (n - 1 - r) * kant,
            width: kant,
            height: kant,
            color: SWART,
          });
        }
      }
      skryf(t_in("fd_qr_teks", taal), qx, qy - 12, { grootte: 7.5, kleur: GRYS });
    } catch (fout) {
      console.error("PDF: kon nie die QR teken nie:", fout && fout.message);
    }
  }

  let ry2 = blok_bo - 20;
  skryf(t_in("fd_bank_kop", taal), b_regs, ry2, { grootte: 9, vet: true });
  ry2 -= 15;

  const streep = (waarde) => (String(waarde || "").trim() ? String(waarde).trim() : "—");
  const bankreels = [];
  if (String(m.bank || "").trim()) bankreels.push(m.bank.trim());
  bankreels.push(String(m.bank_rekeningnaam || m.naam || "").trim());
  bankreels.push(`${t_in("fd_rekening", taal)}: ${streep(m.bank_rekeningnommer)}`);
  bankreels.push(`${t_in("fd_takkode", taal)}: ${streep(m.bank_takkode)}`);
  if (String(m.bank_rekeningtipe || "").trim()) bankreels.push(m.bank_rekeningtipe.trim());

  bankreels.forEach((r) => {
    skryf(r, b_regs, ry2, { grootte: 8.5, kleur: GRYS });
    ry2 -= 12;
  });

  const verw = `${t_in("fd_verwysing", taal)}: `;
  skryf(verw, b_regs, ry2, { grootte: 8.5, kleur: GRYS });
  skryf(rekord.nommer || "", b_regs + gewoon.widthOfTextAtSize(verw, 8.5), ry2, {
    grootte: 8.5,
    vet: true,
  });

  return pdf.save();
}

module.exports = { bou_faktuur_pdf };
