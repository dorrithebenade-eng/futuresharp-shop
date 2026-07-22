// Eenvoudige i18n-module vir Future Shop se PLATFORM-teks — nav, knoppies,
// etikette, foutboodskappe, instruksies.
//
// BELANGRIK: hierdie module vertaal NOOIT boek-inhoud nie (titel, oorsig,
// volledige beskrywing). 'n Afrikaanse boek se beskrywing bly Afrikaans,
// 'n Engelse boek s'n bly Engels — die katalogus-data self is nie deel van
// hierdie woordeboek nie, ongeag watter taal die platform op 'n gegewe
// oomblik wys.
//
// Werking:
// - Statiese teks in HTML kry 'n data-i18n="sleutel"-merker; pas_i18n_toe()
//   vervang die element se textContent daarvolgens.
// - Dinamies-gegenereerde teks (in katalogus.js, produk.js, ens.) roep
//   eenvoudig t("sleutel") aan i.p.v. 'n hardgekodeerde string te tik.
// - Taalwisseling herlaai die bladsy — dit hou die implementering eenvoudig
//   en betroubaar (elke bladsy se JS bou klaar sy inhoud met die korrekte
//   taal op laai, sonder om aparte "herbou almal dinamies"-logika oral te
//   moet byvoeg).

const TAAL_SLEUTEL = "future_shop_taal";

const WOORDEBOEK = {
  // Nav
  nav_mandjie: { af: "Mandjie", en: "Cart" },

  // Kop (tuisblad)
  kop_titel_normaal: { af: "Welkom by", en: "Welcome to" },
  kop_subtitel: {
    af: "Future Sharp se eie boekwinkel. Loer gerus na ons versameling e-boeke, of bestel selfs jou harde kopie van 'n boek indien dit in harde-kopie-formaat beskikbaar is.",
    en: "Future Sharp's own bookshop. Browse our collection of e-books, or order a hard copy of a book where a hard-copy format is available.",
  },
  katalogus_laai: { af: "Katalogus word gelaai …", en: "Loading catalogue …" },
  katalogus_leeg: { af: "Nog geen produkte beskikbaar nie.", en: "No products available yet." },
  katalogus_demo: {
    af: "Voorskou-modus: die lewendige katalogus-Function is nie bereikbaar nie — demo-produkte word gewys.",
    en: "Preview mode: the live catalogue function is unreachable — demo products are shown.",
  },
  koop_nou: { af: "Koop nou", en: "Buy now" },
  eboek_etiket: { af: "E-boek", en: "E-book" },
  hardekopie_etiket: { af: "Harde kopie", en: "Hard copy" },
  voorbestelling_chip: { af: "Voorbestelling", en: "Pre-order" },

  // Produk-bladsy
  produk_laai: { af: "Produk word gelaai …", en: "Loading product …" },
  terug_katalogus: { af: "← Terug na katalogus", en: "← Back to catalogue" },
  terug_katalogus_skakel: { af: "Terug na katalogus", en: "Back to catalogue" },
  voeg_by_mandjie: { af: "Voeg by mandjie", en: "Add to cart" },
  voorbestel_nou: { af: "Voorbestel nou", en: "Pre-order now" },
  voorbestelling_beskikbaar_vanaf: { af: "Voorbestelling — beskikbaar vanaf", en: "Pre-order — available from" },
  reeds_in_mandjie: { af: "Reeds in jou mandjie.", en: "Already in your cart." },
  in_mandjie_teken: { af: "In mandjie ✓", en: "In cart ✓" },
  voorbestel_teken: { af: "Voorbestel ✓", en: "Pre-ordered ✓" },
  bygevoeg_mandjie: { af: "Bygevoeg by mandjie.", en: "Added to cart." },
  voorbestelling_bygevoeg: {
    af: "Voorbestelling bygevoeg — jy betaal nou, en kry toegang sodra dit vrygestel word.",
    en: "Pre-order added — you pay now, and get access once it's released.",
  },
  geen_produk: { af: "Geen produk gespesifiseer nie.", en: "No product specified." },
  produk_nie_gevind: { af: "Hierdie produk kon nie gevind word nie.", en: "This product could not be found." },

  // Mandjie-bladsy
  bly_aan_koop: { af: "← Bly aan koop", en: "← Continue shopping" },
  jou_mandjie: { af: "Jou mandjie", en: "Your cart" },
  mandjie_laai: { af: "Mandjie word gelaai …", en: "Loading cart …" },
  mandjie_leeg: { af: "Jou mandjie is leeg.", en: "Your cart is empty." },
  blaai_katalogus: { af: "Blaai deur die katalogus", en: "Browse the catalogue" },
  verwyder: { af: "Verwyder", en: "Remove" },
  totaal: { af: "Totaal", en: "Total" },
  voltooi_betaling_knoppie: { af: "Voltooi betaling", en: "Complete payment" },

  // Voltooi-betaling
  terug_mandjie: { af: "← Terug na mandjie", en: "← Back to cart" },
  voltooi_betaling_titel: { af: "Voltooi betaling", en: "Complete payment" },
  word_gelaai: { af: "Word gelaai …", en: "Loading …" },
  bestelnommer_etiket: { af: "Bestelnommer", en: "Order number" },
  bestelling_opsomming: { af: "Bestelling-opsomming", en: "Order summary" },
  aflewering_titel: { af: "Aflewering", en: "Delivery" },
  aflewering_nota: {
    af: "Jou mandjie bevat 'n harde-kopie-item — verskaf asseblief 'n afleweradres.",
    en: "Your cart contains a hard-copy item — please provide a delivery address.",
  },
  straatadres: { af: "Straatadres", en: "Street address" },
  stad: { af: "Stad", en: "City" },
  provinsie: { af: "Provinsie", en: "Province" },
  poskode: { af: "Poskode", en: "Postal code" },
  kontakbesonderhede: { af: "Kontakbesonderhede", en: "Contact details" },
  epos: { af: "E-pos", en: "Email" },
  selfoonnommer: { af: "Selfoonnommer", en: "Cellphone number" },
  verplig: { af: "(verplig)", en: "(required)" },
  epos_verplig: { af: "E-pos is verplig.", en: "Email is required." },
  selfoon_verplig: { af: "Selfoonnommer is verplig.", en: "Cellphone number is required." },
  volledige_adres_verplig: {
    af: "Vul asseblief die volledige afleweradres in.",
    en: "Please fill in the complete delivery address.",
  },
  gaan_na_betaling: { af: "Gaan na betaling", en: "Proceed to payment" },
  besig: { af: "Besig …", en: "Processing …" },
  betaling_fout: {
    af: "Kon nie tans na betaling gaan nie — die betaalfunksie is dalk nog nie ontplooi/opgestel nie. Probeer weer, of kontak ons as dit voortduur.",
    en: "Could not proceed to payment right now — the payment function may not be deployed/configured yet. Please try again, or contact us if this continues.",
  },

  // Dankie-bladsy
  dankie_titel: { af: "Dankie vir jou bestelling!", en: "Thank you for your order!" },
  dankie_teks: {
    af: 'Ons bevestig jou betaling tans bediener-kant. Sodra dit voltooi is, sal jou e-boeke onmiddellik in "My Boeke" beskikbaar wees, en jy sal die status van enige harde-kopie-items daar kan volg.',
    en: 'We\'re confirming your payment server-side. Once that\'s done, your e-books will immediately be available in "My Books", and you\'ll be able to track the status of any hard-copy items there.',
  },
  terug_winkel: { af: "Terug na die winkel", en: "Back to the shop" },
};

function kry_huidige_taal() {
  return localStorage.getItem(TAAL_SLEUTEL) || "af";
}

function stel_taal(taal) {
  if (taal === kry_huidige_taal()) return;
  localStorage.setItem(TAAL_SLEUTEL, taal);
  // Eenvoudigste betroubare aanpak: herlaai die bladsy. Elke bladsy se
  // eie JS (katalogus.js, produk.js, ens.) bou sy inhoud reeds vanaf nuuts
  // af by laai, en t() lees die taal elke keer vars uit localStorage —
  // so 'n herlaai gee outomaties die korrekte taal orals, sonder om
  // aparte "herbou-dinamies"-logika in elke lêer te moet byvoeg.
  window.location.reload();
}

function t(sleutel) {
  const inskrywing = WOORDEBOEK[sleutel];
  if (!inskrywing) {
    console.warn(`Geen vertaling vir sleutel "${sleutel}" nie`);
    return sleutel;
  }
  return inskrywing[kry_huidige_taal()] || inskrywing.af;
}

function pas_i18n_toe() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.documentElement.lang = kry_huidige_taal() === "en" ? "en" : "af";
}

function wys_taal_wisselaar_status() {
  const huidige = kry_huidige_taal();
  document.querySelectorAll(".taal-knoppie").forEach((knoppie) => {
    knoppie.classList.toggle("taal-knoppie-aktief", knoppie.dataset.taal === huidige);
  });
}

function koppel_taal_wisselaar() {
  document.querySelectorAll(".taal-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => stel_taal(knoppie.dataset.taal));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  pas_i18n_toe();
  koppel_taal_wisselaar();
  wys_taal_wisselaar_status();
});
