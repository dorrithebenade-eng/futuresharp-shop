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
    af: "Jou mandjie bevat 'n harde-kopie-item — verskaf asseblief die ontvanger se naam en afleweradres.",
    en: "Your cart contains a hard-copy item — please provide the recipient's name and delivery address.",
  },
  ontvanger_naam: { af: "Ontvanger se naam en van", en: "Recipient's full name" },
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
  ontvanger_verplig: {
    af: "Die ontvanger se naam is verplig.",
    en: "The recipient's name is required.",
  },
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
  // Eie sleutel vir die betaalbladsy — 'n koper wat staan en betaal, soek
  // nie sy boeke nie, en 'n nuwe koper moet weet dat registrasie hier kan
  // gebeur.
  meld_aan_vir_bestelling: {
    af: "Meld aan om jou bestelling te voltooi — of registreer as jy nog nie 'n rekening het nie.",
    en: "Log in to complete your order — or register if you don't have an account yet.",
  },
  meld_aan_of_registreer: { af: "Meld aan of registreer", en: "Log in or register" },
  laai_tans: { af: "Laai …", en: "Loading …" },
  sessie_verval: { af: "Sessie verval — meld weer aan.", en: "Session expired — log in again." },
  // Korter weergawe, vir waar 'n aanmeldknoppie langsaan staan (sien
  // sessie-verval.js). Die ou sleutel bly vir leser.js, wat nog nie
  // omgeskakel is nie.
  sessie_verval_kort: { af: "Sessie verval.", en: "Session expired." },
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
  // Vir die wys/versteek-ogie op elke wagwoordveld (wagwoord-ogie.js).
  // Word nie op die skerm gewys nie — dit is die aria-label wat 'n
  // skermleser voorlees.
  wagwoord_wys: { af: "Wys wagwoord", en: "Show password" },
  wagwoord_versteek: { af: "Versteek wagwoord", en: "Hide password" },
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
  aanmeld_fout: { af: "Verkeerde e-pos of wagwoord.", en: "Incorrect email or password." },
  registreer_tans: { af: "Skep rekening …", en: "Creating account …" },
  registreer_sukses_bevestig_epos: { af: "Rekening geskep. Bevestig dit via die skakel in jou e-pos.", en: "Account created. Confirm it via the link in your email." },
  registreer_fout: { af: "Kon nie registreer nie. Probeer weer.", en: "Couldn't register. Try again." },
  stuur_tans_herstel: { af: "Stuur …", en: "Sending …" },
  herstel_epos_gestuur: { af: "Herstel-skakel gestuur — kyk jou e-pos.", en: "Reset link sent — check your email." },
  herstel_fout: { af: "Kon nie die e-pos stuur nie. Probeer weer.", en: "Couldn't send the email. Try again." },

  // Bevestig (e-pos-skakel-verwerking)
  bevestig_titel: { af: "Stel jou wagwoord", en: "Set your password" },
  bevestig_hulp: { af: "Stel 'n wagwoord om jou rekening klaar te maak.", en: "Set a password to finish setting up your account." },
  bevestig_knoppie: { af: "Bevestig", en: "Confirm" },
  bevestig_tans: { af: "Bevestig …", en: "Confirming …" },
  bevestig_fout: { af: "Kon nie bevestig nie.", en: "Couldn't confirm." },
  bevestig_fout_titel: { af: "Hierdie skakel werk nie meer nie", en: "This link no longer works" },
  bevestig_fout_hulp: { af: "Die skakel is dalk reeds gebruik, of het verval. Probeer weer registreer of aanmeld.", en: "The link may have already been used, or has expired. Try registering or logging in again." },
  // --- Outeurspaneelbord ---
  meld_aan_vir_paneelbord: { af: "Meld eers aan om jou paneelbord te sien.", en: "Log in to see your dashboard." },
  outeur_groet: { af: "Goeiedag", en: "Hello" },
  outeur_subtitel: { af: "\u2019n Oorsig van jou titels op Future Shop.", en: "An overview of your titles on Future Shop." },
  outeur_uitbetaling_wag_titel: {
    af: "Jou uitbetalingsrekening word opgestel.",
    en: "Your payout account is being set up.",
  },
  outeur_uitbetaling_wag_teks: {
    af: "Jy kan intussen \u2019n boek indien \u2014 dit word te koop aangebied sodra die rekening gereed is.",
    en: "You can submit a book in the meantime \u2014 it will go on sale once the account is ready.",
  },
  outeur_syfer_titels: { af: "Titels te koop", en: "Titles on sale" },
  outeur_syfer_verkope: { af: "Verkope tot op datum", en: "Sales to date" },
  outeur_syfer_deel: { af: "Jou deel tot op datum", en: "Your share to date" },
  outeur_syfer_bestellings: { af: "Om te stuur", en: "To send" },
  outeur_geen_inskrywing: {
    af: "Hierdie rekening is nie as \u2019n outeur geregistreer nie. Skakel Future Sharp indien jy dink dat daar \u2019n fout is by die volgende e-pos: futureshop@futuresharp.co.za",
    en: "This account is not registered as an author. Contact Future Sharp at the following address if you believe there is a mistake: futureshop@futuresharp.co.za",
  },
  outeur_dubbel_inskrywing: {
    af: "Meer as een outeur is by hierdie e-posadres geregistreer. Skakel Future Sharp by die volgende e-pos sodat dit reggestel kan word: futureshop@futuresharp.co.za",
    en: "More than one author is registered under this email address. Contact Future Sharp at the following address so it can be corrected: futureshop@futuresharp.co.za",
  },
  fout_algemeen: { af: "Iets het verkeerd geloop. Probeer asseblief weer.", en: "Something went wrong. Please try again." },
  fout_netwerk: {
    af: "Kon nie verbind nie. Kontroleer jou verbinding en probeer weer.",
    en: "Could not connect. Check your connection and try again.",
  },
  outeur_nav_oorsig: { af: "Oorsig", en: "Overview" },
  outeur_nav_titels: { af: "My titels", en: "My titles" },
  outeur_status_te_koop: { af: "Te koop", en: "On sale" },
  outeur_status_nie_aktief: { af: "Nie te koop nie", en: "Not on sale" },
  outeur_kolom_besigtigings: { af: "Besigtigings", en: "Views" },
  outeur_kolom_verkope: { af: "Verkope", en: "Sales" },
  outeur_kolom_my_deel: { af: "Jou deel", en: "Your share" },
  outeur_geen_titels: {
    af: "Jy het nog geen titels op Future Shop nie.",
    en: "You do not have any titles on Future Shop yet.",
  },
  formaat_eboek: { af: "E-boek", en: "E-book" },
  formaat_harde_kopie: { af: "Harde kopie", en: "Hard copy" },
  formaat_leen: { af: "Leen", en: "Loan" },
  outeur_nav_bestellings: { af: "Bestellings", en: "Orders" },
  outeur_bestellings_nota: {
    af: "Harde kopie\u00eb wat gekoop is en gestuur moet word.",
    en: "Hard copies that have been bought and need to be sent.",
  },
  outeur_om_te_stuur_kop: { af: "Om te stuur", en: "To send" },

  // --- My indienings ---
  // Die groepopskrifte is voller as die merkies op die kaarte: 'n opskrif
  // mag \'n groep beskryf, 'n merkie moet in een oogopslag lees.
  outeur_nav_indienings: { af: "My indienings", en: "My submissions" },
  outeur_indienings_nota: {
    af: "Elke boek se vorm, van konsep tot op die rak.",
    en: "Each book's form, from draft to shelf.",
  },
  oi_nuwe_vorm: { af: "+ Begin 'n nuwe boekvorm", en: "+ Start a new book form" },
  oi_kop_ingedien: { af: "Ingedien vir prosessering", en: "Submitted for processing" },
  oi_kop_rak: { af: "Op die Winkelrak", en: "On the shop shelf" },
  oi_kop_konsep: { af: "In proses v\u00f3\u00f3r indien", en: "In progress before submitting" },
  oi_merk_konsep: { af: "In proses", en: "In progress" },
  oi_merk_ingedien: { af: "Ingedien", en: "Submitted" },
  oi_merk_wysiging: { af: "Wysiging hangend", en: "Change pending" },
  oi_merk_rak: { af: "Op die rak", en: "On the shelf" },
  oi_geen_titel: { af: "Sonder titel", en: "Untitled" },
  oi_gaan_voort: { af: "Gaan voort", en: "Continue" },
  oi_bekyk: { af: "Bekyk", en: "View" },
  oi_onttrek: { af: "Onttrek", en: "Withdraw" },
  // --- Die boekvorm ---
  iv_titel: { af: "Boekvorm", en: "Book form" },
  iv_lei: { af: "Word vir elke titel afsonderlik voltooi. Jy kan enige tyd stoor en later voltooi.", en: "Completed separately for each title. You can save at any time and finish later." },
  iv_nog_nie_gestoor: { af: "Nog nie gestoor nie", en: "Not saved yet" },
  iv_stoor_outomaties: { af: "Word outomaties gestoor terwyl jy tik", en: "Saved automatically as you type" },
  iv_deel1: { af: "Deel 1 · Die titel", en: "Part 1 · The title" },
  iv_titel_veld: { af: "Titel", en: "Title" },
  iv_subtitel: { af: "Subtitel", en: "Subtitle" },
  iv_taal: { af: "Taal", en: "Language" },
  iv_taal_ander: { af: "Ander", en: "Other" },
  iv_bladsye: { af: "Ongeveer hoeveel bladsye", en: "Approximately how many pages" },
  iv_kategorie: { af: "Kategorie", en: "Category" },
  iv_deel2: { af: "Deel 2 · Beskrywings", en: "Part 2 · Descriptions" },
  iv_deel2_nota: { af: "Die kort beskrywing verskyn op die katalogus-kaart, die volledige beskrywing op die boek se eie bladsy. Albei word gepubliseer soos verskaf.", en: "The short description appears on the catalogue card, the full description on the book's own page. Both are published as supplied." },
  iv_kort: { af: "Kort beskrywing", en: "Short description" },
  iv_kort_fyn: { af: "Ongeveer 100 woorde", en: "About 100 words" },
  iv_volledig: { af: "Volledige beskrywing", en: "Full description" },
  iv_deel3: { af: "Deel 3 · ISBN", en: "Part 3 · ISBN" },
  iv_deel3_nota: { af: "Verskaf indien beskikbaar. Future Shop reik nie ISBN's uit nie.", en: "Provide if available. Future Shop does not issue ISBNs." },
  iv_isbn_eboek: { af: "ISBN — e-boek", en: "ISBN — e-book" },
  iv_isbn_hard: { af: "ISBN — harde kopie", en: "ISBN — hard copy" },
  iv_deel4: { af: "Deel 4 · Formate en prys", en: "Part 4 · Formats and price" },
  iv_deel4_nota: { af: "Dui aan watter formate vir hierdie titel aangebied word. Gee 'n prys, of die bedrag wat jy per verkoop wil verdien — dan word die prys daaruit bereken. Die prys word bevestig voordat die titel te koop aangebied word.", en: "Indicate which formats are offered for this title. Give a price, or the amount you want to earn per sale — the price is then calculated from it. The price is confirmed before the title is offered for sale." },
  iv_deel5: { af: "Deel 5 · Gedrukte eksemplare", en: "Part 5 · Printed copies" },
  iv_deel5_nota: { af: "Wat hier aangedui word, verskyn op die boek se bladsy.", en: "What is entered here appears on the book's page." },
  iv_aflewertyd: { af: "Afleweringstyd", en: "Delivery time" },
  iv_aflewertyd_fyn: { af: "Gereken vanaf ontvangs van die bestelling", en: "Counted from receipt of the order" },
  iv_gebiede: { af: "Gebiede waarheen afgelewer word", en: "Areas delivered to" },
  iv_voorraad: { af: "Voorraad", en: "Stock" },
  iv_voorraad_gehou: { af: "Voorraad word gehou", en: "Stock is held" },
  iv_voorraad_per: { af: "Elke bestelling word gedruk", en: "Each order is printed" },
  iv_deel6: { af: "Deel 6 · Mede-outeurs", en: "Part 6 · Co-authors" },
  iv_deel6_nota: { af: "Voltooi slegs waar meer as een outeur aan hierdie titel gewerk het. Elke mede-outeur sluit sy eie ooreenkoms met Future Sharp.", en: "Complete only where more than one author worked on this title. Each co-author enters into their own agreement with Future Sharp." },
  iv_voeg_mede: { af: "+ Voeg mede-outeur by", en: "+ Add co-author" },
  iv_deel7: { af: "Deel 7 · Lêers", en: "Part 7 · Files" },
  iv_deel7_nota: { af: "Die manuskrip en die omslag word saam met die indiening opgelaai. Solank die vorm 'n konsep is, word hulle nog nie gestuur nie.", en: "The manuscript and the cover are uploaded with the submission. While the form is a draft, they are not yet sent." },
  iv_manuskrip: { af: "Die manuskrip", en: "The manuscript" },
  iv_manuskrip_fyn: { af: "PDF — die finale weergawe, met bladsynommers en 'n inhoudsopgawe waar van toepassing", en: "PDF — the final version, with page numbers and a table of contents where applicable" },
  iv_val: { af: "Word by indiening opgelaai", en: "Uploaded on submission" },
  iv_omslag: { af: "Die omslag", en: "The cover" },
  iv_omslag_fyn: { af: "JPEG, PNG, WEBP of GIF · hoogstens 4MB · verhouding 1530 × 2322", en: "JPEG, PNG, WEBP or GIF · 4MB maximum · ratio 1530 × 2322" },
  iv_deel8: { af: "Deel 8 · Bevestiging", en: "Part 8 · Confirmation" },
  iv_bev1: { af: "Ek is die skepper van hierdie werk, of is geregtig om dit te publiseer.", en: "I am the creator of this work, or am entitled to publish it." },
  iv_bev2: { af: "Die werk skend geen ander party se kopiereg nie.", en: "The work infringes no other party's copyright." },
  iv_bev3: { af: "Die besonderhede hierbo is korrek.", en: "The details above are correct." },
  iv_naam_van: { af: "Naam en van", en: "Name and surname" },
  iv_datum: { af: "Datum", en: "Date" },
  iv_stoor: { af: "Stoor as konsep", en: "Save as draft" },
  iv_terug: { af: "Terug na my indienings", en: "Back to my submissions" },
  il_kies_manuskrip: { af: "Kies die manuskrip", en: "Choose the manuscript" },
  il_kies_omslag: { af: "Kies die omslag", en: "Choose the cover" },
  il_sleep: { af: "of sleep hom hierheen", en: "or drag it here" },
  il_kies_weer: { af: "Kies weer", en: "Choose again" },
  il_nie_gestoor: { af: "die lêer self is nie gestoor nie, net sy naam", en: "the file itself was not saved, only its name" },
  il_word_opgelaai: { af: "word opgelaai wanneer jy indien", en: "uploaded when you submit" },
  il_dele: { af: "dele", en: "parts" },
  il_kies_ander: { af: "Kies 'n ander", en: "Choose another" },
  il_laai_op: { af: "Laai op", en: "Uploading" },
  il_deel: { af: "deel", en: "part" },
  il_van: { af: "van", en: "of" },
  il_opgelaai: { af: "Opgelaai", en: "Uploaded" },
  il_nie_pdf: { af: "Dit is nie 'n PDF nie.", en: "This is not a PDF." },
  il_te_groot_60: { af: "Te groot — hoogstens 60 MB.", en: "Too large — 60 MB at most." },
  il_te_groot_4: { af: "Te groot — hoogstens 4 MB.", en: "Too large — 4 MB at most." },
  il_verkeerde_beeld: { af: "Slegs JPEG, PNG, WEBP of GIF.", en: "JPEG, PNG, WEBP or GIF only." },
  il_onderbreek: { af: "Die oplaai het onderbreek — kies Dien in weer.", en: "The upload was interrupted — choose Submit again." },
  il_dien_in: { af: "Dien in", en: "Submit" },
  il_besig: { af: "Besig om in te dien", en: "Submitting" },
  il_ingedien: { af: "Ingedien", en: "Submitted" },
  il_laai_leers: { af: "Laai die lêers op", en: "Uploading the files" },
  il_indien_fout: { af: "Kon nie indien nie — probeer weer.", en: "Could not submit — try again." },
  il_indien_nie_deur: { af: "Die indiening het nie deurgegaan nie.", en: "The submission did not go through." },
  il_geen_nommer: { af: "Die vorm moet eers stoor voordat dit ingedien kan word.", en: "The form must save before it can be submitted." },
  il_kort_kop: { af: "Nog nie gereed om in te dien nie:", en: "Not yet ready to submit:" },
  il_geen_leer: { af: "Geen lêer", en: "No file" },
  il_onttrek: { af: "Onttrek", en: "Withdraw" },
  il_onttrek_besig: { af: "Onttrek …", en: "Withdrawing …" },
  il_onttrek_fout: { af: "Kon nie onttrek nie — probeer weer.", en: "Could not withdraw — try again." },
  pg_titel: { af: "Indienings", en: "Submissions" },
  pg_hulp: { af: "Wat outeurs ingedien het. Maak 'n vorm oop om die besonderhede en die lêers te sien.", en: "What authors have submitted. Open a form to see the details and the files." },
  pg_herlaai: { af: "Herlaai", en: "Reload" },
  pg_laai: { af: "Indienings word gelaai …", en: "Loading submissions …" },
  pg_laai_fout: { af: "Kon nie die indienings laai nie.", en: "Could not load the submissions." },
  pg_laai_een: { af: "Die vorm word gelaai …", en: "Loading the form …" },
  pg_een_fout: { af: "Kon nie die vorm laai nie.", en: "Could not load the form." },
  pg_geen: { af: "Daar is nog geen indienings nie.", en: "There are no submissions yet." },
  pg_geen_titel: { af: "Sonder titel", en: "Untitled" },
  pg_toe: { af: "Maak toe", en: "Close" },
  pg_leser_aflaai: { af: "Laai af", en: "Download" },
  pg_vorige: { af: "Vorige", en: "Previous" },
  pg_volgende: { af: "Volgende", en: "Next" },
  pg_pdf_fout: { af: "Kon nie die PDF-leser laai nie.", en: "Could not load the PDF reader." },
  pg_groep_wag: { af: "Wag vir hantering", en: "Awaiting handling" },
  pg_groep_rak: { af: "Op die winkelrak", en: "On the shop shelf" },
  pg_groep_konsep: { af: "In proses by die outeur", en: "In progress with the author" },
  pg_merk_konsep: { af: "In proses", en: "In progress" },
  pg_merk_ingedien: { af: "Ingedien", en: "Submitted" },
  pg_merk_wysiging: { af: "Wysiging hangend", en: "Change pending" },
  pg_merk_rak: { af: "Op die rak", en: "On the shelf" },
  pg_wysiging_nota: { af: "Dit is 'n hangende wysiging. Die winkel wys steeds die ou waardes.", en: "This is a pending change. The shop still shows the old values." },
  pg_vorige_opmerking: { af: "Vorige opmerking", en: "Previous comment" },
  pg_besonderhede: { af: "Besonderhede", en: "Details" },
  pg_mede: { af: "Mede-outeurs", en: "Co-authors" },
  pg_formate: { af: "Formate en prys", en: "Formats and price" },
  pg_leers: { af: "Lêers", en: "Files" },
  pg_geskiedenis: { af: "Geskiedenis", en: "History" },
  pg_v_titel: { af: "Titel", en: "Title" },
  pg_v_subtitel: { af: "Subtitel", en: "Subtitle" },
  pg_v_taal: { af: "Taal", en: "Language" },
  pg_v_kategorie: { af: "Kategorie", en: "Category" },
  pg_v_bladsye: { af: "Bladsye", en: "Pages" },
  pg_v_kort: { af: "Kort beskrywing", en: "Short description" },
  pg_v_vol: { af: "Volledige beskrywing", en: "Full description" },
  pg_v_isbn_e: { af: "ISBN — e-boek", en: "ISBN — e-book" },
  pg_v_isbn_h: { af: "ISBN — harde kopie", en: "ISBN — hard copy" },
  pg_v_aflewertyd: { af: "Afleweringstyd", en: "Delivery time" },
  pg_v_gebiede: { af: "Gebiede", en: "Areas" },
  pg_v_voorraad: { af: "Voorraad", en: "Stock" },
  pg_v_naam: { af: "Onderteken deur", en: "Signed by" },
  pg_v_datum: { af: "Datum", en: "Date" },
  pg_f_eboek: { af: "E-boek", en: "E-book" },
  pg_f_hardekopie: { af: "Harde kopie", en: "Hard copy" },
  pg_f_leen: { af: "Leen", en: "Loan" },
  pg_prys: { af: "Prys", en: "Price" },
  pg_geen_prys: { af: "Nog nie ingevul nie", en: "Not yet filled in" },
  pg_prys_verander: { af: "Prysverandering", en: "Price change" },
  pg_koste: { af: "Outeur se koste, terug", en: "Author's cost, returned" },
  pg_outeur_wins: { af: "Outeur verdien aan die boek", en: "Author earns on the book" },
  pg_fs: { af: "Future Sharp ontvang", en: "Future Sharp receives" },
  pg_tydperk: { af: "Leentydperk", en: "Loan period" },
  pg_geen_formaat: { af: "Geen formaat is aangedui nie.", en: "No format has been indicated." },
  pg_manuskrip: { af: "Manuskrip", en: "Manuscript" },
  pg_omslag: { af: "Omslag", en: "Cover" },
  pg_geen_leer: { af: "Geen lêer", en: "No file" },
  pg_wys_leer: { af: "Wys", en: "View" },
  pg_haal: { af: "Haal …", en: "Fetching …" },
  pg_leer_fout: { af: "Kon nie die lêer oopmaak nie.", en: "Could not open the file." },
  il_kort_titel: { af: "Die titel in Deel 1 moet ingevul wees.", en: "The title in Part 1 must be filled in." },
  il_kort_formaat: { af: "Ten minste een formaat in Deel 4 moet aangedui wees, met 'n bedrag.", en: "At least one format in Part 4 must be indicated, with an amount." },
  il_kort_manuskrip: { af: "Die manuskrip moet gekies wees.", en: "The manuscript must be chosen." },
  il_kort_omslag: { af: "Die omslag moet gekies wees.", en: "The cover must be chosen." },
  il_kort_bevestigings: { af: "Al drie bevestigings in Deel 8 moet gemerk wees.", en: "All three confirmations in Part 8 must be ticked." },
  iv_wat_gee_jy: { af: "Wat gee jy in?", en: "What are you entering?" },
  iv_modus_prys: { af: "Die prys van die boek", en: "The price of the book" },
  iv_modus_wins: { af: "Wat ek wil verdien", en: "What I want to earn" },
  iv_prys: { af: "Prys (R)", en: "Price (R)" },
  iv_koste: { af: "Jou druk- en afleweringskoste per eksemplaar (R)", en: "Your printing and delivery cost per copy (R)" },
  iv_koste_fyn: { af: "Kom volledig terug — Future Sharp verdien nie daarop nie", en: "Returned in full — Future Sharp does not earn on it" },
  iv_tydperk: { af: "Tydperk (dae)", en: "Period (days)" },
  iv_wins_veld: { af: "Wat ek per eksemplaar wil verdien (R)", en: "What I want to earn per copy (R)" },
  iv_boekprys_veld: { af: "Prys van die boek (R) — versending kom hierby", en: "Price of the book (R) — shipping is added" },
  iv_som_koper: { af: "Die koper betaal", en: "The buyer pays" },
  iv_som_koste: { af: "Jou druk en aflewering, terug", en: "Your printing and delivery, returned" },
  iv_som_wins: { af: "Jou verdienste aan die boek", en: "Your earnings on the book" },
  iv_som_jy: { af: "Jy ontvang", en: "You receive" },
  iv_som_fs: { af: "Future Sharp ontvang", en: "Future Sharp receives" },
  iv_te_laag: { af: "Hierdie prys is te laag om te werk.", en: "This price is too low to work." },
  iv_mede_naam: { af: "Naam en van", en: "Name and surname" },
  iv_mede_epos: { af: "E-posadres", en: "Email address" },
  iv_verwyder: { af: "Verwyder", en: "Remove" },
  iv_nie_gestoor: { af: "Wysigings nog nie gestoor nie", en: "Changes not saved yet" },
  iv_stoor_tans: { af: "Stoor …", en: "Saving …" },
  iv_stoor_fout: { af: "Kon nie stoor nie — probeer weer, of hou die bladsy oop", en: "Could not save — try again, or keep the page open" },
  iv_gestoor: { af: "Gestoor", en: "Saved" },
  iv_outo_gestoor: { af: "Outomaties gestoor", en: "Saved automatically" },
  iv_nie_gevind: { af: "Hierdie vorm kon nie gelaai word nie.", en: "This form could not be loaded." },
  oi_niks: {
    af: "Nog geen boekvorm nie. Begin een sodra jy gereed is.",
    en: "No book form yet. Start one when you are ready.",
  },
  outeur_reeds_gestuur_kop: { af: "Reeds gestuur", en: "Already sent" },
  outeur_om_te_stuur: { af: "Om te stuur", en: "To send" },
  outeur_gestuur: { af: "Gestuur", en: "Sent" },
  outeur_merk_gestuur: { af: "Merk as gestuur", en: "Mark as sent" },
  outeur_wysig_versending: { af: "Wysig", en: "Edit" },
  outeur_terugtrek: { af: "Trek terug", en: "Undo" },
  outeur_versend_datum: { af: "Datum van versending", en: "Date sent" },
  outeur_spoornommer: { af: "Spoornommer \u2014 opsioneel", en: "Tracking number \u2014 optional" },
  outeur_spoornommer_kort: { af: "Spoornommer", en: "Tracking number" },
  outeur_spoornommer_hulp: {
    af: "Die spoornommer help wanneer die koper later navraag doen.",
    en: "The tracking number helps when the buyer follows up later.",
  },
  outeur_gestuur_op: { af: "Gestuur op", en: "Sent on" },
  outeur_niks_om_te_stuur: { af: "Niks om te stuur nie.", en: "Nothing to send." },
  outeur_niks_gestuur: { af: "Nog niks gestuur nie.", en: "Nothing sent yet." },
  outeur_geen_ontvanger: {
    af: "Geen ontvangernaam is by hierdie bestelling gestoor nie. Kontak Future Sharp voordat jy dit stuur.",
    en: "No recipient name was stored with this order. Contact Future Sharp before sending it.",
  },
  bevestig: { af: "Bevestig", en: "Confirm" },
  kanselleer: { af: "Kanselleer", en: "Cancel" },
  outeur_wyse: { af: "Wie het dit gestuur?", en: "Who sent it?" },
  outeur_wyse_self: { af: "Ek het dit self gepos", en: "I posted it myself" },
  outeur_wyse_verskaffer: {
    af: "\u2019n Drukker of verspreider het dit gestuur",
    en: "A printer or distributor sent it",
  },
  outeur_verskaffer: { af: "Drukker of verspreider", en: "Printer or distributor" },
  outeur_verskaffer_verwysing: { af: "Sy bestelnommer", en: "Their order number" },
  outeur_deur: { af: "Deur", en: "By" },
  outeur_oog: { af: "Outeurspaneel", en: "Author panel" },
  outeur_lei: {
    af: "Jou boeke, jou syfers en die bestellings wat wag om gestuur te word.",
    en: "Your books, your figures, and the orders waiting to be sent.",
  },
  nav_outeurspaneel: { af: "Outeurspaneel", en: "Author panel" },
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
