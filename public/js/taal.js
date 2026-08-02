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
  nav_kursusse: { af: "Kursusse", en: "Courses" },
  nav_kontak: { af: "Kontak", en: "Contact" },
  filter_alle: { af: "Alle", en: "All" },
  opsioneel: { af: "(opsioneel)", en: "(optional)" },

  // Statistieke-blokkie
  statistiek_totaal: { af: "Totaal", en: "Total" },
  statistiek_vandag: { af: "Vandag", en: "Today" },
  statistiek_week: { af: "Hierdie week", en: "This week" },
  statistiek_week_nota: {
    af: "Herstel elke Maandag (ISO-week). Val toevallig saam met 'Totaal' as die teller self nog binne sy eerste week is.",
    en: "Resets every Monday (ISO week). Coincides with 'Total' if the counter itself is still within its first week.",
  },
  statistiek_maand: { af: "Hierdie maand", en: "This month" },
  statistiek_maandelikse_geskiedenis: { af: "Maandelikse geskiedenis", en: "Monthly history" },
  statistiek_herstel_bevestig: {
    af: "Herstel die totale besoekerstal na 0? Dit kan nie ongedaan gemaak word nie.",
    en: "Reset the total visitor count to 0? This cannot be undone.",
  },
  statistiek_kon_nie_herstel: { af: "Kon nie herstel nie — probeer weer.", en: "Could not reset — try again." },

  // Sy-kieslys-oortjies
  paneel_nav_uitnodigings: { af: "Uitnodigings", en: "Invitations" },
  paneel_nav_waarskuwings: { af: "⚠️ Waarskuwings", en: "⚠️ Warnings" },
  paneel_nav_kategoriee: { af: "Kategorieë", en: "Categories" },
  paneel_word_gelaai: { af: "Word gelaai …", en: "Loading …" },
  paneel_kopieer: { af: "Kopieer", en: "Copy" },
  paneel_kanselleer_kort: { af: "Kanselleer", en: "Cancel" },

  // Uitnodigings-afdeling
  uitnodiging_hulp_teks: {
    af: "Genereer 'n skakel vir 'n nuwe rolspeler om self hul inligting in te vul. Hulle word outomaties by die betrokke register gevoeg (sonder Paystack-subrekening — voeg dit self later by sodra jy dit opgestel het).",
    en: "Generate a link for a new role-player to fill in their own information. They're automatically added to the relevant register (without a Paystack subaccount — add that yourself later once you've set it up).",
  },
  uitnodiging_rol_etiket: { af: "Rol", en: "Role" },
  rol_outeur: { af: "Outeur", en: "Author" },
  rol_vennoot: { af: "Vennoot (direkteur)", en: "Partner (director)" },
  rol_ontwerp_admin: { af: "Ontwerp/Admin", en: "Design/Admin" },
  rol_printing: { af: "Printing", en: "Printing" },
  rol_aflewering: { af: "Aflewering", en: "Delivery" },
  uitnodiging_genereer_knoppie: { af: "+ Genereer skakel", en: "+ Generate link" },
  uitnodiging_nuwe_skakel_etiket: { af: "Nuwe skakel — kopieer en stuur aan die persoon", en: "New link — copy and send to the person" },
  uitnodiging_rekord_titel: { af: "Rekord van uitnodigings", en: "Record of invitations" },
  uitnodiging_lys_laai: { af: "Uitnodigings word gelaai …", en: "Loading invitations …" },
  uitnodiging_gekopieer: { af: "Gekopieer!", en: "Copied!" },
  uitnodiging_geen_gestuur: { af: "Nog geen uitnodigings gestuur nie.", en: "No invitations sent yet." },
  uitnodiging_status_voltooi: { af: "Voltooi", en: "Completed" },
  uitnodiging_status_hangend: { af: "Hangend sedert", en: "Pending since" },
  uitnodiging_kon_nie_laai: { af: "Kon nie uitnodigings laai nie.", en: "Could not load invitations." },

  // Waarskuwings-afdeling
  waarskuwing_titel: { af: "⚠️ Betaling-waarskuwings", en: "⚠️ Payment warnings" },
  waarskuwing_hulp_teks: {
    af: "Bestellings waar 'n outeur/vennoot se subrekening-kode nie kon werk nie (bv. foutief of nog nie by Paystack opgestel nie) — die betaling het steeds deurgegaan, met die volle bedrag na die hoofrekening. Gaan die betrokke subrekening-kode(s) na en werk dit reg in die register; toekomstige bestellings vir dieselfde boek sal dan weer korrek verdeel word.",
    en: "Orders where an author/partner's subaccount code didn't work (e.g. incorrect, or not yet set up on Paystack) — the payment still went through, with the full amount going to the main account. Check the relevant subaccount code(s) and fix it in the register; future orders for the same book will then split correctly again.",
  },
  waarskuwing_geen: { af: "Geen betaling-waarskuwings nie — alles werk soos verwag. ✅", en: "No payment warnings — everything is working as expected. ✅" },
  waarskuwing_kon_nie_laai: { af: "Kon nie waarskuwings laai nie.", en: "Could not load warnings." },

  // Kategorieë-afdeling
  kategorie_voeg_by_knoppie: { af: "+ Voeg kategorie by", en: "+ Add category" },
  kategorie_hulp_teks: {
    af: "Kategorieë wat kopers op die katalogus kan gebruik om te filter (bv. Fiksie, Selfhelp). 'n Boek kan in meer as een kategorie wees.",
    en: "Categories buyers can use to filter the catalogue (e.g. Fiction, Self-help). A book can be in more than one category.",
  },
  kategorie_naam_etiket: { af: "Naam", en: "Name" },
  kategorie_kon_nie_laai: { af: "Kon nie kategorieë laai nie.", en: "Could not load categories." },
  kategorie_leeg: { af: "Nog geen kategorieë bygevoeg nie.", en: "No categories added yet." },
  kategorie_kon_nie_stoor: { af: "Kon nie stoor nie", en: "Could not save" },
  kategorie_skrap_vraag_voorvoegsel: { af: "Skrap", en: "Delete" },
  kategorie_kon_nie_skrap: { af: "Kon nie skrap nie", en: "Could not delete" },
  kategorie_geen_vir_produk: {
    af: "Nog geen kategorieë geskep nie — voeg eers een by via die Kategorieë-oortjie.",
    en: "No categories created yet — add one via the Categories tab first.",
  },
  kontak_titel: { af: "Is jy 'n skrywer?", en: "Are you a writer?" },
  kontak_intro: {
    af: "Kontak ons gerus as jy 'n skrywer is wat graag jou boek(e) in ons winkel wil verkoop. Verskeie opsies is beskikbaar — ons gesels graag met jou oor wat die beste vir jou werk sal werk.",
    en: "Feel free to contact us if you're a writer who would like to sell your book(s) in our shop. Several options are available — we'd love to chat about what would work best for your work.",
  },
  kontak_epos_etiket: { af: "Stuur vir ons 'n e-pos", en: "Send us an email" },
  kontak_stuur_knoppie: { af: "Stuur e-pos", en: "Send email" },
  kontak_terugvoer: { af: "Ons kontak jou binnekort terug.", en: "We'll get back to you soon." },
  kontak_raamwerk_nota: {
    af: "As jy op die knoppie klik, open jou e-posprogram met 'n paar vrae reeds ingevul — vul dit sommer daar in voor jy stuur.",
    en: "Clicking the button opens your email app with a few questions already filled in — just fill them in there before sending.",
  },

  // Vooraf-ingevulde e-pos-raamwerk (word deur kontak.js in die mailto-skakel gebou)
  kontak_epos_onderwerp: { af: "Future Shop Outeurs-belangstelling", en: "Future Shop Authors Interest" },
  kontak_raamwerk_naam: { af: "Naam", en: "Name" },
  kontak_raamwerk_kontaknommer: { af: "Kontaknommer", en: "Contact number" },
  kontak_raamwerk_agtergrond_vraag: {
    af: "Vertel bietjie van jouself as skrywer:",
    en: "Tell us a bit about yourself as a writer:",
  },
  kontak_raamwerk_hoeveel_boeke: { af: "Hoeveel boek(e) wil jy verkoop?", en: "How many book(s) would you like to sell?" },
  kontak_raamwerk_titels_kategoriee_vraag: {
    af: "Titel(s) en kategorie(ë) (bv. Fiksie, Niefiksie, Kinderboeke, Selfhelp):",
    en: "Title(s) and categorie(s) (e.g. Fiction, Non-fiction, Children's, Self-help):",
  },
  kontak_raamwerk_formaat_vraag: {
    af: "Watter formaat(e) beoog jy — e-boek, harde kopie, of albei?",
    en: "Which format(s) are you considering — e-book, hard copy, or both?",
  },
  kontak_raamwerk_bykomend: { af: "Enige bykomende inligting:", en: "Any additional information:" },

  // Kop (tuisblad)
  kop_eyebrow: { af: "E-boeke · Harde kopieë", en: "E-books · Hard copies" },
  kop_titel_normaal: { af: "Welkom by", en: "Welcome to" },
  kop_subtitel: {
    af: "Future Sharp se eie boekwinkel. Loer gerus na ons versameling e-boeke, of bestel selfs jou harde kopie van 'n boek indien dit in harde-kopie-formaat beskikbaar is.",
    en: "Future Sharp's own bookshop. Browse our collection of e-books, or order a hard copy of a book where a hard-copy format is available.",
  },
  kop_cta: { af: "Kyk gerus deur ons katalogus", en: "Browse our catalogue" },
  katalogus_laai: { af: "Katalogus word gelaai …", en: "Loading catalogue …" },
  katalogus_leeg: { af: "Nog geen produkte beskikbaar nie.", en: "No products available yet." },
  katalogus_leeg_titel: { af: "Binnekort in aksie", en: "Coming soon" },
  katalogus_leeg_beskrywing: {
    af: "Ons is besig om die winkel gereed te maak — kom kyk binnekort weer.",
    en: "We're getting the shop ready — check back soon.",
  },
  katalogus_demo: {
    af: "Voorskou-modus: die lewendige katalogus-Function is nie bereikbaar nie — demo-produkte word gewys.",
    en: "Preview mode: the live catalogue function is unreachable — demo products are shown.",
  },
  koop_nou: { af: "Koop nou", en: "Buy now" },
  eboek_etiket: { af: "E-boek", en: "E-book" },
  hardekopie_etiket: { af: "Harde kopie", en: "Hard copy" },
  voorbestelling_chip: { af: "Voorbestelling", en: "Pre-order" },
  reeds_gekoop: { af: "Gekoop", en: "Purchased" },
  gaan_lees: { af: "Gaan lees →", en: "Go read →" },
  leen_etiket: { af: "Leen", en: "Borrow" },
  leen_nou_knoppie: { af: "Leen nou", en: "Borrow now" },
  leen_dae_oor_voorvoegsel: { af: "Geleen —", en: "Borrowed —" },
  leen_tydperk_voorvoegsel: { af: "Toegang vir", en: "Access for" },
  dag_enkelvoud: { af: "dag oor", en: "day left" },
  dae_meervoud: { af: "dae", en: "days" },
  dae_oor_meervoud: { af: "dae oor", en: "days left" },
  leen_verval_etiket: { af: "Reeds gelees", en: "Already read" },
  leen_kennisgewing_voorvoegsel: { af: "Geleen —", en: "Borrowed —" },
  leen_verval_boodskap: {
    af: "Jou leen-tydperk vir hierdie e-boek het verval. Koop dit, of leen dit weer, om verder te lees.",
    en: "Your loan period for this e-book has expired. Buy it, or borrow it again, to keep reading.",
  },
  beskikbaar_as_etiket: { af: "Beskikbaar as:", en: "Available as:" },

  // Katalogus-sortering (winkel) — sien katalogus-sorteer.js
  sorteer_etiket: { af: "Sorteer", en: "Sort" },
  sorteer_nuutste: { af: "Nuutste eerste", en: "Newest first" },
  sorteer_titel: { af: "Titel A\u2013Z", en: "Title A\u2013Z" },
  sorteer_outeur: { af: "Outeur A\u2013Z", en: "Author A\u2013Z" },
  sorteer_prys_op: { af: "Prys \u2014 laagste eerste", en: "Price \u2014 lowest first" },
  sorteer_prys_af: { af: "Prys \u2014 hoogste eerste", en: "Price \u2014 highest first" },
  leen_verduideliking: {
    af: "Leen die e-boek vir %tydperk% dae.",
    en: "Borrow the e-book for %tydperk% days.",
  },

  // Formaat-verduideliking-opspring-venster (klik op 'n "Beskikbaar as"-skyfie)
  formaat_lees_teks: {
    af: "Lees op jou rekenaar, tablet of selfoon, in 'n leser wat spesiaal vir e-boeke gemaak is.",
    en: "Read on your computer, tablet or phone, in a reader made specially for e-books.",
  },
  formaat_info_eboek_opskrif: { af: "Hoe werk E-boek?", en: "How does E-book work?" },
  formaat_info_leen_opskrif: { af: "Hoe werk Leen?", en: "How does Borrow work?" },
  formaat_info_hardekopie_opskrif: { af: "Hoe werk Harde kopie?", en: "How does Hard copy work?" },
  formaat_info_hardekopie_teks: {
    af: "Afgelewer binne Suid-Afrika, binne 7 tot 14 werksdae na jou adres — aflewering reeds in die prys ingesluit.",
    en: "Delivered within South Africa, within 7 to 14 working days to your address — delivery already included in the price.",
  },
  formaat_info_maak_toe: { af: "Maak toe", en: "Close" },
  lees_meer: { af: "Lees meer", en: "Read more" },
  vanaf_prys: { af: "Vanaf", en: "From" },

  // Produk-bladsy
  produk_laai: { af: "Produk word gelaai …", en: "Loading product …" },
  terug_katalogus: { af: "← Terug na katalogus", en: "← Back to catalogue" },
  terug_katalogus_skakel: { af: "Terug na katalogus", en: "Back to catalogue" },
  voeg_by_mandjie: { af: "Voeg by mandjie", en: "Add to cart" },
  oor_hierdie_boek: { af: "Oor hierdie boek", en: "About this book" },
  isbn_etiket: { af: "ISBN", en: "ISBN" },
  isbn_eboek: { af: "E-boek", en: "E-book" },
  isbn_hardekopie: { af: "Harde kopie", en: "Hard copy" },
  kies_formaat: { af: "Kies jou formaat", en: "Choose your format" },
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
  koepon_etiket: { af: "Het jy 'n koepon-kode?", en: "Do you have a coupon code?" },
  koepon_plekhouer: { af: "Voer koepon-kode in", en: "Enter coupon code" },
  koepon_toepas_knoppie: { af: "Wissel koepon", en: "Redeem" },
  koepon_verwyder_knoppie: { af: "Verwyder", en: "Remove" },
  koepon_toegepas_gratis: { af: "✅ Koepon toegepas — hierdie bestelling is nou gratis!", en: "✅ Coupon applied — this order is now free!" },
  koepon_toegepas_afslag: { af: "✅ Koepon toegepas — jy bespaar", en: "✅ Coupon applied — you save" },
  koepon_ongeldig: { af: "Koepon-kode is nie geldig nie", en: "Coupon code is not valid" },
  koepon_fout_onaktief: { af: "Hierdie koepon is nie meer aktief nie", en: "This coupon is no longer active" },
  koepon_fout_verval: { af: "Hierdie koepon het verval", en: "This coupon has expired" },
  koepon_fout_volgebruik: { af: "Hierdie koepon is klaar ten volle gebruik", en: "This coupon has already been fully used" },
  koepon_fout_geen_toepassing: {
    af: "Hierdie koepon is nie van toepassing op enigiets in jou mandjie nie",
    en: "This coupon does not apply to anything in your cart",
  },
  koepon_fout_nie_joune: {
    af: "Hierdie koepon is nie vir jou rekening geldig nie",
    en: "This coupon is not valid for your account",
  },
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
  dankie_titel_aankoop: { af: "Dankie vir jou aankoop!", en: "Thank you for your purchase!" },
  dankie_teks_eboek_alleen: {
    af: 'Jou e-boek is nou beskikbaar in "My Boeke", gereed om te lees.',
    en: 'Your e-book is now available in "My Books", ready to read.',
  },
  dankie_teks_bevat_harde_kopie: {
    af: 'Ons bevestig jou betaling tans bediener-kant. Sodra dit voltooi is, sal enige e-boeke onmiddellik in "My Boeke" beskikbaar wees, en jy sal die status van jou harde-kopie-item(s) daar kan volg.',
    en: 'We\'re confirming your payment server-side. Once that\'s done, any e-books will immediately be available in "My Books", and you\'ll be able to track the status of your hard-copy item(s) there.',
  },
  gaan_na_my_boeke: { af: "Gaan na My Boeke", en: "Go to My Books" },
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
  paneel_kennisgewing_titel: { af: "Winkel-bannier", en: "Shop banner" },
  paneel_kennisgewing_hulp: {
    af: "'n Kort kennisgewing wat oor die onderkant van die tuisblad se hero wys — vir enigiets algemeens (nie aan 'n spesifieke boek gekoppel nie). Net EEN bannier op 'n slag.",
    en: "A short notice shown over the bottom of the homepage hero — for anything general (not tied to a specific book). Only ONE banner at a time.",
  },
  paneel_kennisgewing_teks_etiket: { af: "Bannier-teks", en: "Banner text" },
  paneel_kennisgewing_aktief_etiket: { af: "Wys op die tuisblad", en: "Show on homepage" },
  paneel_kennisgewing_stoor_knoppie: { af: "Stoor bannier", en: "Save banner" },
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
  vorm_isbn_eboek_etiket: { af: "ISBN — e-boek", en: "ISBN — e-book" },
  vorm_isbn_hardekopie_etiket: { af: "ISBN — harde kopie", en: "ISBN — hard copy" },
  vorm_isbn_hulp: {
    af: "Future Shop reik nie ISBN's uit nie. Vul slegs in wat die outeur verskaf het — die nommer verskyn dan op die produkbladsy. 'n Gedrukte en 'n elektroniese uitgawe het elk sy eie nommer.",
    en: "Future Shop does not issue ISBNs. Enter only what the author has supplied — the number then appears on the product page. A printed and an electronic edition each have their own number.",
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
  paneel_eboek_pdf_etiket: { af: "E-boek-PDF", en: "E-book PDF" },
  paneel_eboek_pdf_hulp: {
    af: "Kies die volledige boek-PDF — dit word stuksgewys opgelaai (werk ook vir groter lêers) en is nooit publiek toeganklik nie, net vir kopers wat dit gekoop het.",
    en: "Choose the full book PDF — it's uploaded in pieces (works for larger files too) and is never publicly accessible, only to buyers who purchased it.",
  },
  paneel_eboek_oplaai_verkeerde_tipe: { af: "Slegs PDF-lêers word toegelaat.", en: "Only PDF files are allowed." },
  paneel_eboek_oplaai_geen_slug: {
    af: "Vul eers die slug in voordat jy die PDF oplaai.",
    en: "Fill in the slug first before uploading the PDF.",
  },
  paneel_eboek_oplaai_besig: { af: "Word opgelaai", en: "Uploading" },
  paneel_eboek_oplaai_sukses: { af: "E-boek-PDF opgelaai ✓", en: "E-book PDF uploaded ✓" },
  paneel_eboek_reeds_opgelaai: { af: "PDF reeds opgelaai ✓", en: "PDF already uploaded ✓" },
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

  paneel_verdeling_rekenaar_titel: { af: "Verdeling-rekenaar", en: "Split calculator" },
  paneel_verdeling_rekenaar_hulp: {
    af: "Speel met die persentasies en koste om te sien watter boekprys en direkteursfooie elke scenario oplewer — vir gebruik tydens onderhandeling met outeurs.",
    en: "Play with the percentages and costs to see what book price and director fees each scenario produces — for use when negotiating with authors.",
  },
  paneel_dokumente_titel: { af: "Dokumente", en: "Documents" },
  paneel_dokumente_hulp: {
    af: "Alle voorstel-dokumente, riglyne en ander lêers wat julle met outeurs of ander partye deel, op een plek. Elke dokument het 'n eie aflaai-skakel wat via e-pos of WhatsApp gestuur kan word.",
    en: "All proposal documents, guidelines and other files you share with authors or other parties, in one place. Each document has its own download link that can be sent via email or WhatsApp.",
  },
  paneel_voeg_dokument_by_knoppie: { af: "+ Laai dokument op", en: "+ Upload document" },
  paneel_dokumente_laai: { af: "Dokumente word gelaai …", en: "Loading documents …" },
  paneel_koepons_titel: { af: "Koepons", en: "Coupons" },
  paneel_voeg_koepon_by_knoppie: { af: "+ Voeg koepon by", en: "+ Add coupon" },
  paneel_koepons_laai: { af: "Koepons word gelaai …", en: "Loading coupons …" },
  paneel_kon_nie_koepons_laai: { af: "Kon nie koepons laai nie.", en: "Could not load coupons." },
  paneel_nog_geen_koepons: { af: "Nog geen koepons nie — voeg die eerste een by.", en: "No coupons yet — add the first one." },
  paneel_koepon_kode_etiket: { af: "Kode", en: "Code" },
  paneel_koepon_genereer_knoppie: { af: "Genereer", en: "Generate" },
  paneel_koepon_tipe_etiket: { af: "Tipe", en: "Type" },
  paneel_koepon_tipe_gratis: { af: "Gratis-ontsluiting (geen betaling)", en: "Free unlock (no payment)" },
  paneel_koepon_tipe_afslag: { af: "Afslag (verminderde betaling)", en: "Discount (reduced payment)" },
  paneel_koepon_afslag_tipe_etiket: { af: "Afslag-tipe", en: "Discount type" },
  paneel_koepon_persentasie: { af: "Persentasie (%)", en: "Percentage (%)" },
  paneel_koepon_vaste_bedrag: { af: "Vaste bedrag (R)", en: "Fixed amount (R)" },
  paneel_koepon_afslag_waarde_etiket: { af: "Afslag-waarde", en: "Discount value" },
  paneel_koepon_produk_etiket: { af: "Boek", en: "Book" },
  paneel_koepon_enige_boek: { af: "Enige boek", en: "Any book" },
  paneel_koepon_formaat_etiket: { af: "Formaat", en: "Format" },
  paneel_koepon_formaat_albei: { af: "Alle formate", en: "All formats" },
  paneel_koepon_formaat_eboek: { af: "E-boek", en: "E-book" },
  paneel_koepon_formaat_hardekopie: { af: "Harde kopie", en: "Hard copy" },
  paneel_koepon_formaat_leen: { af: "Leen", en: "Borrow" },
  paneel_koepon_maks_gebruike_etiket: { af: "Maksimum aantal gebruike", en: "Maximum number of uses" },
  paneel_koepon_verval_etiket: { af: "Vervaldatum (opsioneel)", en: "Expiry date (optional)" },
  paneel_koepon_outeur_etiket: { af: "Outeur (opsioneel)", en: "Author (optional)" },
  paneel_koepon_geen_outeur: { af: "Geen (winkel self)", en: "None (shop itself)" },
  paneel_koepon_nota_etiket: { af: "Interne nota (opsioneel)", en: "Internal note (optional)" },
  paneel_koepon_status_aktief: { af: "Aktief", en: "Active" },
  paneel_koepon_status_onaktief: { af: "Onaktief", en: "Inactive" },
  paneel_koepon_status_verval: { af: "Verval", en: "Expired" },
  paneel_koepon_status_op: { af: "Opgebruik", en: "Used up" },
  paneel_voeg_verdeling_by: { af: "+ Voeg verdeling by", en: "+ Add split" },
  paneel_verwyder_verdeling: { af: "Verwyder verdeling", en: "Remove split" },

  paneel_kon_nie_produkte_laai: { af: "Kon nie produkte laai nie — probeer weer.", en: "Could not load products — try again." },
  paneel_nog_geen_produkte: { af: "Nog geen produkte nie — voeg die eerste een by.", en: "No products yet — add the first one." },
  paneel_geen_formaat: { af: "Geen formaat beskikbaar nie", en: "No format available" },
  paneel_wysig: { af: "Wysig", en: "Edit" },
  paneel_deaktiveer: { af: "Deaktiveer", en: "Deactivate" },
  paneel_aktiveer: { af: "Aktiveer", en: "Activate" },
  paneel_onaktief: { af: "Onaktief", en: "Inactive" },
  paneel_skrap: { af: "Skrap", en: "Delete" },
  paneel_skrap_bevestig: {
    af: 'Wis "%titel%" permanent uit? Dit verwyder ook die PDF en omslagbeeld, en kan nie ontdoen word nie.',
    en: 'Permanently delete "%titel%"? This also removes the PDF and cover image, and cannot be undone.',
  },
  paneel_kon_nie_skrap_nie: {
    af: "Kon nie produk skrap nie — probeer weer.",
    en: "Could not delete product — try again.",
  },
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
  leser_lisensie_nota: {
    af: "Hierdie eksemplaar is aan %epos% gekoppel — nie vir herverspreiding nie.",
    en: "This copy is linked to %epos% — not for redistribution.",
  },
  beskikbaar_vanaf: { af: "Beskikbaar vanaf", en: "Available from" },
  nog_nie_beskikbaar: { af: "Nog nie beskikbaar nie", en: "Not yet available" },
  meld_aan_vir_my_boeke: { af: "Meld eers aan om jou boeke te sien.", en: "Log in to see your books." },
  laai_tans: { af: "Laai …", en: "Loading …" },
  sessie_verval: { af: "Sessie verval — meld weer aan.", en: "Session expired — log in again." },
  geen_boeke_nog: { af: "Nog geen boeke gekoop nie.", en: "No books purchased yet." },
  fout_boeke_laai: { af: "Kon nie boeke laai nie. Probeer weer.", en: "Couldn't load books. Try again." },
  leen_opgradering_knoppie: { af: "Koop nou —", en: "Buy now —" },
  leen_opgradering_afslag_suffix: { af: "afslag", en: "off" },

  // Leser-bladsy
  terug_na_my_boeke: { af: "← My Boeke", en: "← My Books" },
  leser_geen_boek: { af: "Geen boek gespesifiseer nie.", en: "No book specified." },
  leser_laai_tans: { af: "Jou boek word gelaai …", en: "Your book is loading …" },
  leser_nie_gekoop: { af: "Jy het nie hierdie e-boek gekoop nie.", en: "You haven't purchased this e-book." },
  leser_nog_nie_beskikbaar: { af: "Hierdie e-boek is nog nie beskikbaar nie.", en: "This e-book isn't available yet." },
  leser_fout: { af: "Kon nie jou boek laai nie — probeer later weer.", en: "Couldn't load your book — try again later." },
  leser_vanlyn_nie_beskikbaar: {
    af: "Jy is vanlyn, en hierdie boek is nog nie plaaslik gestoor nie — koppel eers een keer aan die internet om dit oop te maak.",
    en: "You're offline, and this book hasn't been stored locally yet — connect to the internet once to open it.",
  },
  leser_van: { af: "van", en: "of" },
  leser_soek_besig: { af: "Soek …", en: "Searching …" },
  leser_soek_gevind: { af: "Gevind op bladsy", en: "Found on page" },
  leser_soek_niks: { af: "Geen resultate gevind nie.", en: "No results found." },

  // Aanmeld / Registreer / Herstel (kopers)
  aanmeld_titel: { af: "Meld aan", en: "Log in" },
  epos_etiket: { af: "E-pos", en: "Email" },
  wagwoord_etiket: { af: "Wagwoord", en: "Password" },
  meld_aan_knoppie: { af: "Meld aan", en: "Log in" },
  bly_aangemeld_etiket: { af: "Bly aangemeld op hierdie toestel", en: "Stay signed in on this device" },
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

  // Bevestig (e-pos-skakel-verwerking)
  bevestig_titel: { af: "Stel jou wagwoord", en: "Set your password" },
  bevestig_hulp: { af: "Stel 'n wagwoord om jou rekening klaar te maak.", en: "Set a password to finish setting up your account." },
  bevestig_knoppie: { af: "Bevestig", en: "Confirm" },
  bevestig_tans: { af: "Bevestig …", en: "Confirming …" },
  bevestig_fout: { af: "Kon nie bevestig nie.", en: "Couldn't confirm." },
  bevestig_fout_titel: { af: "Hierdie skakel werk nie meer nie", en: "This link no longer works" },
  bevestig_fout_hulp: { af: "Die skakel is dalk reeds gebruik, of het verval. Probeer weer registreer of aanmeld.", en: "The link may have already been used, or has expired. Try registering or logging in again." },
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
