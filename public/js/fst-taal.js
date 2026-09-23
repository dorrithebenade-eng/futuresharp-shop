// fst-taal.js — FutureSharp Talks se woorde in albei tale.
//
// Voeg die FST-sleutels by taal.js se WOORDEBOEK, sodat t() en data-i18n
// hulle net soos enige ander sleutel hanteer. Moet NA taal.js laai en voor
// die bladsy se eie skrip; pas_i18n_toe() loop eers by DOMContentLoaded.
//
// Hulle leef hier en nie in taal.js nie, omdat die FST-bladsye die enigste
// plek is wat hulle gebruik en taal.js se omvang (3 000 reëls) elke
// wysiging riskant maak.

Object.assign(WOORDEBOEK, {
  fst_terug: { af: "Future Shop", en: "Future Shop" },
  fst_subtitel: { af: "Cutting-Edge Ideas", en: "Cutting-Edge Ideas" },
  fst_lei: {
    af: "Een skerp idee op 'n slag, uit navorsing, besigheid, medisyne en professionele praktyk. Elke talk is sowat vyftien minute lank en bly joune ná aankoop.",
    en: "One sharp idea at a time, from research, business, medicine and professional practice. Each talk runs about fifteen minutes and stays yours once bought.",
  },
  fst_alles: { af: "Alles", en: "All" },
  fst_soek: { af: "Soek op titel, spreker of sleutelwoord", en: "Search by title, speaker or keyword" },
  fst_laai: { af: "Talks word gelaai …", en: "Loading talks …" },
  fst_kon_nie_laai: { af: "Kon nie die talks laai nie. Herlaai die bladsy.", en: "Could not load the talks. Reload the page." },
  fst_leeg: { af: "Die eerste talks kom binnekort.", en: "The first talks are coming soon." },
  fst_geen_passing: { af: "Geen talk pas by jou soektog nie. Probeer 'n ander woord of kies Alles.", en: "No talk matches your search. Try another word or choose All." },
  fst_alle_talks: { af: "Alle talks", en: "All talks" },
  fst_oor_talk: { af: "Oor hierdie talk", en: "About this talk" },
  fst_sleutelwoorde: { af: "Sleutelwoorde", en: "Keywords" },
  fst_binnekort: { af: "Binnekort beskikbaar", en: "Coming soon" },
  fst_binnekort_nota: {
    af: "Aankope open binnekort. 'n Talk bly permanent joune ná aankoop: kyk soveel keer as wat jy wil.",
    en: "Purchases open soon. A talk stays yours permanently once bought: watch it as often as you like.",
  },
  fst_beskikbaar_vanaf: { af: "Beskikbaar vanaf", en: "Available from" },
  fst_nie_gevind: { af: "Hierdie talk bestaan nie of is nie meer beskikbaar nie.", en: "This talk does not exist or is no longer available." },
  fst_min: { af: "min", en: "min" },
});
