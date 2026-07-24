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

  // Personeel-paneelbord
  paneel_titel: { af: "Personeel-paneelbord", en: "Staff panel" },
  paneel_meld_af: { af: "Meld af", en: "Log out" },
  paneel_meld_aan_titel: { af: "Meld aan", en: "Log in" },
  paneel_aanmeld_hulp: {
    af: "Net vir personeel — kontak die eienaar as jy nog nie 'n rekening het nie.",
    en: "Staff only — contact the owner if you don't have an account yet.",
  },
  paneel_epos: { af: "Epos", en: "Email" },
  paneel_wagwoord: { af: "Wagwoord", en: "Password" },
  paneel_meld_aan_knoppie: { af: "Meld aan", en: "Log in" },
  paneel_wagwoord_vergeet: { af: "Wagwoord vergeet?", en: "Forgot password?" },
  paneel_herstel_titel: { af: "Wagwoord herstel", en: "Reset password" },
  paneel_stuur_herstel: { af: "Stuur herstel-skakel", en: "Send reset link" },
  paneel_terug_aanmeld: { af: "Terug na aanmeld", en: "Back to login" },
  paneel_herstel_sukses: {
    af: "'n Herstel-skakel is gestuur — kyk jou e-pos.",
    en: "A reset link has been sent — check your email.",
  },
  paneel_nuwe_wagwoord_titel: { af: "Stel jou wagwoord", en: "Set your password" },
  paneel_nuwe_wagwoord_etiket: { af: "Nuwe wagwoord", en: "New password" },
  paneel_stel_wagwoord_knoppie: { af: "Stel wagwoord", en: "Set password" },
  paneel_katalogus_titel: { af: "Katalogus", en: "Catalogue" },
  paneel_voeg_produk_by_knoppie: { af: "+ Voeg produk by", en: "+ Add product" },
  paneel_produkte_laai: { af: "Produkte word gelaai …", en: "Loading products …" },
  paneel_voeg_produk_by_titel: { af: "Voeg produk by", en: "Add product" },
  paneel_kanselleer: { af: "✕ Kanselleer", en: "✕ Cancel" },
  vorm_slug_etiket: {
    af: 'Slug (kort, unieke kode — bv. "my-boek-titel")',
    en: 'Slug (short, unique code — e.g. "my-book-title")',
  },
  vorm_titel_etiket: { af: "Titel", en: "Title" },
  vorm_outeur_etiket: { af: "Outeur", en: "Author" },
  vorm_oorsig_etiket: {
    af: "Oorsig (verskyn op die katalogus-kaart, ongeveer 100 woorde)",
    en: "Overview (appears on the catalogue card, around 100 words)",
  },
  vorm_vol_beskrywing_etiket: {
    af: "Volledige beskrywing (verskyn op die produk-bladsy)",
    en: "Full description (appears on the product page)",
  },
  vorm_omslag_etiket: { af: "Omslag — beeld-URL/-pad", en: "Cover — image URL/path" },
  vorm_omslag_hulp: {
    af: 'Lêer-oplaai is nog nie gebou nie — plaas die omslagbeeld self in public/images/omslae/ en tik die pad hier in.',
    en: "File upload hasn't been built yet — place the cover image yourself in public/images/omslae/ and type the path here.",
  },
  vorm_omslag_hulp_nuut: {
    af: "Kies 'n beeld (JPEG, PNG, WEBP of GIF, maks. 4MB) — dit word outomaties opgelaai en gestoor.",
    en: "Choose an image (JPEG, PNG, WEBP or GIF, max 4MB) — it will be uploaded and stored automatically.",
  },
  paneel_oplaai_besig: { af: "Word opgelaai …", en: "Uploading …" },
  paneel_oplaai_sukses: { af: "Omslag opgelaai ✓", en: "Cover uploaded ✓" },
  paneel_oplaai_fout: { af: "Kon nie beeld oplaai nie: ", en: "Could not upload image: " },
  paneel_oplaai_te_groot: { af: "Beeld is te groot — maksimum 4MB.", en: "Image is too large — maximum 4MB." },
  paneel_oplaai_verkeerde_tipe: {
    af: "Slegs JPEG, PNG, WEBP of GIF-beelde word toegelaat.",
    en: "Only JPEG, PNG, WEBP or GIF images are allowed.",
  },
  paneel_beskikbaar: { af: "Beskikbaar", en: "Available" },
  paneel_prys_r: { af: "Prys (R)", en: "Price (R)" },
  paneel_vrystellingsdatum: {
    af: "Vrystellingsdatum (leeg = dadelik beskikbaar)",
    en: "Release date (leave empty = available immediately)",
  },
  paneel_outeur_verdeling: {
    af: "Outeur-verdeling(s) (Paystack-subrekening) op hierdie formaat",
    en: "Author split(s) (Paystack subaccount) on this format",
  },
  paneel_subrekening_kode: { af: "Subrekening-kode (ACCT_...)", en: "Subaccount code (ACCT_...)" },
  paneel_tipe: { af: "Tipe", en: "Type" },
  paneel_persentasie: { af: "Persentasie", en: "Percentage" },
  paneel_vaste_bedrag: { af: "Vaste bedrag", en: "Fixed amount" },
  paneel_waarde: { af: "Waarde (% of R, na gelang van tipe)", en: "Value (% or R, depending on type)" },
  paneel_voorraad_status: { af: "Voorraad-status", en: "Stock status" },
  paneel_uitverkoop: { af: "Uitverkoop", en: "Sold out" },
  paneel_skep_produk: { af: "Skep produk", en: "Create product" },
  paneel_eboek: { af: "E-boek", en: "E-book" },
  paneel_hardekopie: { af: "Harde kopie", en: "Hard copy" },

  // Outeurs-register
  paneel_outeurs_titel: { af: "Outeurs", en: "Authors" },
  paneel_voeg_outeur_by_knoppie: { af: "+ Voeg outeur by", en: "+ Add author" },
  paneel_outeurs_hulp: {
    af: "Voeg elke outeur hier EEN KEER by (naam + Paystack-subrekening-kode) — kies hulle daarna eenvoudig uit 'n lys wanneer jy 'n boek se outeur-verdeling opstel, sonder om die rou kode elke keer te moet intik.",
    en: "Add each author here ONCE (name + Paystack subaccount code) — from then on, simply pick them from a list when setting up a book's author split, without needing to type the raw code every time.",
  },
  paneel_outeurs_laai: { af: "Outeurs word gelaai …", en: "Loading authors …" },
  paneel_kon_nie_outeurs_laai: {
    af: "Kon nie outeurs laai nie — probeer weer.",
    en: "Could not load authors — try again.",
  },
  paneel_nog_geen_outeurs: { af: "Nog geen outeurs nie — voeg die eerste een by.", en: "No authors yet — add the first one." },
  paneel_outeur_naam_etiket: { af: "Naam", en: "Name" },
  paneel_kies_outeur: { af: "— kies outeur —", en: "— select author —" },
  paneel_voeg_verdeling_by: { af: "+ Voeg verdeling by", en: "+ Add split" },
  paneel_verwyder_verdeling: { af: "Verwyder verdeling", en: "Remove split" },

  paneel_kon_nie_produkte_laai: { af: "Kon nie produkte laai nie — probeer weer.", en: "Could not load products — try again." },
  paneel_nog_geen_produkte: { af: "Nog geen produkte nie — voeg die eerste een by.", en: "No products yet — add the first one." },
  paneel_geen_formaat: { af: "Geen formaat beskikbaar nie", en: "No format available" },
  paneel_wysig: { af: "Wysig", en: "Edit" },
  paneel_deaktiveer: { af: "Deaktiveer", en: "Deactivate" },
  paneel_aktiveer: { af: "Aktiveer", en: "Activate" },
  paneel_onaktief: { af: "Onaktief", en: "Inactive" },
  paneel_wysig_titel_voorvoegsel: { af: "Wysig — ", en: "Edit — " },
  paneel_stoor_wysigings: { af: "Stoor wysigings", en: "Save changes" },
  paneel_verpligte_velde_fout: {
    af: "Slug, titel en outeur is verpligte velde.",
    en: "Slug, title and author are required fields.",
  },
  paneel_formaat_verplig_fout: {
    af: "Ten minste een formaat (e-boek of harde kopie) moet beskikbaar wees.",
    en: "At least one format (e-book or hard copy) must be available.",
  },
  paneel_kon_nie_stoor: { af: "Kon nie stoor nie: ", en: "Could not save: " },
  paneel_kon_nie_status_wysig: {
    af: "Kon nie die produk se status wysig nie — probeer weer.",
    en: "Could not change the product's status — try again.",
  },
  paneel_geen_personeel_rol: {
    af: "Jou rekening het nie 'n personeel-rol nie — kontak die eienaar om toegang te kry.",
    en: "Your account doesn't have a staff role — contact the owner for access.",
  },
  paneel_kon_nie_aanmeld: { af: "Kon nie aanmeld nie: ", en: "Could not log in: " },
  paneel_kon_nie_wagwoord_stel: { af: "Kon nie wagwoord stel nie: ", en: "Could not set password: " },
  paneel_kon_nie_herstel_stuur: { af: "Kon nie herstel-epos stuur nie: ", en: "Could not send reset email: " },

  // My Boeke
  my_boeke_titel: { af: "My Boeke", en: "My Books" },
  my_boeke_subtitel: { af: "Al jou gekoopte e-boeke, gereed om te lees.", en: "All your purchased e-books, ready to read." },
  lees_aanlyn: { af: "Lees aanlyn", en: "Read online" },
  beskikbaar_vanaf: { af: "Beskikbaar vanaf", en: "Available from" },
  nog_nie_beskikbaar: { af: "Nog nie beskikbaar nie", en: "Not yet available" },
  meld_aan_vir_my_boeke: { af: "Meld eers aan om jou boeke te sien.", en: "Log in to see your books." },
  laai_tans: { af: "Laai …", en: "Loading …" },
  sessie_verval: { af: "Sessie verval — meld weer aan.", en: "Session expired — log in again." },
  geen_boeke_nog: { af: "Nog geen boeke gekoop nie.", en: "No books purchased yet." },
  fout_boeke_laai: { af: "Kon nie boeke laai nie. Probeer weer.", en: "Couldn't load books. Try again." },

  // Aanmeld / Registreer / Herstel (kopers)
  aanmeld_titel: { af: "Meld aan", en: "Log in" },
  epos_etiket: { af: "E-pos", en: "Email" },
  wagwoord_etiket: { af: "Wagwoord", en: "Password" },
  meld_aan_knoppie: { af: "Meld aan", en: "Log in" },
  geen_rekening_nog: { af: "Het jy nog geen rekening nie?", en: "Don't have an account yet?" },
  registreer_hier: { af: "Registreer hier", en: "Register here" },
  wagwoord_vergeet: { af: "Wagwoord vergeet?", en: "Forgot your password?" },
  registreer_titel: { af: "Skep 'n rekening", en: "Create an account" },
  registreer_knoppie: { af: "Registreer", en: "Register" },
  het_reeds_rekening: { af: "Het jy reeds 'n rekening?", en: "Already have an account?" },
  meld_aan_hier: { af: "Meld hier aan", en: "Log in here" },
  herstel_titel: { af: "Herstel wagwoord", en: "Reset password" },
  stuur_herstel_knoppie: { af: "Stuur herstel-skakel", en: "Send reset link" },
  terug_na_aanmeld: { af: "Terug na aanmeld", en: "Back to login" },
  meld_tans_aan: { af: "Meld aan …", en: "Logging in …" },
  aanmeld_fout: { af: "Verkeerde epos of wagwoord.", en: "Incorrect email or password." },
  registreer_tans: { af: "Skep rekening …", en: "Creating account …" },
  registreer_sukses_bevestig_epos: { af: "Rekening geskep. Bevestig dit via die skakel in jou epos.", en: "Account created. Confirm it via the link in your email." },
  registreer_fout: { af: "Kon nie registreer nie. Probeer weer.", en: "Couldn't register. Try again." },
  stuur_tans_herstel: { af: "Stuur …", en: "Sending …" },
  herstel_epos_gestuur: { af: "Herstel-skakel gestuur — kyk jou epos.", en: "Reset link sent — check your email." },
  herstel_fout: { af: "Kon nie die epos stuur nie. Probeer weer.", en: "Couldn't send the email. Try again." },
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
