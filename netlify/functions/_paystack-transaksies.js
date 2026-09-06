// netlify/functions/_paystack-transaksies.js
//
// Die store van ROU Paystack-transaksies. Rol: geen -- hierdie leer word deur
// die afhaal geskryf en deur kry-joernaal.js gelees.
//
// WAAROM DIE ROU TRANSAKSIE GESTOOR WORD EN NIE 'N KLAAR BEREKENDE INSKRYWING
// NIE.
//
// Die joernaal lei sy inskrywings AF -- uit die fakture, uit die uitbetaalrye,
// uit die bestellings. Niks daarvan word in die joernaal se store geskryf nie,
// want dan staan dieselfde bedrag op twee plekke en hulle dryf uitmekaar.
//
// Dieselfde reel geld hier. Wat gestoor word, is wat Paystack gese het; wat
// daarvan inkomste is en onder watter kategorie, word by die LEES besluit.
// Verander daardie reel later -- 'n nuwe kursus, 'n ander kategorie, 'n ander
// hantering van 'n subrekeningdeel -- word die hele geskiedenis oorgelei
// sonder om weer by Paystack te gaan haal.
//
// Dit is nie 'n teoretiese voordeel nie: Paystack se transaksielys is nie
// oneindig beskikbaar nie, en 'n herafhaal oor 'n jaar is duur.
//
// DIE SLEUTEL DRA DIE FINANSIELE JAAR, soos die joernaal s'n. Een
// list({ prefix }) gee dan 'n hele jaar sonder om elke ander jaar oop te maak.
//
//   T-2026-abc123xyz
//
// Die verwysing is Paystack se eie en is uniek per transaksie. Die sleutel is
// dus DETERMINISTIES: loop die afhaal twee keer oor dieselfde dag, oorskryf
// dit dieselfde rekord in plaas van 'n tweede te skep. Daar is geen aparte
// duplikaat-kontrole nodig nie.

const { kry_store } = require("./_blob-store");
const { finansiele_jaar } = require("./_joernaal");

const STORE_NAAM = "paystack-transaksies";

function kry_paystack_transaksies_store() {
  return kry_store(STORE_NAAM);
}

// Blob-sleutels mag geen spasie, skuinsstreep of aanhaalteken dra nie.
// Paystack se verwysings gebruik alfanumeries plus - . = , maar 'n verwysing
// wat ons self bou (sien _faktuur-uitreik.js) kan later iets anders dra.
function skoon_verwysing(verwysing) {
  return String(verwysing || "")
    .trim()
    .replace(/[^A-Za-z0-9._=-]/g, "-")
    .slice(0, 120);
}

function skep_sleutel(datum, verwysing) {
  const jaar = finansiele_jaar(datum);
  return `T-${jaar}-${skoon_verwysing(verwysing)}`;
}

function jaar_voorvoegsel(jaar) {
  return `T-${Number(jaar)}-`;
}

// Die dag waarop die geld beweeg het, as YYYY-MM-DD. Paystack gee 'n volle
// ISO-tydstempel in UTC; die joernaal werk in dae.
//
// DIT IS 'n UTC-DAG, NIE 'N SAST-DAG NIE. 'n Betaling om 01:30 SAST val op
// die vorige UTC-dag. Oor 'n jaar maak dit geen verskil aan 'n totaal nie,
// maar op die grens van 'n finansiele jaar wel -- en dan is die bankstaat
// die gesag. Dit staan hier sodat niemand later hoef te raai nie.
function dag(tydstempel) {
  if (!tydstempel) return "";
  const d = new Date(tydstempel);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Die rekord. Die ROU transaksie bly heel in `rou`; die velde daarbo is
// afskrifte wat 'n leser nodig het sonder om die rou voorwerp te ontleed.
//
// WAT HIER NIE STAAN NIE: 'n kategorie, 'n rigting, 'n bedrag wat as inkomste
// of uitgawe benoem is. Dit is besluite, nie feite nie, en hulle hoort by die
// lees.
function bou_rekord(t) {
  const datum = dag(t.paid_at || t.paidAt || t.created_at);
  const metadata = t.metadata && typeof t.metadata === "object" ? t.metadata : {};

  return {
    sleutel: skep_sleutel(datum, t.reference),
    verwysing: String(t.reference || ""),
    paystack_id: t.id != null ? String(t.id) : "",
    datum,
    tydstempel: t.paid_at || t.created_at || "",

    // Alles in sent, soos oral elders in hierdie stelsel.
    bedrag_sent: Number(t.amount) || 0,
    fooi_sent: Number(t.fees) || 0,
    valuta: String(t.currency || ""),
    kanaal: String(t.channel || ""),
    status: String(t.status || ""),

    epos: String((t.customer && t.customer.email) || ""),

    // DIE HERKOMS. `faktuur_sleutel` en `bestelnommer` word deur die
    // faktuurmodule en die winkel in die metadata gesit; `course_slug` deur
    // die checkout-werf. kry-joernaal.js gebruik hulle om te weet watter
    // transaksies REEDS elders geboek word.
    faktuur_sleutel: String(metadata.faktuur_sleutel || ""),
    bestelnommer: String(metadata.bestelnommer || ""),
    kursus_slak: String(metadata.course_slug || ""),

    metadata,

    // Die verdeling, soos Paystack dit teruggee. Die vorm hiervan verskil
    // tussen 'n enkele subrekening en 'n split-groep, en dit is NOG NIE teen
    // 'n werklike transaksie geverifieer nie. Dit word heel gestoor sodat die
    // afleiding later geskryf kan word sonder 'n herafhaal.
    subrekening: (t.subaccount && t.subaccount.subaccount_code) || "",
    split: t.split || null,

    rou: t,
    gehaal_op: new Date().toISOString(),
  };
}

module.exports = {
  STORE_NAAM,
  kry_paystack_transaksies_store,
  skep_sleutel,
  jaar_voorvoegsel,
  skoon_verwysing,
  dag,
  bou_rekord,
};
