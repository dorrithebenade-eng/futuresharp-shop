// netlify/functions/_fin-bank.js
//
// Bankbalansse op 'n datum, met die hand ingetik uit die bankstaat.
//
// WAAROM DIT BESTAAN
//
// Die staat tel inskrywings op. Sy kan sê wat sy WEET, maar sy kan nie sê of
// sy alles weet nie. Die enigste toets vir volledigheid is die bank:
//
//     openingsbalans + inkomste - uitgawes = sluitingsbalans
//
// Klop dit tot die sent, is die tydperk volledig. Klop dit nie, ontbreek daar
// 'n inskrywing -- en dan sê die stelsel dit in plaas van dat 'n mens dit eers
// by jaareinde agterkom.
//
// Volledigheid is die enigste ding wat 'n ouditeur werklik toets, en dit is die
// enigste ding wat 'n staat sonder hierdie reël nie kan bewys nie.
//
// 'N BALANS IS 'N GEDATEERDE FEIT, NIE 'N INSTELLING NIE.
//
// Vandaar dat die datum die sleutel is. Die sluitingsbalans van Augustus is
// die openingsbalans van September; dieselfde getal, een keer ingetik. 'n
// Aparte "opening" en "sluiting" per tydperk sou dieselfde bedrag twee keer
// laat staan, en dan dryf hulle uitmekaar.
//
// DIE OPENING IS DIE DAG VOOR DIE TYDPERK BEGIN.
//
// Loop die tydperk van 1 Maart tot 31 Augustus, is die opening die balans op
// 28 Februarie -- die aand voor die eerste transaksie. Dieselfde konvensie as
// enige bankstaat s'n.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "fin-bank";

function kry_fin_bank_store() {
  return kry_store(STORE_NAAM);
}

// Die sleutel IS die datum. YYYY-MM-DD sorteer alfabeties in datumvolgorde,
// dus lees 'n `list()` reeds in die regte orde.
function is_datum(teks) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(teks || ""));
}

function nuwe_balans(datum, balans_sent) {
  const nou = new Date().toISOString();
  return {
    datum: String(datum || ""),
    // MAG NEGATIEF WEES. 'n Rekening kan oortrokke wees, en 'n stelsel wat dit
    // weier, dwing 'n mens om die verkeerde getal in te tik.
    balans_sent: Math.round(Number(balans_sent) || 0),
    nota: "",
    geskep_op: nou,
    geskep_deur: "",
    bygewerk_op: nou,
  };
}

module.exports = {
  STORE_NAAM,
  kry_fin_bank_store,
  is_datum,
  nuwe_balans,
};
