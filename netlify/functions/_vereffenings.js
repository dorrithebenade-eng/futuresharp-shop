// netlify/functions/_vereffenings.js
//
// Die store van ROU Paystack-vereffenings, dit is die uitbetalings wat Paystack
// werklik gedoen het. Rol: geen -- hierdie leer word deur die afhaal geskryf en
// deur die lees gebruik.
//
// WAAROM DIT BESTAAN.
//
// Die stelsel weet van elke betaling. Paystack weet wat daarna met daardie geld
// gebeur het. Sonder hierdie vlak moet 'n mens by Paystack gaan kyk om te weet
// of die geld vir 'n faktuur uitbetaal is, en aan wie.
//
// WAT DIE UITBETAALLYS VAN 19 SEPTEMBER 2026 GEWYS HET:
//
//   * Paystack betaal ELKE WERKSDAG uit, vir daardie dag se transaksies. 'n
//     Gaping in die lys beteken net daar was niks om uit te betaal nie.
//   * ELKE ONTVANGER KRY SY EIE UITBETALING. Sedert 15 Julie is daar 31
//     uitbetalings: 17 na die hoofrekening en die res na die subrekeninge.
//   * Die fooi word van die HOOFREKENING afgetrek; die begunstigdes se
//     uitbetalings wys deurgaans nul.
//
// Daarom dra elke rekord sy ontvanger. 'n Vereffening sonder ontvanger is
// betekenisloos: dit is nie een bedrag wat opgebreek word nie, maar een bedrag
// PER ontvanger.
//
// DIESELFDE REEL AS _paystack-transaksies.js: wat gestoor word, is wat Paystack
// gese het. Wat daarvan inkomste of koste is, word by die LEES besluit.
// Verander daardie reel later, word die hele geskiedenis oorgelei sonder om
// weer by Paystack te gaan haal.
//
// DIE SLEUTEL DRA DIE FINANSIELE JAAR, soos die transaksies s'n:
//
//   V-2026-3090024
//
// Paystack se id is uniek per vereffening, dus is die sleutel DETERMINISTIES:
// loop die afhaal twee keer oor dieselfde dag, oorskryf dit dieselfde rekord.
//
// 'n VEREFFENING VERANDER OOK. Haar status loop van `pending` deur
// `processing` na `success`. Die deterministiese sleutel beteken die rekord
// groei saam met haar in plaas daarvan dat daar drie rekords ontstaan.

const { kry_store } = require("./_blob-store");
const { finansiele_jaar } = require("./_joernaal");

const STORE_NAAM = "vereffenings";

// Die hoofrekening se ontvangerkode. Paystack se eie API gebruik die woord
// "none" vir "die rekening self, nie 'n subrekening nie", en dit word hier
// behou sodat die kode en die API dieselfde woord gebruik.
const HOOFREKENING = "none";

function kry_vereffenings_store() {
  return kry_store(STORE_NAAM);
}

// Blob-sleutels mag geen spasie, skuinsstreep of aanhaalteken dra nie.
// Paystack se id is 'n getal, maar dit word nie aanvaar sonder om te kyk nie.
function skoon_id(id) {
  return String(id == null ? "" : id)
    .trim()
    .replace(/[^A-Za-z0-9._=-]/g, "-")
    .slice(0, 120);
}

function skep_sleutel(datum, id) {
  const jaar = finansiele_jaar(datum);
  return `V-${jaar}-${skoon_id(id)}`;
}

function jaar_voorvoegsel(jaar) {
  return `V-${Number(jaar)}-`;
}

// Die dag van die uitbetaling, as YYYY-MM-DD.
//
// DIT IS 'N UTC-DAG, soos by die transaksies. Paystack se uitbetaallys wys
// middernag as tyd, dus is daar hier geen randgeval wat 'n dag verskuif nie.
function dag(tydstempel) {
  if (!tydstempel) return "";
  const d = new Date(tydstempel);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Wie hierdie vereffening ontvang het, uit die rekord self.
 *
 * DIE VEREFFENING SE `subaccount` IS DIE ANTWOORD, en sy afwesigheid ook.
 * Bevestig teen werklike data op 19 September 2026: vereffening 11769136 het
 * geen `subaccount` nie en is die hoofrekening s'n (R1,54 netto, R0,46 fooi);
 * 11769137 dra `subaccount.subaccount_code` ACCT_9deilnnmvjvfq1q met
 * `business_name` "Face to Face Educational Psychologist" (R18,00, geen fooi).
 *
 * MOENIE DIT MET PAYSTACK SE `subaccount`-PARAMETER PROBEER DOEN NIE. Op
 * /settlement neem daardie parameter die subrekeninge se uitbetalings WEG in
 * plaas van hulle te kies: met die filter het 'n inhaal 17 van 31 gegee,
 * sonder dit al 31, en sonder 'n enkele fout.
 */
function kry_ontvanger(v) {
  const sub = v && v.subaccount;
  const kode = String((sub && sub.subaccount_code) || "").trim();
  if (!kode) return { kode: HOOFREKENING, naam: "Hoofrekening" };
  return {
    kode,
    naam: String((sub && (sub.business_name || sub.description)) || kode),
  };
}

/**
 * Bou die rekord uit Paystack se vereffening.
 *
 * @param {object} v            Paystack se vereffening, rou.
 * @param {string[]} verwysings Die transaksies wat in hierdie uitbetaling was.
 */
function bou_rekord(v, verwysings) {
  const ontvanger = kry_ontvanger(v);
  const kode = ontvanger.kode;
  const datum = dag(v.settlement_date || v.settlementDate || v.created_at);

  return {
    sleutel: skep_sleutel(datum, v.id),
    paystack_id: v.id != null ? String(v.id) : "",
    datum,
    tydstempel: v.settlement_date || v.created_at || "",

    // WIE DIE GELD GEKRY HET. `is_hoofrekening` staan hier as 'n afskrif sodat
    // 'n leser nie die kode met 'n string hoef te vergelyk nie: die skeiding
    // tussen Future Sharp se geld en 'n begunstigde s'n is die belangrikste
    // onderskeid in hierdie hele vlak.
    ontvanger_kode: kode,
    ontvanger_naam: ontvanger.naam,
    is_hoofrekening: kode === HOOFREKENING,

    // Alles in sent, soos oral elders in hierdie stelsel.
    //
    // total_amount    wat ingekom het voor die fooi
    // total_fees      wat Paystack gehou het
    // effective_amount wat werklik uitbetaal is
    //
    // Die drie klop nie altyd presies as 'n som nie -- Paystack ken ook
    // `deductions` en `additions` -- dus word al drie gestoor soos hulle is en
    // word niks hier afgelei nie.
    // `total_processed` is wat die kliënt betaal het (R20,00 op 18 Sep);
    // `total_amount` is wat HIERDIE ontvanger daarvan kry (R1,54 en R18,00).
    verwerk_sent: Number(v.total_processed) || 0,
    bruto_sent: Number(v.total_amount) || 0,
    fooi_sent: Number(v.total_fees) || 0,
    netto_sent: Number(v.effective_amount != null ? v.effective_amount : v.total_amount) || 0,
    valuta: String(v.currency || ""),

    // `pending`, `processing` of `success`. NET `success` IS GELD WAT WERKLIK
    // GELAND HET. Die res word gewys as wat oppad is, nie as inkomste nie.
    status: String(v.status || ""),

    // Die transaksies wat in hierdie uitbetaling was, as Paystack se eie
    // verwysings. NET DIE VERWYSINGS, nie die transaksies self nie: die
    // transaksies staan reeds in `paystack-transaksies`, en dieselfde bedrag op
    // twee plekke dryf uitmekaar.
    verwysings: Array.isArray(verwysings) ? verwysings.map((x) => String(x || "")) : [],

    rou: v,
    gehaal_op: new Date().toISOString(),
  };
}

module.exports = {
  STORE_NAAM,
  HOOFREKENING,
  kry_ontvanger,
  kry_vereffenings_store,
  skep_sleutel,
  jaar_voorvoegsel,
  dag,
  bou_rekord,
};
