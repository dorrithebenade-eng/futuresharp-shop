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

function kry_fakture_store() {
  return kry_store(STORE_NAAM);
}

// FS_2026-08-13-0001 — Future Sharp, die datum, die volgnommer. PER DAG
// getel; elke dag begin by 0001.
//
// Die nommer word by STUUR toegeken, nie by die skep van 'n konsep nie —
// anders lê daar gate in die reeks van fakture wat nooit iets geword het
// nie. Die datum in die nommer is dus die UITREIKINGSDATUM: 'n konsep wat
// Dinsdag begin en Donderdag gestuur word, dra Donderdag se datum.
//
// Die volgnommer kom uit die bestaande sleutels, nie uit 'n aparte teller
// nie. Blobs se list() is eventueel konsekwent (sowat vier sekondes), dus
// kan twee fakture kort na mekaar dieselfde nommer kry — daarom toets ons of
// die sleutel reeds bestaan voordat hy teruggegee word. Dieselfde patroon as
// _indienings.js se skep_nommer.
async function skep_nommer(store, datum) {
  const d = datum instanceof Date ? datum : new Date();
  const jaar = d.getFullYear();
  const maand = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  const voorvoegsel = `FS_${jaar}-${maand}-${dag}-`;

  let sleutels = [];
  try {
    const lys = await store.list({ prefix: voorvoegsel });
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die fakture lys nie:", fout);
    throw fout;
  }

  let hoogste = 0;
  sleutels.forEach((sleutel) => {
    const getal = Number(sleutel.slice(voorvoegsel.length));
    if (Number.isFinite(getal) && getal > hoogste) hoogste = getal;
  });

  for (let poging = 1; poging <= 20; poging += 1) {
    const kandidaat = `${voorvoegsel}${String(hoogste + poging).padStart(4, "0")}`;
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
    nommer: null,               // eers by stuur
    stand: "konsep",
    geskep_op: nou,
    bygewerk_op: nou,
    geskep_deur: wie || "",
    uitgereik_op: null,

    klient_id: null,
    klient: { naam: "", kontakpersoon: "", epos: "", selfoon: "" },
    bestelnommer: "",           // die kliënt se PO; opsioneel, op die dokument

    reels: [],                  // { soort: verkoop | koste, beskrywing,
                                //   bedrag_sent, op_faktuur, verdeling: [] }
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

    verval_op: null,            // leeg = geen verval. Hier beteken leeg die
                                // TEENOORGESTELDE van _uitnodiging-geldig.js
    geskiedenis: [],
  };
}

// 'n Betaalde faktuur is toe. Elke skryf-Function moet dit vra voordat hy
// iets verander.
function is_toe(rekord) {
  return Boolean(rekord && (rekord.stand === "betaal" || rekord.stand === "gekanselleer"));
}

module.exports = {
  STORE_NAAM,
  STANDE,
  BETAALMETODES,
  kry_fakture_store,
  skep_nommer,
  voeg_geskiedenis_by,
  nuwe_faktuur,
  is_toe,
};
