// netlify/functions/_fakture.js
//
// Die fakture-store, die stande, en die faktuurnommer.
//
// DIE FAKTUUR IS DIE REKORD VAN WAARHEID. Anders as die winkel se rak →
// mandjie → betaal, is dit een spesifieke betaler, een spesifieke bedrag,
// saamgestel per geval.
//
// DIE STANDE:
//   konsep        — begin, nog nie uitgereik nie; het nog geen nommer
//   gestuur       — uitgereik, wag op betaling; die skakel is oop
//   betaal        — die geld is ontvang; die rekord is TOE
//   gekanselleer  — syuitgang uit konsep of gestuur; die skakel weier
//
// 'n BETAALDE FAKTUUR WORD NOOIT GEWYSIG NIE. Die verdeling het klaar
// gebeur. Wil 'n mens iets verander, word gekanselleer en 'n nuwe uitgereik.
//
// Kanselleer bestaan omdat 'n betaalskakel nie verval nie. Dit is die
// enigste manier om 'n ou skakel dood te maak.
//
// WAT NIE 'N STAND IS NIE
//
// Die stande gaan oor GELD. Drie ander dinge dra hul eie veld met hul eie
// geskiedenis, want twee betekenisse in een veld beteken 'n mens kan later
// nie sê wat werklik gebeur het nie — dieselfde onderskeid as `versending`
// teenoor `drukker` in die winkel:
//
//   betaling     — HOE betaal is, en wat werklik ontvang is
//   uitbetalings — of elke ontvanger sy deel gekry het
//   lewering     — of die verslag saamgestel en gestuur is
//
// Al drie kom van die begin af op die rekord, ook al bly hulle leeg tot
// fase 4. 'n Leë veld nou is goedkoper as 'n migrasie later.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "fakture";
const STANDE = ["konsep", "gestuur", "betaal", "gekanselleer"];

// Hoe die geld ontvang is. "EFT" is NIE 'n waarde nie: in Suid-Afrika heet
// 'n Instant EFT deur die betaalskakel en 'n gewone bankoorbetaling albei
// "EFT", terwyl hulle hier teenoorgesteldes is.
//
//   paystack        — kaart, Instant EFT (Ozow), Capitec Pay, Scan to Pay,
//                     SnapScan. Die webhook het gevuur en die verdeling het
//                     gebeur; niks hoef met die hand oorbetaal te word nie.
//   bankoorbetaling — die kliënt het direk in die rekening betaal. Paystack
//                     weet niks daarvan nie en die verdeling het NIE gebeur
//                     nie; elke ontvanger moet met die hand betaal word.
//   gratis          — R0 ná 'n koepon. Daar was nooit 'n transaksie nie.
const BETAALMETODES = ["paystack", "bankoorbetaling", "gratis"];

// Die taal waarin die DOKUMENT gedruk word. Dit staan per faktuur op die
// rekord, nie as 'n stelselinstelling nie: 'n skool in die Wes-Kaap en 'n
// departement in Gauteng kry nie noodwendig dieselfde een nie.
const TALE = ["af", "en"];

function kry_fakture_store() {
  return kry_store(STORE_NAAM);
}

// ─────────────────────────────────────────────────────────────────────────
// DIE NOMMER
//
// FS/01957 — Future Sharp en 'n volgnommer. DEURLOPEND: nooit teruggestel,
// geen datum in.
//
// WAAROM GEEN DATUM: die dokument dra reeds 'n datumveld, en twee bronne vir
// dieselfde feit kan mekaar weerspreek. Belangriker: die punt van 'n
// faktuurnommer is dat 'n GAPING in die reeks sigbaar is — dit is hoe 'n mens
// sien dat niks verdwyn het nie. 'n Teller wat elke dag of maand terugstel,
// tel niks en wys geen gaping nie.
//
// WAAROM 1957: Future Sharp reik al 'n paar jaar fakture uit. Dat die vorige
// stelsel 'n ander een was, verander nie die boeke nie — dit is dieselfde
// besigheid en dieselfde reeks. 'n Reeks wat by 0001 begin, sou 'n bestaande
// besigheid soos 'n nuwe een laat lyk.
// 1961, NIE 1957 NIE: FS/01957 tot FS/01960 is werklik uitgereik, en
// PAYSTACK SE TRANSAKSIEVERWYSINGS IS PERMANENT. Hulle bly bestaan al word
// ons rekord geskrap, en /transaction/initialize weier 'n verwysing wat al
// gebruik is met "Duplicate Transaction Reference". Die toetsdata is op
// 18 Augustus 2026 uit die store verwyder; die nommers bly opgebruik.
const BEGIN_NOMMER = 1961;

// Vyf syfers met voorste nulle, sodat die reeks sorteerbaar bly. padStart
// vul aan tot MINSTENS vyf; 'n sesde syfer breek niks.
const SYFERS = 5;

// OP DIE DOKUMENT STAAN `/`; IN DIE STORE STAAN `-`.
//
// Blobs behandel 'n skuinsstreep as 'n padskeiding. `FS/01957` sou 'n gids
// `FS/` met 'n item `01957` word, list() sou 'n boom teruggee, en die
// bestaan-toets hieronder sou anders werk as dié van _indienings.js.
//
// Die omskakeling leef op hierdie twee funksies en nêrens anders nie. Niks
// buite hierdie lêer weet daarvan nie.
const SLEUTEL_VOORVOEGSEL = "FS-";
const NOMMER_VOORVOEGSEL = "FS/";

function nommer_na_sleutel(nommer) {
  const teks = String(nommer || "").trim();
  if (!teks.startsWith(NOMMER_VOORVOEGSEL)) return null;
  const syfers = teks.slice(NOMMER_VOORVOEGSEL.length);
  if (!/^\d+$/.test(syfers)) return null;
  return SLEUTEL_VOORVOEGSEL + syfers;
}

function sleutel_na_nommer(sleutel) {
  const teks = String(sleutel || "").trim();
  if (!teks.startsWith(SLEUTEL_VOORVOEGSEL)) return null;
  const syfers = teks.slice(SLEUTEL_VOORVOEGSEL.length);
  if (!/^\d+$/.test(syfers)) return null;
  return NOMMER_VOORVOEGSEL + syfers;
}

// Die volgnommer uit 'n sleutel, of 0 as die sleutel nie een van ons s'n is
// nie. 0 beteken "tel nie saam nie" — dit kan nooit die hoogste wees nie,
// want die reeks begin by BEGIN_NOMMER.
function volgnommer_van(sleutel) {
  const nommer = sleutel_na_nommer(sleutel);
  if (!nommer) return 0;
  const getal = Number(nommer.slice(NOMMER_VOORVOEGSEL.length));
  return Number.isFinite(getal) ? getal : 0;
}

// Die volgende nommer, as 'n SLEUTEL (`FS-01958`). Die aanroeper stoor
// daarmee en sit sleutel_na_nommer() op die rekord se `nommer`-veld.
//
// Die nommer word by STUUR toegeken, nie by die skep van 'n konsep nie —
// anders lê daar gate in die reeks van fakture wat nooit iets geword het nie.
//
// DIE VOLGENDE NOMMER IS DIE HOOGSTE VAN TWEE DINGE: BEGIN_NOMMER, en die
// laaste bestaande sleutel plus een. Sonder die eerste sou 'n leë store die
// reeks laat terugval na FS/00001.
//
// Die volgnommer kom uit die bestaande sleutels, nie uit 'n aparte teller
// nie. Blobs se list() is eventueel konsekwent (sowat vier sekondes), dus kan
// twee fakture kort na mekaar dieselfde nommer kry — daarom toets ons of die
// sleutel reeds bestaan voordat hy teruggegee word. Dieselfde patroon as
// _indienings.js se skep_nommer.
async function skep_nommer(store) {
  let sleutels = [];
  try {
    const lys = await store.list({ prefix: SLEUTEL_VOORVOEGSEL });
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die fakture lys nie:", fout);
    throw fout;
  }

  let hoogste = 0;
  sleutels.forEach((sleutel) => {
    const getal = volgnommer_van(sleutel);
    if (getal > hoogste) hoogste = getal;
  });

  const begin = Math.max(BEGIN_NOMMER, hoogste + 1);

  for (let poging = 0; poging < 20; poging += 1) {
    const kandidaat =
      SLEUTEL_VOORVOEGSEL + String(begin + poging).padStart(SYFERS, "0");
    if (!sleutels.includes(kandidaat)) {
      // list() loop agter. 'n Sleutel wat nie in die lys was nie, kan reeds
      // bestaan — dus vra ons hom direk.
      const bestaan = await store.get(kandidaat, { type: "json" });
      if (!bestaan) return kandidaat;
      sleutels.push(kandidaat);
    }
  }

  throw new Error("Kon nie 'n vry faktuurnommer kry nie");
}

// ─────────────────────────────────────────────────────────────────────────
// DIE KONSEP SE SLEUTEL
//
// 'n Konsep het nog GEEN nommer nie — die nommer word by stuur toegeken,
// anders lê daar gate in die reeks van fakture wat nooit iets geword het nie.
// Maar 'n konsep moet stoor kan word, dus het hy 'n sleutel nodig.
//
// Hy leef in DIESELFDE store, met 'n ander voorvoegsel. Dit werk saam met wat
// reeds hier staan:
//
//   * skep_nommer() lys met prefix "FS-", dus tel 'n konsep NOOIT saam vir
//     die nommerreeks nie. 'n Konsep kan dus geen nommer opgebruik nie.
//   * kry-fakture.js se kale list() sien hom wel, dus verskyn hy in die lys
//     saam met die res.
//
// By STUUR verhuis die rekord na sy FS-sleutel en die konsep-sleutel word
// verwyder. Een rekord, een plek — nooit twee kopieë wat uitmekaar loop nie.
const KONSEP_VOORVOEGSEL = "KONSEP-";

// Die tyd gee 'n leesbare, sorteerbare stam; die ses ewekansige karakters
// keer dat twee konsepte wat in dieselfde millisekonde begin, mekaar oorskryf.
function skep_konsep_sleutel() {
  const stam = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  let staart = "";
  const KARAKTERS = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 6; i += 1) {
    staart += KARAKTERS[Math.floor(Math.random() * KARAKTERS.length)];
  }
  return KONSEP_VOORVOEGSEL + stam + "-" + staart;
}

function is_konsep_sleutel(sleutel) {
  return String(sleutel || "").startsWith(KONSEP_VOORVOEGSEL);
}

// ─────────────────────────────────────────────────────────────────────────
// DIE PUBLIEKE KODE
//
// Die faktuurnommer is DEURLOPEND en dus tel-baar. Staan hy in 'n publieke
// URL, kan enigiemand by FS-01957 begin en deur die reeks loop om vir elke
// faktuur die bedrag en die betaalstatus te sien. Dit is ander mense se sake.
//
// Die kode los dit op sonder om die nommer te versteek: die callback-URL dra
// ALBEI — die sleutel om die rekord direk te vind, en die kode as bewys dat
// die persoon die skakel werklik ontvang het. Pas die kode nie, is die
// antwoord 404, en 'n mens kan niks aflei deur te tel nie.
//
// Hy word by UITREIKING geskep, saam met die nommer. 'n Konsep het nog geen
// skakel om te deel nie.
//
// Dieselfde kode dra later die publieke faktuurbladsy en die PDF-skakel; dit
// is nie werk wat net vir een bladsy gedoen word nie.
const crypto = require("crypto");

function skep_publieke_kode() {
  return crypto.randomBytes(16).toString("hex");
}

// ─────────────────────────────────────────────────────────────────────────
// DIE TOETSSTEMPEL
//
// 'n Faktuur is die rekord van waarheid. Word hy uitgereik, staan sy nommer
// in die reeks en 'n gaping daarin is hoe 'n mens sien dat niks verdwyn het
// nie. So iets word GEKANSELLEER, nooit uitgevee nie.
//
// Maar tydens die toetsfase word daar werklike fakture uitgereik wat nooit
// bedoel was om te bly nie, en daardie data moet weg.
//
// DIE OPLOSSING IS 'N STEMPEL OP DIE REKORD, NIE 'N MODUS IN DIE STELSEL NIE.
// Terwyl TOETSFASE aan is, kry elke NUWE faktuur `toets: true`. Die stempel
// verander daarna nooit. Verwyder 'n mens die veranderlike, dra elke nuwe
// faktuur geen stempel en is hy permanent — en daar hoef NOOIT 'n ontsluit-pad
// in die kode te bestaan nie. Geen skakelaar wat iemand kan omdraai, geen
// modus wat iemand kan vergeet om af te sit.
//
// In Netlify: TOETSFASE = aan. Enige ander waarde, of geen veranderlike,
// beteken die toetsfase is verby.
function is_toetsfase() {
  return String(process.env.TOETSFASE || "").trim().toLowerCase() === "aan";
}

// ─────────────────────────────────────────────────────────────────────────

// Elke handeling gaan hier in. Dit is wat later 'n vraag beantwoord oor wat
// gebeur het en wie dit gedoen het.
function voeg_geskiedenis_by(rekord, handeling, wie, nota) {
  if (!Array.isArray(rekord.geskiedenis)) rekord.geskiedenis = [];
  rekord.geskiedenis.push({
    handeling,
    wie: wie || "",
    nota: nota || "",
    op: new Date().toISOString(),
  });
  return rekord;
}

// Die leë rekord. Elke veld wat later gaan bestaan, staan hier — ook die wat
// eers in fase 4 gevul word. Dit is wat 'n migrasie later spaar.
//
// LET WEL: kry-fakture.js en enige ander lees-Function bou hul antwoorde
// VELD VIR VELD. 'n Nuwe veld hier kom NIE vanself deur nie. Dit het op
// 8 Augustus met `leers` in kry-indienings.js gebeur, en die outeur se
// manuskrip het gelyk of hy weg is.
function nuwe_faktuur(wie) {
  const nou = new Date().toISOString();
  return {
    nommer: null,               // eers by stuur; die vorm `FS/01957`
    stand: "konsep",
    geskep_op: nou,
    bygewerk_op: nou,
    geskep_deur: wie || "",
    uitgereik_op: null,

    // Die taal van die DOKUMENT, per faktuur. Afrikaans is die voorstel wat
    // die vorm maak; dit is per faktuur oorskryfbaar, dus kos 'n verkeerde
    // raaiskoot niks.
    taal: "af",

    klient_id: null,
    // 'n Afskrif van die kliënt soos hy op die dag van uitreiking gelyk het.
    // Die ADRES kom hier in omdat 'n institusionele koper se adres op die
    // dokument staan — dit hoort by die kliënt, nie by die faktuur nie,
    // anders word dit by elke faktuur oorgetik.
    klient: {
      naam: "",
      kontakpersoon: "",
      epos: "",
      selfoon: "",
      adres: "",               // vrye teksblok; gedruk soos dit gestoor is
    },
    bestelnommer: "",           // die kliënt se PO; opsioneel, op die dokument

    // ELKE REEL DRA SY EIE VERDELING (25 Augustus 2026). Voor dit het die
    // faktuur EEN verdeling gehad, en 'n faktuur met 'n aanbieding, 'n
    // vraelys en 'n verslag -- elk met sy eie ontvangers -- kon nie bestaan
    // nie. Sien Verdeling-Per-Lynitem-Ontwerp.md.
    //
    //   soort        verkoop | koste. Bepaal DRIE dinge tegelyk: dra die reel
    //                hosting, het die reel 'n oorskot, en is 'n ontvanger
    //                verplig. 'n Kostereel gee iemand sy geld terug; is daar
    //                niemand nie, is dit nie 'n koste nie.
    //   op_faktuur   of die reel GEDRUK word. Is dit af, word die reel saam
    //                met die ander versteektes onder een beskrywing gevou.
    //                Dit raak NIKS aan die som nie -- die verdeling loop op
    //                die reels, nie op die dokument.
    //   hosting_pct  per reel, nie meer per faktuur. 'n Kostereel kry nul:
    //                trek 'n mens hosting van 'n terugbetaling af, kry die
    //                persoon minder terug as wat hy uitgegee het.
    //   verdeling    wie kry wat van HIERDIE reel. Die lewende een, teenoor
    //                verdeling_gevries hieronder.
    reels: [],                  // { soort, beskrywing, hoeveelheid,
                                //   prys_pp_sent, bedrag_sent, op_faktuur,
                                //   hosting_pct, verdeling: [] }

    // EEN oop teksblok onder die reëls — nie 'n subreël per item nie. Dit
    // dra die opleidingsdatum en die deelnemerslys, en dit is die enigste
    // plek waar vrye teks op die dokument beland. 'n Blok per reël sou by
    // drie reëls drie half-ingevulde blokke gee.
    dokument_nota: "",

    // ── DIE BACKOFFICE: twee lyste wat NIE op die dokument verskyn nie ──
    //
    // Hulle val maklik saam en mag nie. Die begroting beantwoord "wat kos
    // dit?"; die verdeling beantwoord "wie kry wat?" -- en sy leef nou op die
    // reels hierbo. Gooi 'n mens hulle in
    // een lys, lyk 'n reiskostery wat die PRYS bepaal presies soos een wat
    // aan Eugene UITBETAAL word.
    //
    // Die begroting is 'n MAATSTAF, nie 'n verpligting nie: wat julle verwag
    // om te bestee. Die werklike rekeninge kom later en kan verskil. Wat dit
    // beantwoord, is die enigste vraag waarvoor 'n mens begroot — faktureer
    // ons genoeg?
    //
    // `betaal_deur` staan hier NIE op die rekord nie. Dit is 'n GEVOLG van
    // die ontvanger: het hy 'n subrekening, word die ry 'n verdelingsry;
    // anders bly dit in die hoofrekening. Twee velde vir een feit is presies
    // waar hulle later uitmekaar loop — dieselfde redenasie as `versending`
    // teenoor `drukker` in die winkel.
    //
    // 'n KOSTE IS ALTYD 'N VASTE BEDRAG, nooit 'n persentasie nie. Loop dit
    // op 'n persentasie, kry iemand 70% van sy eie petrol terug.
    koste: [],                  // { beskrywing, ontvanger, bedrag_sent,
                                //   inskrywing }

    // DIE FAKTUURVLAK `verdeling` EN `hosting_pct` IS WEG (25 Augustus 2026).
    // Albei leef nou op elke reel hierbo. 'n Faktuurvlak-verdeling sou NAAS
    // die reels s'n loop en dieselfde geld twee keer uitbetaal.
    //
    // Hosting kry 'n ry op die skerm maar word NOOIT uitbetaal nie -- dit bly
    // in die hoofrekening, soos die oorskot. Word dit ooit 'n Paystack-
    // verdelingsry, word dit uitbetaal EN daar bly niks vir Paystack nie.

    afslag_sent: 0,
    koepon_kode: null,
    skenking_sent: 0,           // tel by die totaal, bly BUITE die verdeling
    totaal_sent: 0,

    // BTW word nie gebou nie, maar die velde kom nou. Ou fakture bly dan
    // korrek teen 0% en niks hoef gemigreer te word nie.
    btw_koers: 0,
    btw_bedrag_sent: 0,

    // Die verdeling word by UITREIKING gekopieer en gevries. Wysig iemand
    // later die produk se voorstel, verander 'n ou faktuur nooit.
    verdeling_gevries: null,
    paystack: { referensie: null, split_code: null, authorization_url: null },

    // Die sleutel wat 'n publieke bladsy toelaat om HIERDIE faktuur te wys
    // sonder dat 'n mens deur die nommerreeks kan tel. Word by uitreiking
    // gestel; 'n konsep het nog geen skakel om te deel nie.
    publieke_kode: null,

    // Sien is_toetsfase() hierbo. Word by die SKEPPING gestel en verander
    // daarna nooit — 'n faktuur wat as toetsdata begin het, bly dit.
    toets: is_toetsfase(),

    // Hoe betaal is. Sien BETAALMETODES.
    betaling: {
      metode: null,
      ontvang_sent: 0,
      ontvang_op: null,
      verwysing: "",
      aangeteken_deur: "",
      nota: "",
    },

    // Waar die verdeling nie deur Paystack gebeur het nie, word die
    // gevriesde verdeling 'n aftreklys. Die bedrag word NOOIT oorgetik nie —
    // dit kom uit verdeling_gevries.
    uitbetalings: [],           // { ontvanger, bedrag_sent, stand,
                                //   betaal_op, verwysing, deur }

    // Betaal is nie die einde nie. Die verslag moet nog saamgestel en
    // gestuur word. Dit is nie 'n stand nie — die stande gaan oor geld.
    lewering: { gestuur_op: null, nota: "", geskiedenis: [] },

    // Waaruit die verslag saamgestel word. Ander mense se data: dit hoort
    // nêrens in 'n uitvoer of 'n toetslêer nie.
    bron: { respondente: [], groep: "", bevestig: false },

    // TWEE DATUMS WAT NIE VERWAR MAG WORD NIE:
    //
    //   betaalbaar_teen — staan op die DOKUMENT. 'n Skool se finansiële
    //                     afdeling werk teen 30 dae en het 'n datum nodig om
    //                     teen te betaal. Dit keer niks en maak niks dood: 'n
    //                     faktuur wat verby sy datum is, kan steeds betaal
    //                     word.
    //   verval_op       — maak die BETAALSKAKEL dood. Leeg = geen verval, wat
    //                     die TEENOORGESTELDE is van _uitnodiging-geldig.js.
    //                     Wil 'n mens 'n skakel werklik doodmaak, is dit
    //                     kanselleer, nie 'n datum nie.
    betaalbaar_teen: null,
    verval_op: null,

    // Kansellasie. Die REDE is verplig: ses maande later is "waarom is
    // FS/01957 gekanselleer?" 'n boekhoudkundige vraag, en 'n gaping in die
    // nommerreeks sonder 'n rede is presies wat 'n ouditeur vra.
    gekanselleer_op: null,
    gekanselleer_deur: null,
    kanselleer_rede: null,

    geskiedenis: [],
  };
}

// 'n Betaalde faktuur is toe. Elke skryf-Function moet dit vra voordat hy
// iets verander.
/* 'N DATUM SOOS HY OP DIE DOKUMENT STAAN: 2026/08/20.

   stoor-faktuur.js stoor 'n VOLLE ISO-datumtyd — new Date(x).toISOString().
   'n Blote replace(/-/g, "/") daarop gee 2026/08/20T00:00:00.000Z, en dit het
   op 16 Augustus so in 'n proforma-e-pos by 'n klient beland.

   Die eerste tien karakters is die datum. Hulle word GESNY en nie deur 'n
   Date gestuur nie: 'n ISO-datum is UTC, en new Date(...).getDate() sou hom
   in 'n ander tydsone 'n dag kon skuif. */
function datum_dokument(waarde) {
  const teks = String(waarde || "").trim();
  if (!teks) return "";
  const d = teks.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.replace(/-/g, "/") : teks;
}

function is_toe(rekord) {
  return Boolean(rekord && (rekord.stand === "betaal" || rekord.stand === "gekanselleer"));
}

module.exports = {
  STORE_NAAM,
  STANDE,
  BETAALMETODES,
  TALE,
  BEGIN_NOMMER,
  KONSEP_VOORVOEGSEL,
  kry_fakture_store,
  nommer_na_sleutel,
  sleutel_na_nommer,
  skep_nommer,
  skep_konsep_sleutel,
  is_konsep_sleutel,
  skep_publieke_kode,
  is_toetsfase,
  voeg_geskiedenis_by,
  datum_dokument,
  nuwe_faktuur,
  is_toe,
};
