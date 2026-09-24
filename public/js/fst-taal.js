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
  // Fase 4: koop en die Teater
  fst_koop_vir: { af: "Koop vir", en: "Buy for" },
  fst_kry_gratis: { af: "Voeg by My Teater", en: "Add to My Theatre" },
  fst_kyk_in_teater: { af: "Kyk in My Teater", en: "Watch in My Theatre" },
  fst_my_teater: { af: "My Teater", en: "My Theatre" },
  fst_besig: { af: "Besig …", en: "Working …" },
  fst_koop_fout: { af: "Kon nie die betaling begin nie. Probeer weer.", en: "Could not start the payment. Please try again." },
  fst_bevestig: { af: "Jou betaling word bevestig …", en: "Confirming your payment …" },
  fst_bevestig_stadig: {
    af: "Die bevestiging neem langer as gewoonlik. Herlaai die bladsy oor 'n minuut; die talk verskyn sodra Paystack dit bevestig.",
    en: "Confirmation is taking longer than usual. Reload the page in a minute; the talk appears as soon as Paystack confirms it.",
  },
  fst_teater_leeg: { af: "Jou Teater is nog leeg.", en: "Your Theatre is still empty." },
  fst_na_talks: { af: "Kyk na die talks", en: "Browse the talks" },
  fst_program: { af: "Jou program", en: "Your programme" },
  fst_speler_fout: { af: "Kon nie die video laai nie. Herlaai die bladsy.", en: "Could not load the video. Reload the page." },
  // Fase 4c: koepons
  fst_koepon_vraag: { af: "Het jy 'n koeponkode?", en: "Have a coupon code?" },
  fst_koepon_pas_toe: { af: "Pas toe", en: "Apply" },
  fst_koepon_plek: { af: "KOEPONKODE", en: "COUPON CODE" },
  fst_koepon_aanvaar: { af: "Koepon aanvaar", en: "Coupon accepted" },
  fst_koepon_ONBEKEND: { af: "Hierdie kode bestaan nie.", en: "This code does not exist." },
  fst_koepon_ONAKTIEF: { af: "Hierdie koepon is nie meer aktief nie.", en: "This coupon is no longer active." },
  fst_koepon_VERVAL: { af: "Hierdie koepon het verval.", en: "This coupon has expired." },
  fst_koepon_VOLGEBRUIK: { af: "Hierdie koepon is klaar gebruik.", en: "This coupon has been used up." },
  fst_koepon_NIE_JOUNE: { af: "Hierdie koepon is nie vir jou rekening nie.", en: "This coupon is not for your account." },
  fst_koepon_GEEN_TOEPASSING: { af: "Hierdie koepon geld nie vir hierdie talk nie.", en: "This coupon does not apply to this talk." },
  fst_koepon_REEDS_GEBRUIK: { af: "Jy het hierdie koepon reeds vir hierdie talk gebruik.", en: "You have already used this coupon for this talk." },
});
