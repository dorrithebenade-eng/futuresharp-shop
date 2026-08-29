// netlify/functions/_joernaal.js
//
// Die joernaal: inkomste en uitgawes wat NIE deur die faktuurmodule loop nie.
//
// WAT DIE JOERNAAL IS EN NIE IS NIE
//
// Dit is 'n aantekening op KONTANTBASIS, nie 'n grootboek nie. Geen dubbele
// inskrywing, geen rekeningkategorieë, geen balansstaat. Die module VOER
// Ignatius se boeke; hy vervang hulle nie. Die rekenmeester doen die jaarstate.
//
// WAT HIER INKOM
//
// Betalings deur Paystack word outomaties versprei as inkomste en geallokeer
// waar uitgawes van belang is -- daardie inskrywings word deur kry-joernaal.js
// UIT DIE FAKTURE gelees en verskyn nooit in hierdie store nie.
//
// Wat hier gestoor word, is alles wat NIE deur Paystack vloei nie: bankkoste,
// Afrihost, LearnWorlds, Netlify. Dit word met die hand ingetik.
//
// DIE FINANSIELE JAAR LOOP 1 MAART TOT 28 FEBRUARIE.
//
// 'n Inskrywing van Januarie 2027 hoort by die jaar wat in Maart 2026 begin
// het. Die jaar word altyd deur die BEGINJAAR benoem: "2026" beteken
// 1 Maart 2026 tot 28 Februarie 2027.
//
// GEEN KATEGORIEE NIE, EN DIT IS DOELBEWUS. Future Sharp begin nou eers, en
// niemand weet nog wat die patrone gaan wees nie. 'n Veld wat niemand kan
// invul, maak die inskrywing stadiger sonder om iets te beantwoord. Kom die
// patrone later te voorskyn, word dit dan gebou.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "joernaal";
const RIGTINGS = ["in", "uit"];

function kry_joernaal_store() {
  return kry_store(STORE_NAAM);
}

// Die beginjaar van die finansiele jaar waarin 'n datum val.
// "2026-02-28" → 2025.  "2026-03-01" → 2026.  "2027-01-15" → 2026.
function finansiele_jaar(datum) {
  const dele = String(datum || "").split("-");
  const jaar = Number(dele[0]);
  const maand = Number(dele[1]);
  if (!Number.isFinite(jaar) || !Number.isFinite(maand)) return null;
  return maand >= 3 ? jaar : jaar - 1;
}

// J-2026-1756192834123-a7f2. Die jaar staan IN die sleutel sodat 'n hele
// finansiele jaar met een list({ prefix }) gelees kan word in plaas van elke
// inskrywing te moet oopmaak.
function skep_sleutel(datum) {
  const jaar = finansiele_jaar(datum);
  const staart = Math.random().toString(36).slice(2, 6);
  return `J-${jaar}-${Date.now()}-${staart}`;
}

function jaar_voorvoegsel(jaar) {
  return `J-${Number(jaar)}-`;
}

// Die lee rekord. Elke veld wat later gaan bestaan, staan hier.
//
// `wie` is OPSIONEEL en dra net 'n feit: op 12 Junie het Dorrithé R340 aan
// Netlify betaal. Of dit verhaal word, hoe en wanneer, is 'n besluit tussen
// die direkteure -- die stelsel hoef dit nie te weet nie.
function nuwe_inskrywing() {
  const nou = new Date().toISOString();
  return {
    sleutel: null,
    datum: "",              // YYYY-MM-DD, die dag waarop die geld beweeg het
    beskrywing: "",
    wie: "",                // opsioneel: wie betaal of ontvang het
    bedrag_sent: 0,         // altyd positief; `rigting` dra die teken
    rigting: "uit",
    nota: "",

    // DIE KATEGORIE, as 'n VERWYSING na _fin-kategoriee.js se id.
    //
    // Nie die naam nie. Hernoem 'n mens "Reiskoste" na "Reis en verblyf", bly
    // die id `reiskoste` en elke bestaande inskrywing hou. 'n Naam wat
    // gekopieer word, dryf uitmekaar.
    //
    // LEEG IS GELDIG, en dit is doelbewus. 'n Inskrywing wat gou getik moet
    // word, mag nie op 'n kategorie wag nie -- sy verskyn dan as
    // "Ongekategoriseer" op die staat, sigbaar en met haar eie totaal. 'n
    // Bedrag wat stil weggelaat word, is erger as een wat apart staan: dan
    // tel die staat nie meer tot die bank nie.
    kategorie_id: "",
    geskep_op: nou,
    geskep_deur: "",
    bygewerk_op: nou,
  };
}

module.exports = {
  STORE_NAAM,
  RIGTINGS,
  kry_joernaal_store,
  finansiele_jaar,
  skep_sleutel,
  jaar_voorvoegsel,
  nuwe_inskrywing,
};
