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
  paneel_nav_waarskuwings: { af: "Waarskuwings ⚠️", en: "Warnings ⚠️" },
  paneel_kieslys_groep_admin: { af: "Admin", en: "Admin" },
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
  uitnodiging_status_verstreke: { af: "Verstreke", en: "Expired" },
  uitnodiging_verval_vandag: { af: "Verval vandag", en: "Expires today" },
  uitnodiging_verval_more: { af: "Verval môre", en: "Expires tomorrow" },
  uitnodiging_verval_oor: { af: "Verval oor", en: "Expires in" },
  uitnodiging_dae: { af: "dae", en: "days" },
  uitnodiging_skrap: { af: "Skrap", en: "Delete" },
  uitnodiging_skrap_bevestig: { af: "Skrap hierdie uitnodiging? Die skakel werk dan nie meer nie.", en: "Delete this invitation? The link will stop working." },
  uitnodiging_skrap_fout: { af: "Kon nie die uitnodiging skrap nie", en: "Could not delete the invitation" },

  // --- Die deel-skakel op My titels (outeur-deel-skakel.js) ---
  ods_kopieer: { af: "Kopieer skakel", en: "Copy link" },
  ods_gekopieer: { af: "Gekopieer", en: "Copied" },
  ods_kon_nie: { af: "Kon nie kopieer nie", en: "Could not copy" },

  // --- Die ooreenkoms-blok in die outeursvorm (paneel-ooreenkoms.js) ---
  po_kop: { af: "Ooreenkoms en dokumente", en: "Agreement and documents" },
  po_merk_wag: { af: "Wag vir bevestiging", en: "Awaiting confirmation" },
  po_merk_klaar: { af: "Bevestig", en: "Confirmed" },
  po_onderteken_deur: { af: "Onderteken deur", en: "Signed by" },
  po_op: { af: "Op", en: "On" },
  po_weergawe: { af: "Weergawe", en: "Version" },
  po_bevestig_deur: { af: "Bevestig deur", en: "Confirmed by" },
  po_bankbrief: { af: "Bankbrief", en: "Bank letter" },
  po_idafskrif: { af: "ID-afskrif", en: "ID copy" },
  po_bevestig_lei: { af: "Bevestig die registrasie sodra die uitbetalingsrekening opgestel is. Dit is Future Sharp se ondertekening ingevolge klousule 14, en dit kan nie ongedaan gemaak word nie.", en: "Confirm the registration once the payout account has been set up. This is Future Sharp's signature in terms of clause 14, and it cannot be undone." },
  po_bevestig_knoppie: { af: "Bevestig registrasie", en: "Confirm registration" },
  po_bevestig_vra: { af: "Bevestig hierdie registrasie? Dit teken Future Sharp se aanvaarding van die ooreenkoms aan en kan nie ongedaan gemaak word nie.", en: "Confirm this registration? This records Future Sharp's acceptance of the agreement and cannot be undone." },
  po_besig: { af: "Besig …", en: "Working …" },
  po_geen: { af: "Hierdie outeur is met die hand bygevoeg en het nie deur die aansluitvorm geregistreer nie. Daar is geen ondertekende ooreenkoms of dokumente op die rekord nie.", en: "This author was added by hand and did not register through the joining form. There is no signed agreement or documents on the record." },
  po_dok_fout: { af: "Kon nie die dokument oopmaak nie", en: "Could not open the document" },
  po_bevestig_fout: { af: "Kon nie bevestig nie", en: "Could not confirm" },

  // --- Die outeur se aansluitvorm (uitnodiging-outeur.js) ---
  uo_kop_sub: { af: "Sluit aan as outeur", en: "Join as an author" },
  uo_stap1: { af: "Naam en e-pos", en: "Name and email" },
  uo_stap2: { af: "Die ooreenkoms", en: "The agreement" },
  uo_stap3: { af: "Jou besonderhede", en: "Your details" },
  uo_stap4: { af: "Jou rekening", en: "Your account" },
  uo_s1_titel: { af: "Jou naam en e-pos", en: "Your name and email" },
  uo_s1_lei: { af: "Ons het net jou naam en e-posadres nodig om te begin.", en: "We only need your name and email address to begin." },
  uo_f_naam: { af: "Volle naam", en: "Full name" },
  uo_f_naam_hulp: { af: "Soos dit op die ooreenkoms moet verskyn.", en: "As it should appear on the agreement." },
  uo_f_epos: { af: "E-pos", en: "Email" },
  uo_s2_titel: { af: "Die outeursooreenkoms", en: "The author agreement" },
  uo_s2_lei: { af: "Lees dit deur. Jy onderteken dit onderaan hierdie bladsy.", en: "Read it through. You sign it at the bottom of this page." },
  uo_s2_engels: { af: "Die ooreenkoms en die ondertekening is in Engels.", en: "" },
  uo_rol_nota: { af: "Rol af tot die einde van die ooreenkoms.", en: "Scroll to the end of the agreement." },
  uo_s3_titel: { af: "Jou besonderhede", en: "Your details" },
  uo_s3_lei: { af: "Hierdie gaan na jou uitbetalings. Jy kan jou selfoon en adres later self in jou paneelbord verander.", en: "These are used for your payouts. You can change your mobile number and address yourself later in your panel." },
  uo_g_kontak: { af: "Kontak", en: "Contact" },
  uo_g_identiteit: { af: "Identiteit", en: "Identity" },
  uo_g_bank: { af: "Bankbesonderhede", en: "Banking details" },
  uo_g_dokumente: { af: "Dokumente", en: "Documents" },
  uo_f_selfoon: { af: "Selfoonnommer", en: "Mobile number" },
  uo_f_adres: { af: "Adres", en: "Address" },
  uo_f_id: { af: "ID-/Paspoortnommer", en: "ID / passport number" },
  uo_f_houer: { af: "Rekeninghouer", en: "Account holder" },
  uo_f_houer_hulp: { af: "Presies soos dit by die bank geregistreer is. Dit hoef nie jou eie naam te wees nie.", en: "Exactly as registered at the bank. It need not be your own name." },
  uo_f_bank: { af: "Bank", en: "Bank" },
  uo_f_rekening: { af: "Rekeningnommer", en: "Account number" },
  uo_f_takkode: { af: "Taknommer", en: "Branch code" },
  uo_f_tipe: { af: "Rekeningtipe", en: "Account type" },
  uo_f_tipe_kies: { af: "Kies …", en: "Choose …" },
  uo_f_tipe_tjek: { af: "Tjekrekening", en: "Cheque account" },
  uo_f_tipe_spaar: { af: "Spaarrekening", en: "Savings account" },
  uo_f_tipe_trans: { af: "Transmissierekening", en: "Transmission account" },
  uo_f_bankbrief: { af: "Bankbrief", en: "Bank letter" },
  uo_f_bb_hulp: { af: "Deur die bank uitgereik, nie ouer as drie maande nie. Die naam daarop moet met die rekeninghouer ooreenstem. PDF of foto, hoogstens 5MB.", en: "Issued by the bank, not older than three months. The name on it must match the account holder. PDF or photo, 5MB maximum." },
  uo_f_idafskrif: { af: "Afskrif van ID of paspoort", en: "Copy of ID or passport" },
  uo_f_id_hulp: { af: "PDF of foto, hoogstens 5MB.", en: "PDF or photo, 5MB maximum." },
  uo_kies_leer: { af: "Kies lêer", en: "Choose file" },
  uo_geen_leer: { af: "Geen lêer gekies nie", en: "No file chosen" },
  uo_s4_titel: { af: "Jou rekening", en: "Your account" },
  uo_s4_lei: { af: "Kies 'n wagwoord waarmee jy by die winkel, die leser en jou outeurspaneel aanmeld.", en: "Choose a password to sign in to the shop, the reader and your author panel." },
  uo_s4_nota_a: { af: "🔑 Jy meld voortaan aan met ", en: "🔑 From now on you sign in with " },
  uo_s4_nota_b: { af: " en hierdie wagwoord.", en: " and this password." },
  uo_f_wagwoord: { af: "Kies 'n wagwoord", en: "Choose a password" },
  uo_f_wagwoord2: { af: "Bevestig wagwoord", en: "Confirm password" },
  uo_verplig: { af: "(verplig)", en: "(required)" },
  uo_opsioneel: { af: "(opsioneel)", en: "(optional)" },
  uo_volgende: { af: "Gaan voort →", en: "Continue →" },
  uo_teken_gaan: { af: "Onderteken en gaan voort →", en: "Sign and continue →" },
  uo_terug: { af: "← Terug", en: "← Back" },
  uo_dien_in: { af: "Sluit aan →", en: "Join →" },
  uo_klaar_kop: { af: "Welkom, ", en: "Welcome, " },
  uo_klaar_1: { af: "Jou ooreenkoms is onderteken en jou rekening is geskep. Jy kan nou by Future Shop aanmeld.", en: "Your agreement is signed and your account has been created. You can now sign in to Future Shop." },
  uo_klaar_2: { af: "Future Sharp stel jou uitbetalingsrekening op en bevestig jou registrasie. Jy ontvang dan 'n afskrif van die ooreenkoms met albei ondertekeninge.", en: "Future Sharp will set up your payout account and confirm your registration. You will then receive a copy of the agreement bearing both signatures." },
  uo_op_kop: { af: "Wat aangeteken is", en: "What has been recorded" },
  uo_op_deur: { af: "Onderteken deur ", en: "Signed by " },
  uo_op_op: { af: "Op ", en: "On " },
  uo_op_weergawe: { af: "Outeursooreenkoms weergawe 1.0 (Engels)", en: "Author agreement version 1.0 (English)" },
  uo_op_data: { af: "Bank- en kontakbesonderhede, bankbrief en ID-afskrif gestoor", en: "Banking and contact details, bank letter and ID copy stored" },
  uo_e_naam: { af: "Vul asseblief jou volle naam in.", en: "Please enter your full name." },
  uo_e_epos: { af: "Vul asseblief 'n geldige e-posadres in.", en: "Please enter a valid email address." },
  uo_e_teken: { af: "Die naam wat jy getik het, stem nie ooreen met jou volle naam nie.", en: "The name you typed does not match your full name." },
  uo_e_merk: { af: "Merk asseblief die blokkie om die ooreenkoms te onderteken.", en: "Please tick the box to sign the agreement." },
  uo_e_veld: { af: "Vul asseblief die volgende in: ", en: "Please complete the following: " },
  uo_e_bankbrief: { af: "Heg asseblief die bankbrief aan.", en: "Please attach the bank letter." },
  uo_e_idafskrif: { af: "Heg asseblief 'n afskrif van jou ID of paspoort aan.", en: "Please attach a copy of your ID or passport." },
  uo_e_ww_kort: { af: "Die wagwoord moet ten minste 6 karakters wees.", en: "The password must be at least 6 characters." },
  uo_e_ww_verskil: { af: "Die twee wagwoorde stem nie ooreen nie.", en: "The two passwords do not match." },
  uo_besig_laai: { af: "Lêers word gestuur …", en: "Sending files …" },
  uo_besig_stuur: { af: "Registrasie word voltooi …", en: "Completing registration …" },
  uo_e_stuur: { af: "Kon nie voltooi nie:", en: "Could not complete:" },
  uo_e_ooreenkoms: { af: "Die ooreenkoms kon nie laai nie. Probeer weer, of kontak Future Sharp.", en: "The agreement could not be loaded. Please try again, or contact Future Sharp." },
  uo_e_leer_kort: { af: "Kies asseblief eers 'n lêer.", en: "Please choose a file first." },
  uo_e_leer_groot: { af: "Die lêer is te groot — hoogstens 5MB.", en: "The file is too large — 5MB maximum." },
  uo_klaar_bestaan: { af: "Jou ooreenkoms is onderteken. Jy het reeds 'n Future Shop-rekening met hierdie e-posadres — meld daarmee aan, met jou bestaande wagwoord.", en: "Your agreement is signed. You already have a Future Shop account with this email address — sign in with it, using your existing password." },

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
  bly_aan_koop: { af: "← Terug na katalogus", en: "← Back to catalogue" },

  // 403, NIE 401 NIE. Die rekening is aangemeld en die token is geldig -- dit
  // het net nie die "koper"-rol nie. Aanmeld gaan niks verander nie, dus mag
  // hierdie boodskap nie na aanmelding wys nie. Die e-posadres staan hier en
  // nie as 'n skakel nie: die persoon sit reeds vas en 'n verdere klik help
  // hom nie.
  geen_koperprofiel: {
    af: "Hierdie rekening kan nie aankope doen nie. Meld af en meld weer aan met die rekening waarmee jy koop, of skryf aan admin@futuresharp.co.za.",
    en: "This account cannot make purchases. Sign out and sign in again with the account you buy with, or write to admin@futuresharp.co.za.",
  },
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

  // -- 'n Harde kopie in "My Boeke" ---------------------------------------
  // 'n Gedrukte boek het nog altyd deur die drukker- en afleweringsvloei
  // geloop en NERENS vir die koper gewys nie. Hy het betaal en toe niks meer
  // gehoor nie, terwyl merk-bestelling-gestuur.js die datum, die verskaffer
  // en die spoornommer al die tyd in die rekord gestoor het.
  //
  // Die merkie op die omslag, want dit is die eerste ding wat 'n oog vang op
  // 'n rak vol kaarte.
  // Die formaat onder die outeursnaam. EEN TITEL KAN MEER AS EEN KEER OP DIE
  // RAK STAAN: koop 'n mens dieselfde boek as e-boek en as harde kopie, staan
  // twee kaarte met dieselfde omslag, titel en outeur langs mekaar.
  //
  // E-BOEK EN HARDE KOPIE GEBRUIK eboek_etiket EN hardekopie_etiket -- die
  // sleutels wat die mandjie en die uitteken reeds gebruik. Die koper het
  // "Harde kopie" gekies en betaal; hy moet nie hier 'n ander woord lees nie.
  //
  // LEEN KRY 'N EIE SLEUTEL. leen_etiket se Engels is "Borrow", 'n werkwoord
  // wat op 'n knoppie reg lees maar as etiket onder 'n boektitel soos 'n
  // opdrag klink. "Loan" is die selfstandige naamwoord.
  mb_formaat_leen: { af: "Leen", en: "Loan" },

  hk_merk_bestel: { af: "Bestel", en: "Ordered" },
  hk_merk_gestuur: { af: "Gestuur", en: "Shipped" },

  // GEEN DATUM BELOOF NIE. Ons weet nie wanneer die outeur gaan pos nie, en
  // 'n geraamde aankomsdatum wat mis, is erger as geen datum.
  hk_wag_teks: {
    af: "Jou bestelling is geplaas. Ons laat weet sodra dit gestuur is.",
    en: "Your order has been placed. We'll let you know once it ships.",
  },
  hk_gestuur_op: { af: "Gestuur op", en: "Shipped on" },
  hk_spoornommer: { af: "Spoornommer", en: "Tracking number" },
  terug_winkel: { af: "Terug na die winkel", en: "Back to the shop" },
  terug_mandjie: { af: "Terug na die mandjie", en: "Back to the cart" },

  // -- Die dankie-bladsy se VIER UITKOMSTE --------------------------------
  // 'n Kansellasie op Paystack se betaalbladsy kom by DIESELFDE callback-URL
  // uit as 'n geslaagde betaling. Die bladsy kan niks uit die URL aflei nie
  // en moet vra -- sien kry-bestelstand.js. Sonder hierdie sleutels het elke
  // uitkoms "Dankie vir jou bestelling" gelees, ook 'n kansellasie.
  //
  // Die woorde is DIESELFDE as die faktuurmodule se bk_-sleutels waar die
  // feit dieselfde is. Twee module wat dieselfde ding anders stel, laat 'n
  // mens wonder of hulle dieselfde ding bedoel.
  ds_merk_betaal: { af: "Betaal", en: "Paid" },
  ds_merk_loop: { af: "In verwerking", en: "Processing" },
  ds_merk_oop: { af: "Onbetaal", en: "Outstanding" },
  ds_merk_onbekend: { af: "Onbevestig", en: "Unconfirmed" },

  ds_kop_loop: { af: "Betaling in verwerking", en: "Payment processing" },
  // Die waarskuwing teen 'n tweede betaling is nie oorversigtig nie: 'n
  // Instant EFT wat nog nie deur is nie, lyk soos 'n mislukte een, en 'n
  // dubbele betaling verg 'n terugbetaling wat die winkel nie het nie.
  ds_teks_loop: {
    af: 'Die transaksie is geïnisieer, maar die bank het dit nog nie bevestig nie. Moenie weer bestel nie — jou boeke verskyn in "My Boeke" sodra dit deurgaan.',
    en: 'The transaction has been initiated, but the bank has not confirmed it yet. Do not order again — your books will appear in "My Books" once it clears.',
  },

  ds_kop_oop: { af: "Betaling nie voltooi nie", en: "Payment not completed" },
  ds_teks_oop: {
    af: "Geen debiet is teen jou rekening verwerk nie. Jou mandjie is nog presies soos jy hom gelos het.",
    en: "No debit has been processed against your account. Your cart is exactly as you left it.",
  },

  ds_kop_onbekend: { af: "Betalingstatus onbevestig", en: "Payment status unconfirmed" },
  ds_teks_onbekend: {
    af: 'Ons kon die transaksie se status nie nou bevestig nie. Het die betaling deurgegaan, verskyn jou boeke in "My Boeke". Kontak ons gerus met die bestelnommer hierbo.',
    en: 'We could not confirm the status of the transaction right now. If the payment cleared, your books will appear in "My Books". Please contact us with the order number above.',
  },

  // Die mandjiereël onder die knoppies. Sy staan NET by die onbetaalde
  // uitkomste, waar die koper self wonder of sy keuses weg is. Ná 'n
  // geslaagde aankoop dink niemand aan sy mandjie nie -- "Mandjie leeggemaak"
  // is dan huishouding wat ons oor onsself vertel, en dit laat hom boonop
  // wonder of hy bekommerd moes gewees het.
  //
  // {n} is die aantal items. Die syfer staan hier en nie in die kode nie,
  // want die woordorde verskil tussen tale.
  ds_mandjie_behou_een: { af: "Mandjie behou — 1 item", en: "Cart kept — 1 item" },
  ds_mandjie_behou: { af: "Mandjie behou — {n} items", en: "Cart kept — {n} items" },

  // Personeel-paneelbord
  paneel_titel: { af: "Admin-paneelbord", en: "Admin dashboard" },
  // ---------- Boekhouding: die klienteregister ----------
  fk_skakel_titel: { af: "Klientvorm-skakel", en: "Client form link" },
  fk_kopieer: { af: "Kopieer", en: "Copy" },
  fk_titel: { af: "Kliente", en: "Clients" },
  fk_gekopieer: { af: "Gekopieer", en: "Copied" },
  fk_soek_plek: {
    af: "Soek op nommer, naam, kontakpersoon, e-pos of selfoon",
    en: "Search by number, name, contact, email or mobile",
  },
  fk_nuwe_klient_knop: { af: "+ Nuwe klient", en: "+ New client" },
  fk_kliente: { af: "kliente", en: "clients" },
  fk_pas_een: { af: "klient pas", en: "client matches" },
  fk_pas_meer: { af: "kliente pas", en: "clients match" },
  fk_geen_kliente: { af: "Daar is nog geen kliente nie.", en: "There are no clients yet." },
  fk_geen_pas: { af: "Geen klient pas nie.", en: "No client matches." },
  fk_laai_fout: { af: "Kon nie die kliente laai nie.", en: "Could not load the clients." },

  fk_instansie: { af: "Instansie", en: "Institution" },
  fk_instansie_hulp: { af: "bv. skool, departement, maatskappy", en: "e.g. school, department, company" },
  fk_privaat: { af: "Privaat", en: "Private" },
  fk_privaat_klient: { af: "Privaat klient", en: "Private client" },
  fk_privaat_hulp: { af: "bv. ’n outeur of individu", en: "e.g. an author or individual" },

  fk_nuwe_klient: { af: "Nuwe klient", en: "New client" },
  fk_wysig_klient: { af: "Wysig klient", en: "Edit client" },
  fk_vorm_lei: {
    af: "Naam, e-pos en selfoon is nodig. ’n Rekord sonder hulle word as onvolledig gemerk en kan later voltooi word.",
    en: "Name, email and mobile are needed. A record without them is marked incomplete and can be completed later.",
  },
  fk_naam_instansie: { af: "Naam van die instansie", en: "Name of the institution" },
  fk_naam_privaat: { af: "Naam en van", en: "Full name" },
  fk_veld_naam: { af: "Naam", en: "Name" },
  fk_veld_kontak: { af: "Kontakpersoon", en: "Contact person" },
  fk_veld_epos: { af: "E-pos", en: "Email" },
  fk_veld_selfoon: { af: "Selfoon", en: "Mobile" },
  fk_veld_adres: { af: "Adres", en: "Address" },
  fk_adres_hulp: {
    af: "Word gedruk soos dit hier staan.",
    en: "Printed exactly as entered here.",
  },
  fk_naam_verplig: { af: "Die naam is verplig.", en: "The name is required." },
  fk_stoor: { af: "Stoor", en: "Save" },
  fk_stoor_fout: { af: "Kon nie stoor nie. Probeer weer.", en: "Could not save. Please try again." },
  fk_kanselleer: { af: "Kanselleer", en: "Cancel" },

  fk_onvolledig: { af: "Onvolledig", en: "Incomplete" },
  fk_nuut: { af: "Nuut", en: "New" },
  fk_moontlike_dup: { af: "Moontlike duplikaat", en: "Possible duplicate" },

  fk_dup_een: { af: "Twee inskrywings deel ’n e-posadres", en: "Two entries share an email address" },
  fk_dup_meer: { af: "pare deel ’n e-posadres", en: "pairs share an email address" },
  fk_en: { af: "en", en: "and" },
  fk_kontroleer: { af: "Kontroleer", en: "Check" },
  fk_dup_titel: { af: "Kontroleer hierdie twee", en: "Check these two" },
  fk_veld_verskil: { af: "veld verskil.", en: "field differs." },
  fk_velde_verskil: { af: "velde verskil.", en: "fields differ." },
  fk_kies_waarde: { af: "Kies watter waarde moet bly.", en: "Choose which value should stay." },
  fk_niks_nuuts: {
    af: "Elke veld is dieselfde — die nuwe indiening dra niks nuuts nie.",
    en: "Every field is the same — the new submission brings nothing new.",
  },
  fk_bestaande: { af: "Bestaande", en: "Existing" },
  fk_nuwe_indiening: { af: "Nuwe indiening", en: "New submission" },
  fk_los: { af: "Los vir eers", en: "Leave for now" },
  fk_hou_albei: { af: "Hou albei", en: "Keep both" },
  fk_vee_nuwe: { af: "Vee die nuwe weg", en: "Delete the new one" },
  fk_werk_by: { af: "Werk by en vee weg", en: "Update and delete" },
  fk_dup_fout: { af: "Kon nie dit doen nie. Probeer weer.", en: "Could not do that. Please try again." },

  // ---------- Begunstigderegister (faktuurpaneel.html) ----------
  bg_titel: { af: "Begunstigdes", en: "Beneficiaries" },
  bg_soek_plek: {
    af: "Soek op naam, e-pos, selfoon of kode",
    en: "Search by name, email, mobile or code",
  },
  bg_nuwe_knop: { af: "+ Nuwe begunstigde", en: "+ New beneficiary" },
  bg_een: { af: "begunstigde", en: "beneficiary" },
  bg_meer: { af: "begunstigdes", en: "beneficiaries" },
  bg_pas_een: { af: "begunstigde pas", en: "beneficiary matches" },
  bg_pas_meer: { af: "begunstigdes pas", en: "beneficiaries match" },
  bg_geen: { af: "Daar is nog geen begunstigdes nie.", en: "There are no beneficiaries yet." },
  bg_geen_pas: { af: "Geen begunstigde pas nie.", en: "No beneficiary matches." },
  bg_laai_fout: { af: "Kon nie die begunstigdes laai nie.", en: "Could not load the beneficiaries." },

  bg_nuwe: { af: "Nuwe begunstigde", en: "New beneficiary" },
  bg_wysig: { af: "Wysig begunstigde", en: "Edit beneficiary" },
  bg_vorm_lei: {
    af: "Wie ’n deel van ’n betaling ontvang — ’n aanbieder, iemand wat koste terugkry, of albei.",
    en: "Whoever receives part of a payment — a presenter, someone recovering costs, or both.",
  },
  bg_veld_naam: { af: "Naam", en: "Name" },
  bg_veld_epos: { af: "E-pos", en: "Email" },
  bg_veld_selfoon: { af: "Selfoon", en: "Mobile" },
  bg_veld_adres: { af: "Adres", en: "Address" },
  // Die bankbesonderhede op die begunstigde-vorm, 19 Augustus 2026. Die
  // subrekening word STEEDS met die hand by Paystack opgestel; hierdie
  // velde is die bron waaruit dit gedoen word.
  bg_bank_kop: { af: "Bankbesonderhede", en: "Bank details" },
  bg_bank_hulp: {
    af: "Hieruit word die Paystack-subrekening met die hand opgestel. Niks hier skep self iets by Paystack nie.",
    en: "The Paystack subaccount is set up by hand from these. Nothing here creates anything at Paystack.",
  },
  bg_veld_rekeninghouer: { af: "Rekeninghouer", en: "Account holder" },
  bg_rekeninghouer_hulp: {
    af: "Soos dit op die bankrekening staan \u2014 nie noodwendig dieselfde as die naam hierbo nie.",
    en: "As it appears on the bank account \u2014 not necessarily the same as the name above.",
  },
  bg_veld_bank: { af: "Bank", en: "Bank" },
  bg_veld_rekeningnommer: { af: "Rekeningnommer", en: "Account number" },
  bg_veld_takkode: { af: "Takkode", en: "Branch code" },
  bg_veld_tipe: { af: "Rekeningtipe", en: "Account type" },
  bg_tipe_tjek: { af: "Tjekrekening", en: "Cheque account" },
  bg_tipe_spaar: { af: "Spaarrekening", en: "Savings account" },
  bg_veld_kode: { af: "Paystack-subrekening", en: "Paystack subaccount" },
  bg_opsioneel: { af: "opsioneel", en: "optional" },
  bg_kode_hulp: {
    af: "Uit Paystack se paneel. Sonder ’n kode kan hierdie persoon nie in ’n verdeling gebruik word nie.",
    en: "From the Paystack dashboard. Without a code this person cannot be used in a split.",
  },
  bg_oorplak: {
    af: "Hierdie persoon is reeds ’n outeur. Gebruik sy bestaande kode:",
    en: "This person is already an author. Use their existing code:",
  },
  bg_wag: { af: "Wag vir subrekening", en: "Awaiting subaccount" },
  bg_ook_outeur: { af: "Ook outeur", en: "Also an author" },
  bg_geen_kode: { af: "Geen subrekening", en: "No subaccount" },

  bg_naam_verplig: { af: "Die naam is verplig.", en: "The name is required." },
  bg_kode_fout: {
    af: "Die subrekening-kode moet met ACCT_ begin.",
    en: "The subaccount code must start with ACCT_.",
  },
  bg_bestaan: {
    af: "Daar is reeds ’n begunstigde met daardie naam.",
    en: "A beneficiary with that name already exists.",
  },
  bg_stoor_fout: { af: "Kon nie stoor nie. Probeer weer.", en: "Could not save. Please try again." },
  // ---------- Boekhouding (faktuurpaneel.html) ----------
  // -- Wie is nou ook hier ------------------------------------------------
  // Een reel tussen die titel en die pille, of niks. Sien
  // faktuurpaneel-teenwoordigheid.js: een oproep elke twee minute, slegs
  // terwyl die oortjie sigbaar is.
  //
  // "is aanlyn", nie "is nou aan die werk" nie -- die stelsel weet die een
  // en nie die ander nie.
  tw_een: { af: "{naam} is aanlyn", en: "{naam} is online" },
  tw_twee: { af: "{a} en {b} is aanlyn", en: "{a} and {b} are online" },
  // Kom in die praktyk nooit voor nie -- daar is twee direkteure. Die reel
  // bestaan sodat sy nie breek as daar ooit 'n derde is nie.
  tw_baie: { af: "{n} ander is aanlyn", en: "{n} others are online" },

  fp_titel: { af: "Boekhouding", en: "Accounts" },
  fp_nav_paneelbord: { af: "Paneelbord", en: "Dashboard" },
  fp_terug: { af: "\u2190 Paneelbord", en: "\u2190 Dashboard" },

  /* -- die joernaal --
     Inkomste en uitgawes wat NIE deur die faktuurmodule loop nie.
     Kontantbasis, per finansiele jaar (1 Maart tot 28 Februarie). */
  fp_nav_joernaal: { af: "Joernaal", en: "Journal" },
  jn_lei_1: {
    af: "Inkomste en Uitgawes vir \u2019n finansi\u00eble jaar.",
    en: "Income and expenses for a financial year.",
  },
  jn_lei_2: {
    af: "Betalings deur Paystack word outomaties versprei as inkomste en geallokeer waar uitgawes van belang is.",
    en: "Payments through Paystack are distributed automatically as income and allocated where expenses matter.",
  },
  jn_lei_3: {
    af: "Betalings wat nie deur Paystack vloei nie moet steeds handmatig ingevoer word.",
    en: "Payments that do not flow through Paystack must still be entered by hand.",
  },
  jn_inkomste: { af: "Inkomste", en: "Income" },
  jn_uitgawes: { af: "Uitgawes", en: "Expenses" },
  jn_verskil: { af: "Verskil", en: "Difference" },

  /* Debiteure en krediteure TEL NIE in die drie syfers hierbo nie. Op
     kontantbasis het die geld nie beweeg nie; hulle staan hier omdat 'n mens
     hulle by jaareinde wil sien. */
  jn_debiteure: { af: "Debiteure", en: "Debtors" },
  jn_debiteure_lei: { af: "Uitgereik, nog onbetaal", en: "Issued, not yet paid" },
  jn_krediteure: { af: "Krediteure", en: "Creditors" },
  jn_krediteure_lei: {
    af: "Ontvang, nog nie uitbetaal nie",
    en: "Received, not yet paid out",
  },
  jn_wag_nota: {
    af: "Tel nie in die syfers hierbo nie.",
    en: "Not included in the figures above.",
  },
  jn_wag_leeg: { af: "Niks staan uit nie.", en: "Nothing outstanding." },
  jn_deb_kred_kop: { af: "Debiteure en krediteure", en: "Debtors and creditors" },
  jn_laaste: { af: "Laaste inskrywings", en: "Latest entries" },
  jn_wys_al: { af: "Wys al", en: "Show all" },
  jn_wys_minder: { af: "Wys minder", en: "Show fewer" },
  jn_teken_inskrywing: {
    af: "Teken \u2019n inskrywing aan",
    en: "Record an entry",
  },
  jn_datum: { af: "Datum", en: "Date" },
  jn_beskrywing: { af: "Beskrywing", en: "Description" },
  jn_kategorie: { af: "Kategorie", en: "Category" },
  jn_kat_geen: { af: "\u2014 geen kategorie \u2014", en: "\u2014 no category \u2014" },
  jn_bedrag: { af: "Bedrag", en: "Amount" },
  jn_wie: { af: "Betaal deur", en: "Paid by" },
  jn_rigting: { af: "Soort", en: "Type" },
  jn_in: { af: "Inkomste", en: "Income" },
  jn_uit: { af: "Uitgawe", en: "Expense" },
  jn_teken_aan: { af: "Teken aan", en: "Record" },
  jn_besig: { af: "Besig \u2026", en: "Working \u2026" },
  jn_herhaal: { af: "herhaal", en: "repeat" },
  jn_verwyder: { af: "Verwyder", en: "Remove" },
  jn_uitvoer: { af: "Voer uit", en: "Export" },
  jn_van: { af: "Van", en: "From" },
  jn_tot: { af: "Tot", en: "To" },
  jn_soek: { af: "Beskrywing", en: "Description" },
  jn_herstel: { af: "Herstel", en: "Reset" },
  jn_tydperk_fout: {
    af: "Die \u2018van\u2019-datum moet voor die \u2018tot\u2019-datum wees.",
    en: "The \u2018from\u2019 date must come before the \u2018to\u2019 date.",
  },
  jn_leeg: {
    af: "Geen inskrywings vir hierdie jaar nie.",
    en: "No entries for this year.",
  },
  jn_inskrywing: { af: "inskrywing", en: "entry" },
  jn_inskrywings: { af: "inskrywings", en: "entries" },
  jn_bron_faktuur: { af: "faktuur", en: "invoice" },
  jn_bron_uitbetaling: { af: "uitbetaling", en: "payout" },
  jn_bron_winkel: { af: "winkel", en: "shop" },
  jn_fout: {
    af: "Kon nie die inskrywing stoor nie.",
    en: "The entry could not be saved.",
  },
  jn_laai_fout: {
    af: "Kon nie die joernaal laai nie.",
    en: "The journal could not be loaded.",
  },
  vf_verander: {
    af: "Hierdie lys het intussen verander.",
    en: "This list has changed in the meantime.",
  },
  vf_herlaai: { af: "Herlaai", en: "Reload" },
  skl_skrap: { af: "Skrap", en: "Delete" },
  skl_bevestig: { af: "Skrap regtig?", en: "Really delete?" },
  skl_besig: { af: "Besig \u2026", en: "Working \u2026" },
  sbg_fout: {
    af: "Kon nie die begunstigde skrap nie.",
    en: "The beneficiary could not be deleted.",
  },
  skl_fout: {
    af: "Kon nie die kli\u00ebnt skrap nie.",
    en: "The client could not be deleted.",
  },
  fp_nav_fakture: { af: "Fakture", en: "Invoices" },
  fp_nav_registers: { af: "Registers", en: "Registers" },
  fp_nav_state: { af: "State", en: "Statements" },
  fp_fakture_titel: { af: "Fakture", en: "Invoices" },
  fp_registers_titel: { af: "Registers", en: "Registers" },
  fp_state_titel: { af: "State", en: "Statements" },
  fp_laai: { af: "Word gelaai ...", en: "Loading ..." },
  fp_geen_fakture: { af: "Daar is nog geen fakture nie.", en: "There are no invoices yet." },
  fp_konsep_sonder_nommer: { af: "Konsep", en: "Draft" },
  fp_nog_nie: { af: "Hierdie deel word nog gebou.", en: "This section is still being built." },
  fp_laai_fout: {
    af: "Kon nie die fakture laai nie. Probeer weer.",
    en: "Could not load the invoices. Please try again.",
  },
  fp_geen_toegang: {
    af: "Hierdie bladsy is vir Boekhouding. Meld by die paneelbord aan.",
    en: "This page is for Accounts. Please sign in at the dashboard.",
  },
  fp_geen_rol: {
    af: "Hierdie rekening het nie toegang tot Boekhouding nie. Is die rol pas bygesit, meld een keer af en weer aan.",
    en: "This account does not have access to Accounts. If the role was just added, sign out once and sign in again.",
  },
  fp_gaan_paneelbord: { af: "Gaan na die paneelbord", en: "Go to the dashboard" },
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
    af: "Speel met die persentasies en koste om te sien watter boekprys elke scenario oplewer, en wat vir Future Sharp oorbly — vir gebruik tydens onderhandeling met outeurs.",
    en: "Play with the percentages and costs to see what book price each scenario produces, and what remains for Future Sharp — for use when negotiating with authors.",
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
  // NIE MEER NET E-BOEKE NIE. 'n Harde kopie staan nou ook op hierdie rak,
  // met 'n bestel- of gestuur-pil. "Al jou gekoopte e-boeke" was 'n leuen
  // sodra die eerste gedrukte boek verskyn het.
  my_boeke_subtitel: { af: "Al jou boeke — gereed om te lees, of op pad.", en: "All your books — ready to read, or on the way." },
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

  // --- My besonderhede ---
  // Die skerm is grootliks LEES. Net twee dinge is werklik 'n keuse: die
  // verkoopkennisgewing en die twee kontakvelde. Alles onder "Op rekord"
  // raak die ooreenkoms of die uitbetaling en gaan deur Future Sharp.
  outeur_nav_besonderhede: { af: "My besonderhede", en: "My details" },
  ob_nota: {
    af: "Wat Future Sharp van jou het, en hoe jy van jou boeke wil hoor.",
    en: "What Future Sharp has on record, and how you want to hear about your books.",
  },

  ob_kennisgewings_kop: { af: "Kennisgewings", en: "Notifications" },
  ob_kennisgewings_onder: {
    af: "Wanneer Future Shop vir jou 'n e-pos stuur.",
    en: "When Future Shop sends you an email.",
  },
  ob_verkoop_titel: { af: "Elke e-boek- of leenverkoop", en: "Every e-book or loan sale" },
  ob_verkoop_teks: {
    af: "'n E-pos elke keer as een van jou boeke as e-boek verkoop of uitgeleen word. Skakel dit af as jy eerder net af en toe wil gaan kyk.",
    en: "An email each time one of your books sells as an e-book or is loaned out. Switch it off if you would rather check in now and then.",
  },
  // Die twee wat altyd deurkom, is NIE afgeskakelde kontroles nie. 'n Grys
  // blokkie lees soos iets wat iemand vir hom toegemaak het; 'n merkie lees
  // soos 'n feit oor hoe die stelsel werk.
  ob_permanent: { af: "Permanent aktief.", en: "Always on." },
  ob_hardekopie_titel: { af: "Harde kopie\u00eb", en: "Hard copies" },
  ob_hardekopie_teks: {
    af: "Sodra 'n boek van jou as harde kopie beskikbaar is, kry jy outomaties 'n e-pos by elke verkoop, met die koper se afleweringsbesonderhede.",
    en: "As soon as one of your books is available as a hard copy, you automatically receive an email with every sale, including the buyer's delivery details.",
  },
  ob_terug_titel: { af: "Wanneer 'n vorm teruggestuur word", en: "When a form is sent back" },
  ob_terug_teks: {
    af: "Daar is iets wat jy moet regmaak voordat die boek verder kan gaan.",
    en: "There is something to correct before the book can go further.",
  },

  ob_kontak_kop: { af: "Kontakbesonderhede", en: "Contact details" },
  ob_kontak_onder: {
    af: "Hoe Future Sharp jou bereik, en waarheen 'n bestelling se navrae gaan.",
    en: "How Future Sharp reaches you, and where order queries go.",
  },
  ob_selfoon: { af: "Selfoon", en: "Mobile" },
  ob_adres: { af: "Adres", en: "Address" },

  ob_rekord_kop: { af: "Op rekord", en: "On record" },
  ob_rekord_onder: {
    af: "Wat in jou ooreenkoms staan en waarheen jou geld gaan.",
    en: "What your agreement states and where your money goes.",
  },
  ob_naam: { af: "Naam", en: "Name" },
  ob_epos: { af: "E-pos", en: "Email" },
  ob_id: { af: "ID-nommer", en: "ID number" },
  ob_btw: { af: "BTW-nommer", en: "VAT number" },
  ob_bank: { af: "Bank", en: "Bank" },
  ob_takkode: { af: "Takkode", en: "Branch code" },
  ob_rekening: { af: "Rekeningnommer", en: "Account number" },
  ob_uitbetaling: { af: "Uitbetaling", en: "Payout" },
  ob_gereed: { af: "Gereed", en: "Ready" },
  ob_wag: { af: "Word opgestel", en: "Being set up" },
  ob_nie_verskaf: { af: "nie verskaf nie", en: "not provided" },
  // Die adres staan in die sin self, want 'n outeur wat dit lees, is op die
  // punt om te skryf.
  ob_vas_nota: {
    af: "Jou naam, jou e-pos en jou ID raak jou ooreenkoms en word nie hier verander nie. Stuur 'n e-pos aan futureshop@futuresharp.co.za. Jou bankbesonderhede versoek jy hieronder.",
    en: "Your name, email and ID affect your agreement and are not changed here. Send an email to futureshop@futuresharp.co.za. Your banking details are requested below.",
  },

  ob_bank_versoek_knoppie: { af: "Versoek 'n verandering van bankbesonderhede", en: "Request a change to your banking details" },
  ob_bank_merk: { af: "Verandering versoek", en: "Change requested" },
  ob_bank_vorm_kop: { af: "Nuwe bankbesonderhede", en: "New banking details" },
  ob_bank_vorm_onder: {
    af: "Future Sharp verander dit by die betaaldiens en werk dan hierdie bladsy by. Jou huidige besonderhede bly geld tot dit klaar is.",
    en: "Future Sharp changes this with the payment service and then updates this page. Your current details stay in effect until it is done.",
  },
  ob_bank_houer: { af: "Rekeninghouer, soos dit by die bank staan", en: "Account holder, as it appears at the bank" },
  ob_bank_houer_wenk: { af: "Verskil dit van jou naam hierbo, s\u00ea in die opmerking hoekom.", en: "If this differs from your name above, say why in the comment." },
  ob_bank_houer_ry: { af: "Rekeninghouer", en: "Account holder" },
  ob_bank_kies: { af: "Kies jou bank", en: "Choose your bank" },
  ob_bank_ander: { af: "Ander", en: "Other" },
  ob_bank_kode_wenk: { af: "Word vir jou ingevul sodra jy 'n bank kies.", en: "Filled in for you as soon as you choose a bank." },
  ob_bank_kode_fout: { af: "Die takkode is ses syfers.", en: "The branch code is six digits." },
  ob_bank_rek_fout: { af: "Die rekeningnommer is net syfers, tussen ses en dertien.", en: "The account number is digits only, between six and thirteen." },
  ob_bank_opmerking: { af: "Opmerking (opsioneel)", en: "Comment (optional)" },
  ob_bank_stuur: { af: "Stuur versoek", en: "Send request" },
  ob_bank_kanselleer: { af: "Kanselleer", en: "Cancel" },
  ob_bank_hangend_kop: { af: "Verandering van bankbesonderhede versoek", en: "Change to banking details requested" },
  ob_bank_hangend_nota: {
    af: "Future Sharp hanteer dit en werk hierdie bladsy by sodra dit klaar is. Jou eersvolgende uitbetaling kan 'n dag of wat later wees terwyl die bank die nuwe rekening verifieer, en 'n uitbetaling wat reeds onderweg is, gaan nog na die ou rekening.",
    en: "Future Sharp handles this and updates this page once it is done. Your next payout may be a day or two later while the bank verifies the new account, and a payout already on its way will still go to the old account.",
  },
  ob_bank_onttrek: { af: "Onttrek", en: "Withdraw" },
  // --- Staat ---
  // Die venster is HELE MAANDE, nie dae nie: besigtigings bestaan net per
  // maand, en twee soorte tyd op een skerm sou nie te verdedig wees nie.
  os_nav_staat: { af: "Staat", en: "Statement" },
  os_nota: {
    af: "Wat jou boeke in 'n gekose tydperk gedoen het.",
    en: "What your books did in a chosen period.",
  },
  os_tydperk_kop: { af: "Tydperk", en: "Period" },
  os_tydperk_onder: {
    af: "Hele maande. Besigtigings word per maand getel, dus loop albei syfers oor dieselfde venster.",
    en: "Whole months. Views are counted per month, so both figures cover the same window.",
  },
  os_van: { af: "Van", en: "From" },
  os_tot: { af: "Tot", en: "To" },
  // Staan tussen twee maandname: "Junie tot Augustus 2026".
  os_tot_woord: { af: "tot", en: "to" },
  os_vinnig_maand: { af: "Hierdie maand", en: "This month" },
  os_vinnig_drie: { af: "Laaste 3 maande", en: "Last 3 months" },
  os_vinnig_twaalf: { af: "Laaste 12 maande", en: "Last 12 months" },
  os_vinnig_alles: { af: "Alles", en: "Everything" },
  os_som_verkope: { af: "Verkope", en: "Sales" },
  os_som_deel: { af: "Jou deel", en: "Your share" },
  os_som_besigtigings: { af: "Besigtigings", en: "Views" },
  os_som_titels: { af: "Titels met verkope", en: "Titles with sales" },
  os_per_titel: { af: "Per titel", en: "Per title" },
  os_kol_titel: { af: "Titel", en: "Title" },
  os_kol_formate: { af: "Formate", en: "Formats" },
  os_totaal: { af: "Totaal", en: "Total" },
  // Die twaalf maandname in EEN sleutel, met | tussenin. Die blaaier se eie
  // Afrikaanse maandname is nie oral betroubaar nie.
  os_maande: {
    af: "Januarie|Februarie|Maart|April|Mei|Junie|Julie|Augustus|September|Oktober|November|Desember",
    en: "January|February|March|April|May|June|July|August|September|October|November|December",
  },
  os_excel: { af: "Laai af as Excel", en: "Download as Excel" },
  os_excel_kop: { af: "Outeursstaat", en: "Author statement" },
  os_excel_fout: {
    af: "Kon nie die Excel-l\u00eaer saamstel nie \u2014 probeer weer.",
    en: "Could not compile the Excel file \u2014 please try again.",
  },
  os_druk: { af: "Druk", en: "Print" },
  os_besig: { af: "Word saamgestel\u2026", en: "Compiling\u2026" },
  os_geen: { af: "Geen beweging in hierdie tydperk nie.", en: "No activity in this period." },
  os_omgekeer: {
    af: "Die begin van die tydperk l\u00ea n\u00e1 die einde.",
    en: "The start of the period falls after the end.",
  },
  // Die maandnaam kom tussen die twee helftes in, uit die bediener se
  // antwoord: "... sedert Augustus 2026. Maande daarvoor ...".
  os_nota_vanaf: {
    af: "Besigtigings word per maand gehou sedert",
    en: "Views have been counted per month since",
  },
  os_nota_daarvoor: {
    af: "Maande daarvoor wys geen besigtigings nie, al was daar wel verkope.",
    en: "Months before that show no views, even where there were sales.",
  },
  os_laai: { af: "Laai\u2026", en: "Loading\u2026" },
  os_laai_fout: {
    af: "Kon nie jou staat laai nie. Herlaai die bladsy.",
    en: "Could not load your statement. Reload the page.",
  },
  ob_bank_fout: { af: "Kon nie die versoek stuur nie", en: "Could not send the request" },
  pbv_kop: { af: "Bankbesonderhede-versoeke", en: "Banking detail requests" },
  pbv_hulp: {
    af: "Verander die rekening eers by Paystack. Die knoppie hier teken net aan dat dit gedoen is.",
    en: "Change the account at Paystack first. The button here only records that it has been done.",
  },
  pbv_versoek_op: { af: "Versoek", en: "Requested" },
  pbv_tans: { af: "Tans op rekord:", en: "Currently on record:" },
  pbv_bevestig: { af: "Ek het die rekening by Paystack verander", en: "I have changed the account at Paystack" },
  pbv_gedoen: { af: "Merk as gedoen", en: "Mark as done" },
  pbv_fout: { af: "Kon nie die rekord bywerk nie", en: "Could not update the record" },
  ob_stoor: { af: "Stoor", en: "Save" },
  ob_stoor_besig: { af: "Stoor\u2026", en: "Saving\u2026" },
  ob_gestoor: { af: "Gestoor", en: "Saved" },
  ob_stoor_fout: { af: "Kon nie stoor nie", en: "Could not save" },
  ob_laai: { af: "Laai\u2026", en: "Loading\u2026" },
  ob_laai_fout: {
    af: "Kon nie jou besonderhede laai nie. Herlaai die bladsy.",
    en: "Could not load your details. Reload the page.",
  },

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
  pg_groep_goedgekeur: { af: "Goedgekeur — wag om opgestel te word", en: "Approved — awaiting setup" },
  pg_merk_goedgekeur: { af: "Goedgekeur", en: "Approved" },
  pg_katalogus: { af: "In die katalogus se stores", en: "In the catalogue stores" },
  pg_eboek_sleutel: { af: "E-boek-sleutel", en: "E-book key" },
  pg_omslag_pad: { af: "Omslag-pad", en: "Cover path" },
  pg_keur_goed: { af: "Keur goed", en: "Approve" },
  pg_stuur_terug: { af: "Stuur terug met ’n opmerking", en: "Send back with a comment" },
  pg_opmerking_etiket: { af: "Wat moet die outeur regmaak?", en: "What must the author correct?" },
  pg_terug_stuur: { af: "Stuur terug", en: "Send back" },
  pg_opmerking_verplig: { af: "Skryf eers 'n opmerking.", en: "Write a comment first." },
  pg_besig: { af: "Besig …", en: "Working …" },
  pg_handeling_fout: { af: "Die handeling het misluk.", en: "The action failed." },
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
  pg_f_bygesit: { af: "Bygesit", en: "Added" },
  pg_f_afgehaal: { af: "Afgehaal", en: "Removed" },
  pg_f_afgehaal_nota: { af: "Hierdie formaat word uit die winkel verwyder. Bestellings wat reeds betaal is, staan.", en: "This format will be removed from the shop. Orders already paid for stand." },

  // --- Werk by: 'n goedgekeurde wysiging in die katalogus ---
  pib_werk_by: { af: "Werk by", en: "Update" },
  pib_nota_kop: { af: "goedgekeurde wysiging", en: "approved revision" },
  pib_bygesit: { af: "bygesit", en: "added" },
  pib_afgehaal: { af: "afgehaal", en: "removed" },
  pib_f_eboek: { af: "E-boek", en: "E-book" },
  pib_f_hardekopie: { af: "Harde kopie", en: "Hard copy" },
  pib_f_leen: { af: "Leen", en: "Loan" },
  pib_geen_verskil: { af: "Die formate en pryse stem reeds ooreen met die katalogus.", en: "The formats and prices already match the catalogue." },
  pib_geen_produk: { af: "Hierdie boek staan nie in die katalogus nie. Maak die Katalogus-afdeling eers oop.", en: "This book is not in the catalogue. Open the Catalogue section first." },
  pib_geen_outeur_ry: { af: "Hierdie outeur is nie in die vorm se outeurslys nie. Die verdelingsrye is nie herskryf nie.", en: "This author is not in the form's author list. The distribution rows were not rewritten." },
  pib_geen_som: { af: "Een van die formate se prys kon nie bereken word nie. Gaan die bedrae na.", en: "One of the formats' prices could not be calculated. Check the amounts." },
  pib_merk_fout: { af: "Die boek is bygewerk, maar die indiening kon nie as afgehandel gemerk word nie.", en: "The book was updated, but the submission could not be marked as completed." },
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
  oi_merk_goedgekeur: { af: "Goedgekeur", en: "Approved" },
  pio_stel_op: { af: "Stel op", en: "Set up" },
  pio_nota: { af: "ingevul uit die indiening. Die prys is op na die naaste R5 gerond. Kategorie\u00eb, die etiket en die vrystellingsdatum bly leeg.", en: "filled in from the submission. The price is rounded up to the nearest R5. Categories, the label and the release date stay empty." },
  pio_kategorie: { af: "Die outeur het aangedui:", en: "The author indicated:" },
  pio_geen_outeur: { af: "Hierdie outeur het nog geen inskrywing in die Outeurs-oortjie nie.", en: "This author does not yet have an entry in the Authors tab." },
  pio_merk_fout: { af: "Die boek is geskep, maar die indiening kon nie as opgestel gemerk word nie.", en: "The book was created, but the submission could not be marked as set up." },
  nav_outeurspaneel: { af: "Outeurspaneel", en: "Author panel" },
  // -- Die faktuurvorm se backoffice --------------------------------------
  // Die begroting, die verdeling en die som. Niks hiervan verskyn op die
  // dokument nie, dus loop alles met t() op die platform se taal.
  bo_begroting: { af: "Begrote koste", en: "Budgeted costs" },
  bo_begroting_lei: {
    af: "verskyn n\u00earens op die dokument nie",
    en: "appears nowhere on the document",
  },
  bo_beskrywing: { af: "Beskrywing", en: "Description" },
  bo_inskrywing_plek: {
    af: "Inskrywing \u2014 bly by die faktuur, gaan nooit uit nie",
    en: "Entry \u2014 stays with the invoice, never goes out",
  },
  // Die strook wat aanbied om \u0027n onbekende beskrywing by die register
  // te voeg. Sien faktuur-nuwe-koste-item.js. Sy KEER niks \u2014 die
  // faktuur werk klaar reg met \u0027n beskrywing wat nerens gestoor is nie.
  // Die PUBLIEKE begunstigdevorm, 19 Augustus 2026. Sien
  // begunstigdevorm.html. Die woord "Paystack" verskyn nerens op
  // hierdie bladsy nie: dit is \u0027n verskaffer se naam wat vir die
  // begunstigde niks beteken nie en wat kan verander.
  // Die WAGKAMER: indienings van die publieke begunstigdevorm wat nog
  // nie oorgedra is nie. Sien faktuurpaneel-wagkamer.js. Die merkies
  // KEER niks \u2014 hulle se net wat elders bestaan.
  wk_skakel_titel: { af: "Begunstigdevorm-skakel", en: "Beneficiary form link" },
  wk_titel: { af: "Indienings wat wag", en: "Submissions waiting" },
  wk_ingedien: { af: "Ingedien", en: "Submitted" },
  wk_in_register: {
    af: "Staan reeds in die register",
    en: "Already in the register",
  },
  wk_is_outeur: { af: "Ook \u0027n outeur", en: "Also an author" },
  wk_epos: { af: "E-pos", en: "Email" },
  wk_selfoon: { af: "Selfoon", en: "Mobile" },
  wk_adres: { af: "Adres", en: "Address" },
  wk_bank_kop: { af: "Bankbesonderhede", en: "Bank details" },
  wk_geen_bank: {
    af: "Geen bankbesonderhede ingevul nie.",
    en: "No bank details were filled in.",
  },
  wk_rekeninghouer: { af: "Rekeninghouer", en: "Account holder" },
  wk_bank: { af: "Bank", en: "Bank" },
  wk_rekening: { af: "Rekening", en: "Account" },
  wk_takkode: { af: "Takkode", en: "Branch code" },
  wk_tipe: { af: "Rekeningtipe", en: "Account type" },
  wk_naam: { af: "Naam vir die register", en: "Name for the register" },
  wk_kode: { af: "Subrekening-kode", en: "Subaccount code" },
  wk_let: {
    af: "Die naam bepaal die rekord se sleutel en kan daarna nooit verander nie. Sonder \u0027n kode word die rekord Wag vir subrekening en die ry word met die hand betaal \u2014 dit keer niks.",
    en: "The name determines the record`s key and can never change afterwards. Without a code the record becomes Awaiting subaccount and that row is paid by hand \u2014 it blocks nothing.",
  },
  wk_dra_oor: { af: "Dra oor", en: "Transfer" },
  wk_vee: { af: "Vee weg", en: "Delete" },
  wk_vee_seker: {
    af: "Vee hierdie indiening weg? Dit kan nie ongedaan gemaak word nie en die persoon sal weer moet indien.",
    en: "Delete this submission? This cannot be undone and the person will have to submit again.",
  },
  wk_besig: { af: "Besig \u2026", en: "Working \u2026" },
  wk_fout_naam: { af: "Die naam is verplig.", en: "The name is required." },
  wk_fout_kode: {
    af: "Die kode moet met ACCT_ begin.",
    en: "The code must start with ACCT_.",
  },
  wk_bestaan: {
    af: "Daar is reeds \u0027n begunstigde met hierdie naam. Verander die naam, of vee die indiening weg as dit dieselfde persoon is.",
    en: "There is already a beneficiary with this name. Change the name, or delete the submission if it is the same person.",
  },
  wk_half: {
    af: "Die begunstigde is geskep, maar die indiening kon nie geskrap word nie. Vee hom met die hand weg.",
    en: "The beneficiary was created, but the submission could not be deleted. Remove it by hand.",
  },
  wk_fout: { af: "Kon nie oordra nie. Probeer weer.", en: "Could not transfer. Try again." },
  wk_fout_vee: { af: "Kon nie wegvee nie. Probeer weer.", en: "Could not delete. Try again." },
  bv_titel: { af: "Jou besonderhede", en: "Your details" },
  bv_lei: {
    af: "Voltooi die vorm sodat ons jou kan betaal vir werk wat jy gedoen het of koste wat jy namens Future Sharp aangegaan het.",
    en: "Complete the form so we can pay you for work you have done or costs you have carried on behalf of Future Sharp.",
  },
  bv_naam: { af: "Volle naam", en: "Full name" },
  bv_epos: { af: "E-pos", en: "Email" },
  bv_selfoon: { af: "Selfoon", en: "Mobile" },
  bv_adres: { af: "Adres", en: "Address" },
  bv_opsioneel: { af: "\u2014 opsioneel", en: "\u2014 optional" },
  bv_bank_kop: { af: "Bankbesonderhede", en: "Bank details" },
  bv_bank_lei: {
    af: "Hiermee word \u0027n betaalrekening by ons betaaldiens opgestel.",
    en: "This is used to set up a payment account with our payment provider.",
  },
  bv_rekeninghouer: { af: "Rekeninghouer", en: "Account holder" },
  bv_rekeninghouer_hulp: {
    af: "Soos dit op die bankrekening staan. Betaal jy in iemand anders se rekening, gee daardie naam.",
    en: "As it appears on the bank account. If you are paid into someone else\u0027s account, give that name.",
  },
  bv_bank: { af: "Bank", en: "Bank" },
  bv_rekeningnommer: { af: "Rekeningnommer", en: "Account number" },
  bv_takkode: { af: "Takkode", en: "Branch code" },
  bv_tipe: { af: "Rekeningtipe", en: "Account type" },
  bv_tipe_tjek: { af: "Tjekrekening", en: "Cheque account" },
  bv_tipe_spaar: { af: "Spaarrekening", en: "Savings account" },
  bv_pot_etiket: { af: "Laat hierdie veld leeg", en: "Leave this field empty" },
  bv_stuur: { af: "Stuur besonderhede", en: "Send details" },
  // HIERDIE SIN IS \u0027N BELOFTE WAT DIE KODE NAKOM. wysig-begunstigde.js
  // en dra-begunstigde-oor.js maak die bankvelde LEEG sodra daar \u0027n
  // subrekening-kode is. Verander daardie reel ooit, moet hierdie sin
  // saam verander.
  bv_belofte: {
    af: "Jou bankbesonderhede word gebruik om die betaalrekening op te stel en word nie by Future Sharp gehou nie.",
    en: "Your bank details are used to set up the payment account and are not kept by Future Sharp.",
  },
  bv_besig: { af: "Besig om te stuur\u2026", en: "Sending\u2026" },
  bv_fout: {
    af: "Kon nie stuur nie. Probeer asseblief weer.",
    en: "Could not send. Please try again.",
  },
  bv_te_veel: {
    af: "Te veel pogings. Probeer oor \u0027n uur weer.",
    en: "Too many attempts. Please try again in an hour.",
  },
  bv_fout_naam: { af: "Vul jou naam in.", en: "Enter your name." },
  bv_fout_epos: {
    af: "Vul \u0027n geldige e-posadres in.",
    en: "Enter a valid email address.",
  },
  bv_dankie_kop: {
    af: "Dankie \u2014 ons het dit ontvang",
    en: "Thank you \u2014 we have received it",
  },
  bv_dankie_teks: {
    af: "Jou besonderhede is deurgestuur. Ons laat weet sodra die betaalrekening opgestel is.",
    en: "Your details have been sent. We will let you know once the payment account is set up.",
  },
  bv_navrae: { af: "Navrae", en: "Enquiries" },
  bv_voet_reg: { af: "Reg. nr.", en: "Reg. no." },
  nki_onbekend: {
    af: "is nog nie in die register nie.",
    en: "is not in the register yet.",
  },
  // DIE STROOK VRA EERS OF IETS NABY PAS. Sien faktuur-nuwe-koste-item.js:
  // die strook het op 27 Augustus 2026 duplikate uitgenooi omdat hy net twee
  // toestande geken het — presies bekend, of onbekend. "Bedoel jy" is die
  // derde, en die algemeenste.
  //
  // GEEN VRAAGTEKEN NIE: die items self volg as knoppies. "Bedoel jy
  // Studievaardigheid?" met die vraagteken IN die sleutel sou beteken die
  // teken staan voor die knoppie in plaas van agter die woord.
  nki_bedoel_jy: { af: "Bedoel jy", en: "Did you mean" },
  nki_of_nuut: { af: "of skep", en: "or create" },
  nki_voeg_werk: { af: "+ Werk", en: "+ Work" },
  nki_voeg_uitgawe: { af: "+ Uitgawe", en: "+ Expense" },
  nki_bygevoeg: { af: "By die register gevoeg.", en: "Added to the register." },
  nki_bestaan: { af: "Staan reeds in die register.", en: "Already in the register." },
  nki_fout: { af: "Kon nie byvoeg nie.", en: "Couldn\u0027t add it." },
  bo_voeg_koste: { af: "+ Voeg koste by", en: "+ Add a cost" },
  bo_verwyder: { af: "Verwyder", en: "Remove" },
  // ═══ DIE KOP VAN DIE VERDELING ═══════════════════════════════════════
  //
  // Die vraag wat 'n mens werklik vra terwyl 'n mens 'n verdeling opstel, is
  // EEN vraag: hoeveel kan ek nog toeken? Dit was tot 28 Augustus 2026 nêrens
  // op die skerm nie -- 'n mens het 'n bedrag getik, na "Na Future Sharp"
  // gekyk, en weer aangepas.

  // DIE ETIKET DRA DIE FEIT, nie een naam vir albei toestande nie. "Nog
  // beskikbaar om toe te ken: −R106,49" is 'n leuen: daar is niks beskikbaar
  // nie, daar is 'n oorbesteding.
  bo_nog_beskikbaar: { af: "Nog beskikbaar om toe te ken", en: "Still available to allocate" },
  bo_oorbestee_met: { af: "Oorbestee met", en: "Over-allocated by" },

  // 'n KEUSE. Jy het dit getik en jy kan dit verander.
  bo_reeds_toegeken: { af: "reeds toegeken", en: "already allocated" },

  // 'n GEVOLG. Dit volg uit die uitgawes en jy kan dit nie raak nie.
  //
  // 'n Uitgawereël gee sy ontvanger sy VOLLE bedrag terug — R500 brandstof is
  // R500 — maar bring net R482,37 in ná sy deel van die fooi. Daardie R17,63
  // het geen marge om uit betaal te word nie, en die faktuur se enigste marge
  // is die werkdeel.
  bo_uitgawes_fooi: {
    af: "gaan na die uitgawes se deel van die fooi",
    en: "goes to the expenses' share of the fee",
  },

  // Die afbreek van die fooi: watter reël dra hoeveel.
  bo_fooi_wys: { af: "wys waaruit", en: "show the breakdown" },
  bo_uitgawe: { af: "uitgawe", en: "expense" },

  bo_fooi_weg: { af: "steek weg", en: "hide" },
  bo_gekopieer: { af: "gekopieer", en: "copied" },
  // Die regstelling by 'n veld: wat hy moet wees sodat die faktuur klop.
  // Slegs by oorbesteding, en slegs wanneer die antwoord ondubbelsinnig is.
  bo_sou_klop: { af: "sou klop", en: "would balance" },
  bo_regstel_titel: { af: "Klik om in te vul", en: "Click to fill in" },

  bo_kopieer: { af: "Klik om te kopieer", en: "Click to copy" },

  bo_reel_naamloos: { af: "Naamloos", en: "Unnamed" },
  bo_soort_inkomste: { af: "Inkomste", en: "Income" },
  bo_soort_uitgawe: { af: "Uitgawe", en: "Expense" },
  bo_voeg_ontvanger: { af: "+ Voeg 'n ontvanger by", en: "+ Add a recipient" },
  bo_hosting_kort: { af: "Hosting", en: "Hosting" },
  // NIE 'n BESTEMMING NIE. Hierdie veld is wat EEN REEL nog nie toegedeel het
  // nie. Dit het "Na Future Sharp" gelees, terwyl bo_oorskot hieronder
  // dieselfde woorde vir die HELE faktuur dra -- en die twee wys verskillende
  // getalle sodra daar 'n uitgawereel is.
  //
  // Die identiteit wat wel geld:
  //   som(elke reel se onverdeelde bedrag)
  //     = die uitgawes se deel van die fooi + wat vir Future Sharp oorbly
  //
  // Die reels tel dus wel op -- net na 'n ander totaal as die een wat die ou
  // etiket genoem het. Per reel het die bedrag geen bestemming nie, net 'n
  // toestand: hierdie reel is nog nie klaar toegedeel nie.
  bo_oorskot_kort: { af: "Onverdeeld", en: "Unallocated" },
  bo_koste_reel: {
    af: "Geen hosting \u2014 die ontvanger kry die volle bedrag terug.",
    en: "No hosting \u2014 the recipient gets the full amount back.",
  },
  bo_koste_sonder_ontvanger: {
    af: "'n Uitgawe moet iemand h\u00ea om aan terug te betaal. Kies 'n ontvanger, of maak die re\u00ebl 'n inkomste.",
    en: "An expense needs someone to pay back. Choose a recipient, or make the line an income.",
  },
  bo_pct_bo_honderd: {
    af: "Die persentasies tel op tot ",
    en: "The percentages add up to ",
  },
  bo_reel_gedra: {
    af: "Die ontvanger kry die volle bedrag, dus word hierdie re\u00ebl se deel van die transaksiefooi \u2014 ",
    en: "The recipient gets the full amount, so this line's share of the transaction fee \u2014 ",
  },
  bo_reel_gedra_end: {
    af: " \u2014 uit Future Sharp se deel gedek.",
    en: " \u2014 is covered from Future Sharp's share.",
  },

  // Die pad is 'n GEVOLG van die ontvanger, nie 'n keuse nie. Die derde een
  // is die geval wat maklik misgekyk word: Paystack kan iemand sonder 'n
  // subrekening nie betaal nie, dus val sy ry na die hoofrekening.
  bo_pad_split: { af: "Verdelingsry", en: "Split line" },
  bo_pad_hoof: { af: "Hoofrekening", en: "Main account" },
  bo_pad_wag: {
    af: "Hoofrekening \u2014 geen subrekening",
    en: "Main account \u2014 no subaccount",
  },

  bo_verdeling: { af: "Verdeling van die faktuurtotaal", en: "Split of the invoice total" },
  bo_fooi_lei: {
    af: "Transaksiefooi \u2014 voorsiening 3,5% + R1,30",
    en: "Transaction fee \u2014 provision 3.5% + R1.30",
  },
  bo_voeg_verdeling: { af: "+ Voeg 'n verdeling by", en: "+ Add a split line" },
  bo_totaal: { af: "Faktuurtotaal", en: "Invoice total" },
  bo_fooi: { af: "Transaksiefooi", en: "Transaction fee" },
  bo_verdeelbaar: { af: "Verdeelbaar", en: "Distributable" },
  bo_word_uitbetaal: { af: "Word uitbetaal", en: "Paid out" },
  bo_een_ontvanger: { af: "1 ontvanger", en: "1 recipient" },
  bo_ontvangers: { af: "ontvangers", en: "recipients" },
  bo_bly_hoof: { af: "Bly in die hoofrekening", en: "Stays in the main account" },
  bo_hosting: { af: "Hosting", en: "Hosting" },
  bo_skenking_na_fooi: {
    af: "Skenking, n\u00e1 haar deel van die fooi",
    en: "Donation, after its share of the fee",
  },
  bo_oorskot: { af: "Na Future Sharp se rekening", en: "To the Future Sharp account" },
  bo_begroot_hoof: { af: "Begroot uit die hoofrekening", en: "Budgeted from the main account" },
  // NIE DIESELFDE AS bo_oorskot NIE, en tot 27 Augustus 2026 het albei
  // "Na Future Sharp se rekening" gelees. Die twee reels het dieselfde etiket
  // en dieselfde syfer gedra, met "Begroot uit die hoofrekening" tussenin —
  // en dan lyk die begroting of sy niks doen nie.
  //
  //   bo_oorskot  — wat uit die verdeling INKOM
  //   bo_bly_oor  — wat OORBLY nadat die begrote koste afgetrek is
  //
  // Die HTML se terugval was al die tyd reg; die vertaling het hom oorskryf.
  bo_bly_oor: { af: "Bly oor vir Future Sharp", en: "Left for Future Sharp" },
  bo_tekort: { af: "Tekort", en: "Shortfall" },

  bo_dek_nie: {
    af: "Die faktuur dek nie die begrote koste nie.",
    en: "The invoice does not cover the budgeted costs.",
  },
  bo_verhoog: { af: "Verhoog die prys tot dit dek", en: "Raise the price until it covers" },
  bo_onoplosbaar: {
    af: "'n Ho\u00ebr prys help nie: die persentasies vat alles wat bykom. Verlaag 'n persentasie of skuif 'n koste.",
    en: "A higher price does not help: the percentages take everything added. Lower a percentage or move a cost.",
  },
  bo_oorbestee: {
    af: "Die verdeling oorskry die verdeelbare bedrag met",
    en: "The split exceeds the distributable amount by",
  },
  bo_oorbestee_lei: {
    af: "Paystack verwerp 'n verdeling wat nie binne die transaksie klop nie.",
    en: "Paystack rejects a split that does not balance within the transaction.",
  },

  bo_afslag_kop: { af: "Afslag en skenking", en: "Discount and donation" },
  bo_afslag: { af: "Afslag (R)", en: "Discount (R)" },
  bo_koepon: { af: "Koeponkode", en: "Coupon code" },
  bo_skenking: { af: "Skenking (R)", en: "Donation (R)" },
  bo_hosting_pct: { af: "Hosting (%)", en: "Hosting (%)" },
  bo_afslag_lei: {
    af: "Afslag verminder die verdeelbare bedrag. Skenking bly buite die verdeling.",
    en: "A discount reduces the distributable amount. A donation stays outside the split.",
  },

  // -- Die faktuurvorm se eie skerm ------------------------------------
  // Hierdie sleutels loop met t(), soos elke ander skerm: dit is JULLE
  // skerm. Die DOKUMENT se sleutels (fd_) loop met t_in() op die faktuur se
  // eie taalveld. Die twee mag nie meng nie.
  fv_nav_boekhouding: { af: "Boekhouding", en: "Accounting" },
  fv_terug: { af: "\u2190 Boekhouding", en: "\u2190 Accounting" },
  fv_stand_konsep: { af: "Konsep", en: "Draft" },
  fv_stand_gestuur: { af: "Gestuur", en: "Sent" },
  fv_stand_betaal: { af: "Betaal", en: "Paid" },
  fv_stand_gekanselleer: { af: "Gekanselleer", en: "Cancelled" },
  fv_kies_klient: { af: "Kies 'n kli\u00ebnt \u2026", en: "Choose a client \u2026" },
  fv_geen_klient: { af: "Nog geen kli\u00ebnt gekies nie", en: "No client chosen yet" },
  fv_voeg_reel: { af: "Voeg re\u00ebl by", en: "Add line" },
  // ═══ DIE INVOU ═══════════════════════════════════════════════════════
  //
  // 'n Reël se bedrag tel by die reël BO HAAR wanneer die dokument druk. Die
  // VOLGORDE is die groepering — geen tweede naamveld nie, want die naam wat
  // die kliënt sien, is 'n gewone reël wat reeds getik word.
  //
  // Sien Reels-Invou-En-Volgorde-Ontwerp.md.

  // Die ↳-knoppie se titel wissel met die stand van die reël.
  // ── Ontdoen en herdoen ──
  //
  // Hulle dek wat die VORM doen, nie die uitreiking nie: daardie handeling het
  // buite die blad gebeur -- 'n nommer toegeken, 'n split geskep, 'n pos
  // gestuur -- en 'n knoppie wat "ontdoen" sê maar die pos nie kan terughaal
  // nie, is erger as geen knoppie.
  fv_ontdoen: { af: "Ontdoen", en: "Undo" },
  fv_herdoen: { af: "Herdoen", en: "Redo" },

  fv_vou_in: { af: "Vou in by die reël bo", en: "Fold into the line above" },
  fv_vou_uit: { af: "Staan op haar eie", en: "Show as its own line" },

  // 'n DRA-REEL SKUIF MET HAAR KINDERS; 'n kind skuif net binne haar eie
  // groep. Die titels sê dit, want die pyltjie lyk in albei gevalle dieselfde.
  fv_skuif_op: { af: "Skuif die groep op", en: "Move the group up" },
  fv_skuif_af: { af: "Skuif die groep af", en: "Move the group down" },
  fv_skuif_op_groep: { af: "Skuif op binne die groep", en: "Move up within the group" },
  fv_skuif_af_groep: { af: "Skuif af binne die groep", en: "Move down within the group" },

  // Die + sit op ELKE reël, nie net onderaan nie.
  fv_voeg_onder: { af: "Voeg 'n reël hieronder in", en: "Insert a line below" },

  // Die merkie onder 'n dra-reël se beskrywing. Twee vorme, want "1 reëls" is
  // 'n fout wat 'n mens by elke enkele groep sien.
  fv_reel_vou_in: { af: "reël vou hieronder in", en: "line folds in below" },
  fv_reels_vou_in: { af: "reëls vou hieronder in", en: "lines fold in below" },

  // WAT DIE KLIENT SIEN. Die tabel wys al die reëls, ingekeep; die gedrukte
  // dokument groepeer. Sonder hierdie strook kan 'n mens die groepering nie
  // nagaan voordat die dokument uitgaan nie.
  fv_voorskou: {
    af: "Wat die kliënt op die dokument sien",
    en: "What the client sees on the document",
  },
  fv_naamloos: { af: "naamloos", en: "unnamed" },

  fv_verwyder_reel: { af: "Verwyder re\u00ebl", en: "Remove line" },
  fv_gestoor: { af: "Gestoor", en: "Saved" },
  fv_nie_gestoor: { af: "Nog nie gestoor nie", en: "Not saved yet" },
  fv_stoor_fout: {
    af: "Kon nie stoor nie \u2014 probeer weer",
    en: "Could not save \u2014 try again",
  },
  fv_toe: {
    af: "Uitgereik \u2014 word nie meer gewysig nie",
    en: "Issued \u2014 no longer editable",
  },
  fv_laai_fout: {
    af: "Kon nie hierdie faktuur laai nie.",
    en: "Could not load this invoice.",
  },

  // -- Die faktuurdokument ----------------------------------------------
  // Hierdie sleutels word met t_in(sleutel, faktuur.taal) gelees, NIE met
  // t() nie. Die dokument se taal staan op die faktuur se eie rekord; die
  // platform se taalkeuse mag dit nie oorheers nie.
  fd_proforma: { af: "Proforma-faktuur", en: "Proforma invoice" },
  fd_stand_konsep: { af: "Konsep", en: "Draft" },
  fd_stand_gestuur: { af: "Gestuur", en: "Sent" },
  fd_stand_betaal: { af: "Betaal", en: "Paid" },
  fd_stand_gekanselleer: { af: "Gekanselleer", en: "Cancelled" },
  fd_gefaktureer_aan: { af: "Gefaktureer aan", en: "Billed to" },
  fd_besonderhede: { af: "Besonderhede", en: "Details" },
  fd_datum: { af: "Datum", en: "Date" },
  fd_betaalbaar_teen: { af: "Betaalbaar teen", en: "Payable by" },
  fd_bestelnommer: { af: "Bestelnommer", en: "Order number" },
  fd_kol_beskrywing: { af: "Beskrywing", en: "Description" },
  fd_kol_hoeveelheid: { af: "Hoeveelheid", en: "Quantity" },
  fd_kol_eenheidsprys: { af: "Eenheidsprys", en: "Unit price" },
  fd_kol_bedrag: { af: "Bedrag", en: "Amount" },
  fd_subtotaal: { af: "Subtotaal", en: "Subtotal" },
  fd_afslag: { af: "Afslag", en: "Discount" },
  fd_skenking: { af: "Skenking", en: "Donation" },
  fd_totaal_verskuldig: { af: "Totaal verskuldig", en: "Total due" },
  fd_aantekening: { af: "Aantekening", en: "Note" },
  // GEEN METODELYS NIE. Watter metodes Paystack bied, verander DAAR en nie
  // hier nie; die opskrif noem die pad, die betaler sien die metodes daar.
  fd_eft_kop: {
    af: "Betaal deur die skakel",
    en: "Pay via the link",
  },
  fd_eft_lei: {
    af: "Die betaling word dadelik bevestig.",
    en: "Payment is confirmed immediately.",
  },
  // Die inline "+ Nuwe klient"-paneel in die faktuurvorm. Sien
  // faktuur-nuwe-klient.js. Die paneel dra sy eie sleutels omdat sy
  // etikette van die Registers-blad s`n kan verskil sonder dat een die
  // ander sleep.
  nk_nuwe_klient: { af: "+ Nuwe kli\u00ebnt", en: "+ New client" },
  nk_kop: { af: "Nuwe kli\u00ebnt", en: "New client" },
  nk_instansie: { af: "Instansie", en: "Institution" },
  nk_privaat: { af: "Privaat", en: "Private" },
  nk_naam_instansie: { af: "Naam van die instansie", en: "Name of the institution" },
  nk_naam_privaat: { af: "Naam", en: "Name" },
  nk_kontak: { af: "Kontakpersoon", en: "Contact person" },
  nk_epos: { af: "E-pos", en: "Email" },
  nk_selfoon: { af: "Selfoon", en: "Mobile" },
  nk_adres: { af: "Adres", en: "Address" },
  nk_stoor: { af: "Stoor en kies", en: "Save and select" },
  nk_kanselleer: { af: "Kanselleer", en: "Cancel" },
  nk_hulp: {
    af: "Stoor met net \u0027n naam \u2014 die res kan later",
    en: "Save with just a name \u2014 the rest can follow",
  },
  nk_naam_fout: { af: "Vul die naam in.", en: "Enter the name." },
  nk_duplikaat: {
    af: "Hierdie adres staan reeds by",
    en: "This address is already used by",
  },
  nk_besig: { af: "Besig\u2026", en: "Saving\u2026" },
  nk_fout: {
    af: "Kon nie stoor nie. Probeer weer.",
    en: "Couldn\u0027t save. Try again.",
  },
  fd_betaal_knop: { af: "Betaal", en: "Pay" },
  fd_bank_kop: { af: "Bankoorbetaling", en: "Bank transfer" },
  fd_rekening: { af: "Rekening", en: "Account" },
  fd_takkode: { af: "Takkode", en: "Branch code" },
  fd_verwysing: { af: "Verwysing", en: "Reference" },
  // Die QR se byskrif. Die kode self is 'n URL en verander nooit met taal
  // nie; net hierdie reël skakel saam met die dokument.
  fd_qr_teks: { af: "Skandeer om te betaal", en: "Scan to pay" },
  // Een sleutel, twaalf afkortings. Mrt/Mar, Okt/Oct en Des/Dec verskil;
  // die res is dieselfde. Die kode split op die komma.
  fd_maande: {
    af: "Jan,Feb,Mrt,Apr,Mei,Jun,Jul,Aug,Sep,Okt,Nov,Des",
    en: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec",
  },

  // ── betaal-klaar.html ────────────────────────────────────────────────
  //
  // Waar die klient land nadat Paystack hom teruggestuur het. Hy lees met
  // t_in() uit die FAKTUUR se taalveld, nie met t() nie — dieselfde bron as
  // die dokument wat hy ontvang het, want dit is dieselfde gesprek.
  //
  // VIER UITKOMSTE, NIE TWEE NIE. 'n Kansellasie kom by dieselfde URL uit as
  // 'n geslaagde betaling, en 'n Instant EFT is asinkroon — die klient kan
  // terug wees voordat sy bank bevestig het.
  bk_besig: { af: "Besig om die transaksie te verifieer", en: "Verifying the transaction" },

  bk_merk_betaal: { af: "Betaal", en: "Paid" },
  bk_merk_loop: { af: "In verwerking", en: "Processing" },
  bk_merk_oop: { af: "Onbetaal", en: "Outstanding" },
  bk_merk_onbekend: { af: "Onbevestig", en: "Unconfirmed" },

  bk_kop_betaal: { af: "Betaling ontvang", en: "Payment received" },
  // GEEN "'n KWITANSIE VOLG" NIE. Die webhook stuur die kwitansie voordat
  // Paystack die klient na hierdie bladsy terugstuur — teen die tyd dat hy
  // dit lees, is die pos reeds weg. "Volg" was verkeerd.
  bk_teks_betaal: {
    af: "Die betaling is teen hierdie faktuur toegewys.",
    en: "The payment has been allocated to this invoice.",
  },

  bk_kop_loop: { af: "Betaling in verwerking", en: "Payment processing" },
  // Die waarskuwing teen 'n tweede betaling is nie oorversigtig nie: 'n
  // Instant EFT wat nog nie deur is nie, lyk vir 'n debiteureklerk soos 'n
  // mislukte een, en 'n dubbele betaling verg 'n terugbetaling wat die
  // module nie het nie.
  bk_teks_loop: {
    af: "Die transaksie is geïnisieer, maar die bank het dit nog nie bevestig nie. Moenie 'n tweede betaling deurgee nie — die kwitansie volg per e-pos sodra die transaksie deurgaan.",
    en: "The transaction has been initiated, but the bank has not confirmed it yet. Do not submit a second payment — the receipt follows by email once the transaction clears.",
  },

  bk_kop_oop: { af: "Betaling nie voltooi nie", en: "Payment not completed" },
  bk_teks_oop: {
    af: "Geen debiet is teen jou rekening verwerk nie. Die faktuur bly onbetaal en die betaalskakel bly geldig.",
    en: "No debit has been processed against your account. The invoice remains outstanding and the payment link remains valid.",
  },

  bk_kop_onbekend: { af: "Betalingstatus onbevestig", en: "Payment status unconfirmed" },
  bk_teks_onbekend: {
    af: "Die transaksie se status kon nie tans bevestig word nie. Die faktuur se rekord is onveranderd. Het die betaling deurgegaan, volg die kwitansie per e-pos.",
    en: "The status of the transaction could not be confirmed at this time. The invoice record is unchanged. If the payment cleared, a receipt follows by email.",
  },

  bk_nommer: { af: "Faktuurnommer", en: "Invoice number" },
  // TWEE ETIKETTE VIR EEN BEDRAG, want dit is twee verskillende feite. Wat
  // ontvang is, is nie wat verskuldig is nie.
  bk_verskuldig: { af: "Totaal verskuldig", en: "Total due" },
  bk_ontvang: { af: "Bedrag ontvang", en: "Amount received" },

  bk_hervat: { af: "Hervat die betaling", en: "Resume payment" },
  bk_navrae: {
    af: "Rig navrae oor hierdie faktuur aan",
    en: "Direct any queries about this invoice to",
  },
  bk_voet: {
    af: "Future Sharp NPC · Registrasienommer 2024/117444/08 · Posbus 11602, Queenswood, Pretoria, 0121",
    en: "Future Sharp NPC · Registration number 2024/117444/08 · PO Box 11602, Queenswood, Pretoria, 0121",
  },

  // ── die faktuurlys se rye ────────────────────────────────────────────
  fp_nuwe_faktuur: { af: "+ Nuwe faktuur", en: "+ New invoice" },
  fp_faktuur_een: { af: "faktuur", en: "invoice" },
  fp_faktuur_baie: { af: "fakture", en: "invoices" },

  // Die stand gaan oor GELD. Lewering en uitbetaling dra hul eie velde en kry
  // later hul eie merkers; hulle word nooit 'n stand nie.
  fp_stand_konsep: { af: "Konsep", en: "Draft" },
  fp_stand_gestuur: { af: "Gestuur", en: "Sent" },
  fp_stand_betaal: { af: "Betaal", en: "Paid" },
  fp_stand_gekanselleer: { af: "Gekanselleer", en: "Cancelled" },

  // Die stempel leef op die REKORD, gegee by die skepping terwyl TOETSFASE
  // aan is. Hy verander daarna nooit, dus is daar geen ontsluit-pad in die
  // kode wat iemand later kan omdraai nie.
  fp_toetsdata: { af: "Toetsdata", en: "Test data" },

  fp_skrap: { af: "Skrap", en: "Delete" },
  fp_skrap_vra: { af: "Skrap?", en: "Delete?" },
  fp_ja: { af: "Ja", en: "Yes" },
  fp_nee: { af: "Nee", en: "No" },
  fp_skrap_fout: {
    af: "Kon nie die faktuur skrap nie.",
    en: "The invoice could not be deleted.",
  },

  // ── uitreiking: die knoppie, die bevestiging, die betaalskakel ───────
  //
  // Die knoppie heet REIK UIT, nie Stuur nie. Op hierdie oomblik word niks
  // gestuur nie: die nommer word getrek, die verdeling vries en die
  // betaalskakel word geskep. Die proforma-e-pos kom later, en dan bly die
  // woord steeds reg — uitreik is wat gebeur, en die pos is 'n gevolg.
  // Druk die dokument. 'n Skool se finansiele afdeling laai 'n PDF in sy
  // stelsel; 'n skakel help hulle nie.
  fv_druk: { af: "Druk", en: "Print" },

  // ── kanselleer ──────────────────────────────────────────────────────
  //
  // 'n Uitgereikte faktuur word nie gewysig en nie uitgevee nie. Hy dra 'n
  // nommer in 'n deurlopende reeks, en die punt van daardie reeks is dat 'n
  // gaping SIGBAAR is.
  // fk_kanselleer bestaan reeds op reël 460 — die kliëntvorm gebruik hom, met
  // presies dieselfde woord. Twee inskrywings vir een sleutel beteken die
  // tweede wen stilweg, en dan verander 'n mens die een en wonder hoekom niks
  // gebeur nie.
  fk_vra_kop: { af: "Kanselleer hierdie faktuur?", en: "Cancel this invoice?" },
  fk_vra_teks: {
    af: "Die faktuur bly staan as rekord, met sy nommer, maar hy word dood gemerk. Wil jy iets verander, word 'n nuwe uitgereik.",
    en: "The invoice remains on record, with its number, but is marked dead. If you want to change something, a new one is issued.",
  },
  fk_rede: { af: "Rede", en: "Reason" },
  fk_rede_kort: {
    af: "Gee 'n rede vir die kansellasie.",
    en: "Give a reason for the cancellation.",
  },
  fk_bevestig: { af: "Kanselleer die faktuur", en: "Cancel the invoice" },
  fk_fout: {
    af: "Kon nie die faktuur kanselleer nie.",
    en: "The invoice could not be cancelled.",
  },

  /* -- die handmatige betaling --
     Geld wat buite die betaalskakel om ontvang is. Sien
     faktuur-betaling-aan.js en teken-betaling-aan.js. */
  fb_knop: { af: "Betaling ontvang", en: "Payment received" },
  fb_kop: { af: "Teken 'n betaling aan", en: "Record a payment" },
  fb_teks: {
    af: "Vir geld wat buite die betaalskakel om ontvang is. Die faktuur gaan na Betaal en kan daarna nie verander word nie.",
    en: "For money received outside the payment link. The invoice goes to Paid and cannot be changed after that.",
  },
  fb_waarsku: {
    af: "Die betaling is nie deur Paystack hanteer nie, dus het die outomatiese verdeling nie plaasgevind nie en sal handmatig hanteer moet word. Die ontvangers verskyn onder State, by die begunstigdes wat uit die hoofrekening betaal moet word.",
    en: "This payment was not handled by Paystack, so the automatic split did not take place and will have to be handled manually. The recipients appear under Statements, among the beneficiaries to be paid from the main account.",
  },
  fb_bedrag: { af: "Bedrag ontvang", en: "Amount received" },
  fb_datum: { af: "Datum ontvang", en: "Date received" },
  fb_verwysing: { af: "Verwysing op die bankstaat", en: "Reference on the bank statement" },
  fb_nota: { af: "Aantekening", en: "Note" },
  fb_te_min: { af: "Dit is minder as die faktuur \u2014", en: "This is less than the invoice \u2014" },
  fb_te_veel: { af: "Dit is meer as die faktuur \u2014", en: "This is more than the invoice \u2014" },
  fb_verskil_lei: {
    af: "Dit word aangeteken soos dit ontvang is. Die ontvangers kry steeds elkeen presies wat op die faktuur gevries is.",
    en: "It is recorded as it was received. Each recipient still gets exactly what was frozen on the invoice.",
  },
  fb_bedrag_kort: { af: "Gee die bedrag wat ontvang is.", en: "Give the amount received." },
  fb_datum_kort: {
    af: "Gee die datum waarop die geld ontvang is.",
    en: "Give the date the money was received.",
  },
  fb_verwysing_kort: {
    af: "Gee die verwysing soos dit op die bankstaat lees.",
    en: "Give the reference as it reads on the bank statement.",
  },
  fb_bevestig: { af: "Teken die betaling aan", en: "Record the payment" },
  fb_fout: {
    af: "Kon nie die betaling aanteken nie.",
    en: "The payment could not be recorded.",
  },

  fu_reik_uit: { af: "Reik uit", en: "Issue" },
  fu_vra_kop: { af: "Reik hierdie faktuur uit?", en: "Issue this invoice?" },
  fu_vra_teks: {
    af: "Die volgende nommer word toegeken en die verdeling vries op wat nou op die skerm staan. Daarna kan die faktuur nie meer gewysig word nie — net gekanselleer.",
    en: "The next number will be allocated and the split freezes on what is now on screen. After that the invoice can no longer be edited — only cancelled.",
  },
  // GEEN OORSAAK GENOEM NIE. Die teks het "'n Koepon" gese ongeag hoe die
  // totaal op nul gekom het -- 'n koepon, die Afslag-veld, of 'n ry van R0.
  // Wat volg, is in al drie gevalle presies dieselfde, en die syfer self is
  // die enigste feit wat saak maak.
  fu_vra_teks_gratis: {
    af: "Die totaal is R0. Paystack word glad nie geroep nie en die faktuur gaan dadelik na Betaal. Daar is niks om te verdeel nie.",
    en: "The total is R0. Paystack is not called at all and the invoice goes straight to Paid. There is nothing to split.",
  },
  fu_terug: { af: "Terug", en: "Back" },

  // -- Die proforma het nie uitgegaan nie -------------------------------
  // stuur-faktuur.js gee `pos_gestuur` en `pos_fout` terug met 'n kommentaar
  // wat se die skerm moet eerlik wees oor of die pos uitgegaan het. Tot nou
  // toe het faktuur-uitreik.js albei weggegooi: 'n mens het 'n faktuur
  // uitgereik terwyl SMTP af was en niks gesien nie.
  //
  // AMBER, NIE KORAAL NIE. Die faktuur IS uitgereik, die nommer is opgebruik
  // en die betaalskakel leef -- daar is niks om te stop nie. Wat oorbly, is
  // werk: die skakel moet met die hand aangestuur word.
  fu_pos_kop: {
    af: "Die proforma het nie uitgegaan nie",
    en: "The proforma did not go out",
  },
  fu_pos_teks: {
    af: "Die faktuur is uitgereik en die betaalskakel werk. Stuur die skakel hieronder self aan die kli\u00ebnt.",
    en: "The invoice has been issued and the payment link works. Send the link below to the client yourself.",
  },
  fu_besig: { af: "Besig …", en: "Working …" },
  fu_aan: { af: "Gefaktureer aan", en: "Billed to" },
  fu_proforma_aan: { af: "Proforma gaan aan", en: "Proforma goes to" },
  fu_totaal: { af: "Totaal verskuldig", en: "Total due" },
  fu_deur_paystack: { af: "Uitbetaal deur Paystack", en: "Paid out by Paystack" },
  // Die belangrikste reël op die skerm: 'n ontvanger sonder 'n subrekening
  // kan nie deur Paystack betaal word nie, en sonder hierdie getal lyk dit of
  // almal outomaties betaal word.
  fu_met_hand: { af: "Met die hand oorbetaal", en: "Paid over by hand" },
  fu_ontvanger_een: { af: "1 ontvanger", en: "1 recipient" },
  fu_ontvangers: { af: "ontvangers", en: "recipients" },
  fu_geen_skakel: {
    af: "Geen — die faktuur is klaar betaal",
    en: "None — the invoice is already paid",
  },

  fu_geen_epos_kop: {
    af: "Hierdie kliënt het nog geen e-posadres nie",
    en: "This client has no email address yet",
  },
  fu_geen_epos_teks: {
    af: "Die proforma het dus nêrens om heen te gaan nie. Voeg dit hier by — die faktuur bly staan en die adres word by die kliënt se rekord gestoor.",
    en: "The proforma therefore has nowhere to go. Add it here — the invoice stays as it is and the address is stored on the client's record.",
  },
  fu_epos_etiket: { af: "E-posadres", en: "Email address" },
  fu_epos_ongeldig: {
    af: "Dit lyk nie soos 'n e-posadres nie.",
    en: "That does not look like an email address.",
  },
  fu_epos_stoor_fout: {
    af: "Kon nie die adres stoor nie. Probeer weer.",
    en: "The address could not be saved. Try again.",
  },
  fu_klient_weg: {
    af: "Kon nie die kliënt se rekord vind nie.",
    en: "The client's record could not be found.",
  },
  fu_stoor_gaan_voort: { af: "Stoor en gaan voort", en: "Save and continue" },

  fu_fout_kop: { af: "Kon nie die faktuur uitreik nie", en: "The invoice could not be issued" },
  fu_fout_konsep: { af: "Die faktuur bly 'n konsep.", en: "The invoice remains a draft." },
  fu_fout_nommer: {
    af: "Niks is verlore nie en die nommer is nie opgebruik nie — die volgende poging kry dieselfde een.",
    en: "Nothing is lost and the number has not been used — the next attempt gets the same one.",
  },
  fu_probeer_weer: { af: "Probeer weer", en: "Try again" },

  fu_betaalskakel: { af: "Betaalskakel", en: "Payment link" },
  fu_betaal: { af: "betaal", en: "paid" },
  fu_gratis_teks: {
    af: "Die bedrag was nul, dus is Paystack nie geroep nie. Die faktuur is aangeteken as betaal en daar is niks om te verdeel nie.",
    en: "The amount was zero, so Paystack was not called. The invoice is recorded as paid and there is nothing to split.",
  },
  fu_kopieer: { af: "Kopieer", en: "Copy" },
  fu_gekopieer: { af: "Gekopieer", en: "Copied" },
  fu_deel: { af: "Deel", en: "Share" },

  // ── Instellings: die maatskappy se kop en die bankbesonderhede ───────
  //
  // Hulle leef as 'n INSTELLING en nie in die sjabloon nie. Tot 16 Augustus
  // het die kop in faktuur.html gestaan en die bankblok in faktuur-vorm.js —
  // twee plekke, vasgespyker, en 'n adreswysiging sou een van hulle mis.
  fp_nav_instellings: { af: "Instellings", en: "Settings" },

  // ═══ DIE KWOTASIE ═══════════════════════════════════════════════════════
  //
  // 'n Kwotasie is 'n AANBOD, nie 'n faktuur nie. Die woorde hieronder moet
  // dit dra: nooit "verskuldig", nooit "betaalbaar", nooit "verwagte
  // inkomste". Niks is verskuldig voordat dit aanvaar is nie.
  //
  // DIE STANDE IS EIE WOORDE, NIE DIE FAKTUUR S'N NIE. Sien _kwotasies.js:
  // kry-staat.js en kry-joernaal.js filtreer albei op `stand === "gestuur"`,
  // dus mag 'n kwotasie daardie woord nooit dra nie. "Uitgereik" is die
  // kwotasie s'n; "Gestuur" bly die faktuur s'n.

  // ── Die register ──
  fp_nav_kwotasies: { af: "Kwotasies", en: "Quotations" },
  fp_kwotasies_titel: { af: "Kwotasies", en: "Quotations" },
  fp_nuwe_kwotasie: { af: "+ Nuwe kwotasie", en: "+ New quotation" },
  fp_geen_kwotasies: { af: "Daar is nog geen kwotasies nie.", en: "There are no quotations yet." },
  fp_kwotasies_laai_fout: {
    af: "Kon nie die kwotasies laai nie. Probeer weer.",
    en: "The quotations could not be loaded. Please try again.",
  },
  fp_kwotasie_een: { af: "kwotasie", en: "quotation" },
  fp_kwotasie_baie: { af: "kwotasies", en: "quotations" },

  // DIE WERKSYFER. Wat Future Sharp aangebied het en waaraan dit nog gebonde
  // is. NIE "verwagte inkomste" NIE — dit staan eers op die staat wanneer 'n
  // faktuur uitgereik is, en 'n aanbod bind die kliënt aan niks.
  fp_kw_blootstelling: { af: "Uitgereik en nog geldig", en: "Issued and still valid" },

  fp_kw_stand_konsep: { af: "Konsep", en: "Draft" },
  fp_kw_stand_uitgereik: { af: "Uitgereik", en: "Issued" },
  fp_kw_stand_aanvaar: { af: "Aanvaar", en: "Accepted" },
  fp_kw_stand_verwerp: { af: "Verwerp", en: "Declined" },
  // Word BEREKEN uit geldig_tot en nooit gestoor nie. Sien is_verval().
  fp_kw_stand_verval: { af: "Verval", en: "Expired" },

  fp_kw_geldig_tot: { af: "geldig tot", en: "valid until" },
  fp_kw_verval_op: { af: "verval", en: "expired" },
  fp_kw_aanvaar_op: { af: "aanvaar", en: "accepted" },
  fp_kw_verwerp_op: { af: "verwerp", en: "declined" },
  fp_kw_hersiening: { af: "hersiening", en: "revision" },
  fp_kw_skrap_fout: { af: "Kon nie die kwotasie skrap nie.", en: "The quotation could not be deleted." },

  // ── Die vorm ──
  fv_kw_uitreik: { af: "Reik kwotasie uit", en: "Issue quotation" },
  fv_kw_hersien: { af: "Hersien", en: "Revise" },

  // DIE HERSIENINGSMODUS. Die band se twee getalle word in faktuur-vorm.js
  // ingevul: {nuut} is die aanbod wat gemaak word, {oud} is die een wat die
  // klient op hierdie oomblik nog sien.
  fv_kw_hersien_band: {
    af: "Hersiening {nuut} in wording \u2014 die kli\u00ebnt sien nog hersiening {oud}",
    en: "Revision {nuut} in progress \u2014 the client still sees revision {oud}",
  },
  fv_kw_hersien_uit: { af: "Reik hersiening uit", en: "Issue revision" },
  fv_kw_hersien_bevestig: {
    af: "Bevestig \u2014 stuur aan die kli\u00ebnt",
    en: "Confirm \u2014 send to the client",
  },
  fv_kw_hersien_vaar: { af: "Laat vaar", en: "Discard" },
  fv_kw_stuur_weer: { af: "Stuur weer", en: "Send again" },
  fv_kw_geldigheid: { af: "Geldigheid", en: "Validity" },
  fv_kw_geldig_tot: { af: "Geldig tot", en: "Valid until" },
  fv_kw_geldig_wenk: {
    af: "Verstek 30 dae vanaf die huidige hersiening. Ná hierdie datum weier die aanvaarknoppie.",
    en: "Defaults to 30 days from the current revision. After this date the accept button refuses.",
  },
  fv_kw_hersienings: { af: "Hersienings", en: "Revisions" },
  fv_kw_hersienings_lei: { af: "dieselfde nommer, dieselfde skakel", en: "same number, same link" },
  fv_kw_huidig: { af: "huidig", en: "current" },
  fv_kw_vervang: { af: "vervang", en: "replaced" },
  fv_kw_hersien_wenk: {
    af: "Die skakel wys altyd die huidige hersiening. 'n Vervangde aanbod kan nie aanvaar word nie.",
    en: "The link always shows the current revision. A replaced offer cannot be accepted.",
  },
  fv_kw_verdeling_kop: { af: "Verdeling van die kwotasietotaal", en: "Distribution of the quotation total" },
  fv_kw_totaal: { af: "Kwotasietotaal", en: "Quotation total" },
  fv_kw_skakel: { af: "Skakel vir die kliënt", en: "Link for the client" },
  fv_kw_skakel_kopieer: { af: "Kopieer skakel", en: "Copy link" },
  fv_kw_verwerp: { af: "Merk as verwerp", en: "Mark as declined" },
  fv_kw_verwerp_rede: { af: "Rede (opsioneel)", en: "Reason (optional)" },
  fv_kw_uitgereik_ok: { af: "Kwotasie uitgereik en gestuur.", en: "Quotation issued and sent." },
  fv_kw_hersien_ok: { af: "Hersiening uitgereik en gestuur.", en: "Revision issued and sent." },
  fv_kw_geen_epos: {
    af: "Hierdie kliënt het nog geen e-posadres nie, en die kwotasie het dus nêrens om heen te gaan nie.",
    en: "This client has no email address yet, so the quotation has nowhere to go.",
  },

  // ── Die dokument ──
  //
  // Die kliënt se woorde. Hulle loop deur t_in(sleutel, kwotasie.taal) — die
  // KWOTASIE se eie taal, nooit die platform s'n.
  fd_kwotasie: { af: "Kwotasie", en: "Quotation" },
  fd_gekwoteer_aan: { af: "Gekwoteer aan", en: "Quoted to" },
  fd_geldig_tot: { af: "Geldig tot", en: "Valid until" },
  // NIE "Totaal verskuldig" NIE. Niks is verskuldig voordat die kwotasie
  // aanvaar is nie, en die faktuur wat daaruit kom, dra wél die ander woord.
  fd_totaal: { af: "Totaal", en: "Total" },
  fd_kw_hersiening: { af: "Hersiening", en: "Revision" },
  // Die geldigheidsblok se twee reels. Die DATUM word in faktuur-vorm.js
  // aangeplak, want sy formatering hang van die dokument se taal af.
  // Die bevestigingsblok voor uitreiking. Op 'n faktuur gaan die PROFORMA aan;
  // op 'n kwotasie gaan die kwotasie self aan -- daar is geen proforma nie.
  fu_kw_gaan_aan: { af: "Kwotasie gaan aan", en: "Quotation goes to" },

  // Die woord voor die registrasienommer op 'n dokument. Die faktuur se PDF
  // druk hom saam met die adres; die publieke kwotasiebladsy het hom nodig as
  // 'n eie sleutel omdat sy die kop self bou.
  fd_reg_nr: { af: "Registrasienommer", en: "Registration number" },

  // Die twee velde op die publieke aanvaarblok. Kort en sonder verwyt: 'n
  // klient wat 'n veld oorslaan, het nie 'n fout gemaak nie.
  kw_naam_kort: { af: "Gee die naam van die persoon wat aanvaar.", en: "Enter the name of the person accepting." },
  kw_epos_kort: { af: "Gee 'n geldige e-posadres.", en: "Enter a valid email address." },

  fd_kw_geldig_kop: {
    af: "Hierdie kwotasie is geldig tot",
    en: "This quotation is valid until",
  },
  fd_kw_geldig_lei: {
    af: "By aanvaarding word 'n faktuur uitgereik en die betaalopsies verskyn onmiddellik.",
    en: "On acceptance an invoice is issued and the payment options appear immediately.",
  },
  fd_kw_uit_kwotasie: { af: "Uit kwotasie", en: "From quotation" },

  // ── Die publieke bladsy ──
  kw_aanvaar_kop: { af: "Aanvaar hierdie kwotasie", en: "Accept this quotation" },
  kw_aanvaar_lei: {
    af: "Voltooi die besonderhede hieronder. 'n Faktuur word onmiddellik uitgereik en per e-pos gestuur, met albei betaalopsies daarop.",
    en: "Complete the details below. An invoice is issued immediately and emailed to you, with both payment options on it.",
  },
  kw_naam: { af: "Naam en van", en: "Full name" },
  kw_naam_plek: { af: "Wie aanvaar hierdie kwotasie", en: "Who is accepting this quotation" },
  kw_epos: { af: "E-posadres", en: "Email address" },
  kw_epos_plek: { af: "Waarheen die faktuur gestuur word", en: "Where the invoice will be sent" },
  kw_bestelnommer_plek: { af: "Kan later verskaf word", en: "Can be provided later" },
  kw_aanvaar_knop: { af: "Aanvaar kwotasie", en: "Accept quotation" },
  kw_aanvaar_besig: { af: "Faktuur word uitgereik ...", en: "Issuing the invoice ..." },
  kw_laai_af: { af: "Laai af as PDF", en: "Download as PDF" },

  // DIE AANPASSING GAAN BUITE DIE STELSEL. Geen wysigingsvorm op die publieke
  // bladsy: wat 'n kliënt daarin sou tik, is nooit 'n instruksie wat
  // uitgevoer kan word nie — dit is die begin van 'n gesprek wat in elk geval
  // gevoer moet word. En geen verwerp-knoppie: 'n kliënt wat wil onderhandel,
  // sou 'n knoppie sien wat die gesprek toemaak, en hom klik omdat dit die
  // naaste is aan "nee, nie so nie".
  kw_kontak_lei: { af: "Vrae of 'n aanpassing? E-pos ons by", en: "Questions or an adjustment? Email us at" },

  kw_verval_kop: { af: "Hierdie kwotasie het verval", en: "This quotation has expired" },
  kw_verval_lei: {
    af: "Die geldigheidsdatum is verby. Skakel ons en ons stuur 'n bygewerkte kwotasie.",
    en: "The validity date has passed. Contact us and we will send an updated quotation.",
  },
  kw_aanvaar_klaar_kop: { af: "Hierdie kwotasie is aanvaar", en: "This quotation has been accepted" },
  kw_aanvaar_klaar_lei: {
    af: "'n Faktuur is uitgereik en per e-pos gestuur.",
    en: "An invoice has been issued and emailed.",
  },
  kw_aanvaar_fout: {
    af: "Die kwotasie kon nie aanvaar word nie. Skakel ons en ons help dadelik.",
    en: "The quotation could not be accepted. Contact us and we will help right away.",
  },

  // DIE TERM WAT 'N REKENMEESTER VERWAG, NIE 'N BESKRYWING VAN DIE VELD NIE.
  //
  // Die toets: sou hierdie woord op 'n bankstaat, 'n grootboek of 'n staat
  // verskyn? So nie, is dit die verkeerde woord. "Die maatskappy" beskryf;
  // "Maatskappybesonderhede" benoem. Hierdie skerms word gelees deur mense wie
  // se werk versoening is, en 'n term wat hulle nie herken nie, laat hulle
  // wonder of die stelsel weet wat dit doen.
  //
  // Die leidings onder die opskrifte het weggeval. 'n Sin wat verduidelik
  // hoekom die vorige reël waar is, verdun; die opskrif dra dit reeds.
  in_maatskappy_kop: { af: "Maatskappybesonderhede", en: "Company details" },
  in_naam: { af: "Geregistreerde naam", en: "Registered name" },
  in_reg: { af: "Registrasienommer", en: "Registration number" },
  in_adres: { af: "Geregistreerde adres", en: "Registered address" },
  in_adres_fyn: { af: "Word gedruk soos dit hier staan.", en: "Printed exactly as entered here." },
  in_epos: { af: "Rekeningkundige e-posadres", en: "Accounts email address" },

  in_bank_kop: { af: "Bankbesonderhede", en: "Bank details" },
  in_bank: { af: "Bank", en: "Bank" },
  // Nie "Rekeningnaam" nie. Die bank se eie term is die rekeninghouer, en 'n
  // betaling na 'n houer wat nie klop nie, word teruggestuur.
  in_rekeningnaam: { af: "Rekeninghouer", en: "Account holder" },
  in_rekeningnaam_fyn: {
    af: "Soos dit by die bank geregistreer is. Kan van die geregistreerde naam verskil.",
    en: "As registered with the bank. May differ from the registered name.",
  },
  in_rekeningnommer: { af: "Rekeningnommer", en: "Account number" },
  in_takkode: { af: "Takkode", en: "Branch code" },
  in_rekeningtipe: { af: "Rekeningtipe", en: "Account type" },

  in_stoor: { af: "Stoor", en: "Save" },
  in_voorskou: { af: "Voorskou", en: "Preview" },
  // 'n Leë veld wys hierdie woord in koraal. 'n Leë plek in 'n grys blok lyk
  // soos 'n ontwerpkeuse; op 'n werklike faktuur is dit 'n gat.
  in_ontbreek: { af: "ontbreek", en: "missing" },
  in_laai_fout: {
    af: "Kon nie die instellings laai nie.",
    en: "The settings could not be loaded.",
  },
  in_stoor_fout: {
    af: "Kon nie stoor nie — probeer weer",
    en: "Could not save — try again",
  },

  // DIT KEER NIKS. 'n Faktuur met 'n betaalskakel werk sonder
  // bankbesonderhede; die skakel is die hoofpad. Maar die besonderhede druk
  // STILWEG as strepies, en 'n mens sien dit eers op 'n dokument wat reeds by
  // 'n kliënt is.
  in_bank_waarsku: {
    af: "Die bankbesonderhede ontbreek — hulle druk as strepies op elke faktuur.",
    en: "The bank details are missing — they print as dashes on every invoice.",
  },
  in_bank_gaan: { af: "Vul hulle in", en: "Fill them in" },

  // ── die foonaansig se opsomming ─────────────────────────────────────
  //
  // Nie 'n verkleinde backoffice nie — die getalle wat 'n mens moet weet
  // voordat hy stuur. Om hulle te VERANDER verg 'n groter skerm, en fo_nota
  // sê dit uitdruklik. 'n Knoppie wat niks doen nie, is 'n leuen.
  fo_kop: { af: "Verdeling — opgestel", en: "Split — set up" },
  fo_totaal: { af: "Faktuurtotaal", en: "Invoice total" },
  fo_fooi: { af: "Transaksiefooi", en: "Transaction fee" },
  fo_verdeelbaar: { af: "Verdeelbaar", en: "Distributable" },
  fo_uitbetaal: { af: "Word uitbetaal", en: "Paid out" },
  fo_deur_paystack: { af: "deur Paystack", en: "by Paystack" },
  // Die belangrikste reël op die kaart: 'n ontvanger sonder 'n subrekening
  // word nie deur Paystack betaal nie, en iemand moet dit later self doen.
  fo_met_hand: { af: "met die hand", en: "by hand" },
  fo_ontvanger_een: { af: "1 ontvanger", en: "1 recipient" },
  fo_ontvangers: { af: "ontvangers", en: "recipients" },
  fo_bly_hoof: { af: "Bly in die hoofrekening", en: "Stays in the main account" },
  fo_hosting: { af: "Hosting", en: "Hosting" },
  fo_begroot: { af: "Begroot uit die hoofrekening", en: "Budgeted from the main account" },
  fo_bly_oor: { af: "Bly oor vir Future Sharp", en: "Left for Future Sharp" },

  // GEEN MERKIE BY 'N NORMALE FAKTUUR. Een wat altyd daar is, word nie meer
  // gelees nie — en dan sien 'n mens die koraal een ook nie.
  fo_tekort: { af: "Tekort", en: "Shortfall" },
  fo_waarsku: {
    af: "Die verdeling vra meer as wat die faktuur inbring. Paystack sou dit weier — die faktuur kan nie so uitgereik word nie.",
    en: "The split asks for more than the invoice brings in. Paystack would refuse it — the invoice cannot be issued like this.",
  },
  // 'n Mislukte berekening moet dit SÊ. Bly die kaart stil met ou syfers
  // staan, is 'n afwesige merkie dubbelsinnig — beteken hy "alles is reg" of
  // "niks het geloop nie"?
  fo_fout_merk: { af: "Fout", en: "Error" },
  fo_fout: {
    af: "Die syfers kon nie gereken word nie. Maak die faktuur op 'n groter skerm oop om te sien wat fout is.",
    en: "The figures could not be calculated. Open the invoice on a larger screen to see what is wrong.",
  },
  fo_nota: {
    af: "Om die begroting of die verdeling te verander, is 'n groter skerm nodig.",
    en: "Changing the budget or the split requires a larger screen.",
  },

  // ── Die publieke kliëntvorm (klientvorm.html) ───────────────────────────
  // 'n Staande skakel wat aan enige kliënt gaan, dus dra die bladsy sy eie
  // taalskakelaar. Sien klientvorm.js: hy herlaai NIE, want 'n herlaai
  // halfpad deur 'n vorm gooi weg wat iemand reeds getik het.
  kv_bladsy_titel: { af: "Future Sharp — Kliëntbesonderhede", en: "Future Sharp — Client details" },
  kv_kop: { af: "Jou besonderhede", en: "Your details" },
  kv_inleiding: {
    af: "Voltooi die vorm sodat ons jou faktuur korrek kan opstel.",
    en: "Complete the form so that we can make out your invoice correctly.",
  },
  kv_soort_instansie: { af: "Instansie", en: "Institution" },
  kv_soort_privaat: { af: "Privaat", en: "Private" },
  kv_soort_hulp_instansie: {
    af: "'n Skool, departement of maatskappy wat in sy eie naam betaal.",
    en: "A school, department or company paying in its own name.",
  },
  kv_soort_hulp_privaat: {
    af: "Jy betaal in jou eie naam.",
    en: "You are paying in your own name.",
  },
  kv_naam_instansie: { af: "Naam van die instansie", en: "Name of the institution" },
  kv_naam_privaat: { af: "Naam en van", en: "Full name" },
  kv_kontak: { af: "Kontakpersoon", en: "Contact person" },
  kv_kontak_hulp: {
    af: "Die persoon by wie ons navraag doen.",
    en: "The person we contact with any queries.",
  },
  kv_epos: { af: "E-pos", en: "Email" },
  kv_selfoon: { af: "Selfoon", en: "Mobile" },
  kv_adres: { af: "Adres", en: "Address" },
  kv_adres_hulp: {
    af: "Verskyn op die faktuur presies soos dit hier staan.",
    en: "Appears on the invoice exactly as entered here.",
  },
  kv_opsioneel: { af: "— opsioneel", en: "— optional" },
  kv_pot_etiket: { af: "Laat hierdie veld leeg", en: "Leave this field empty" },
  kv_stuur: { af: "Stuur besonderhede", en: "Send details" },
  kv_stuur_besig: { af: "Stuur tans …", en: "Sending …" },
  kv_fout_naam: { af: "Vul die naam in.", en: "Enter the name." },
  kv_fout_epos: { af: "Vul 'n geldige e-posadres in.", en: "Enter a valid email address." },
  kv_fout_stuur: { af: "Kon nie stuur nie. Probeer weer.", en: "Could not send. Please try again." },
  kv_fout_baie: {
    af: "Te veel indienings uit hierdie netwerk. Probeer later weer.",
    en: "Too many submissions from this network. Please try again later.",
  },
  kv_dankie_kop: { af: "Dankie — ons het dit ontvang", en: "Thank you — we have received it" },
  kv_dankie_teks: {
    af: "Jou besonderhede is deurgestuur. Ons neem kontak op sodra die faktuur gereed is.",
    en: "Your details have been sent. We will be in touch as soon as the invoice is ready.",
  },
  kv_navrae: { af: "Navrae", en: "Queries" },
  kv_voet_reg: { af: "Reg. nr.", en: "Reg. no." },

  // ── Die staat (faktuurpaneel-staat.js) ─────────────────────────────────
  // Drie soorte geld, en die werklys wat PER BEGUNSTIGDE groepeer: 'n mens
  // betaal 'n persoon, nie 'n faktuur nie.
  st_kop_uitbetaal: { af: "Reeds uitbetaal", en: "Already paid out" },
  st_nota_uitbetaal: {
    af: "Deur Paystack by vereffening, of met die hand afgemerk.",
    en: "By Paystack at settlement, or marked off by hand.",
  },
  st_kop_uitstaande: { af: "Moet nog uitbetaal word", en: "Still to be paid out" },
  st_nota_uitstaande: {
    af: "In die hoofrekening, met iemand anders se naam daarop.",
    en: "In the main account, with someone else's name on it.",
  },
  st_kop_verwag: { af: "Verwagte inkomste", en: "Expected income" },
  st_nota_verwag: {
    af: "Uitgereik en nog nie betaal nie. Nog niemand se geld nie.",
    en: "Issued and not yet paid. Nobody's money yet.",
  },
  st_verduidelik: {
    af: "Elke syfer word by elke oopmaak uit die fakture herbereken en nooit gestoor nie. Die bedrae kom uit elke faktuur se gevriesde verdeling en word nooit oorgetik nie.",
    en: "Every figure is recalculated from the invoices each time this page opens and is never stored. The amounts come from each invoice's frozen split and are never typed over.",
  },
  // ── Die inkomste- en uitgawestaat ──
  fs_titel: { af: "Inkomste en uitgawes", en: "Income and expenses" },
  fs_hulp: {
    af: "Kontantbasis. 'n Faktuur tel op die dag dat die geld ontvang is, nie op die dag van uitreiking nie. Die finansi\u00eble jaar loop 1 Maart tot 28 Februarie.",
    en: "Cash basis. An invoice counts on the day the money was received, not the day it was issued. The financial year runs 1 March to 28 February.",
  },
  fs_van: { af: "Van", en: "From" },
  fs_tot: { af: "Tot", en: "To" },
  fs_wys: { af: "Wys", en: "Show" },
  fs_uitvoer: { af: "Voer uit", en: "Export" },
  fs_inkomste: { af: "Inkomste", en: "Income" },
  fs_uitgawes: { af: "Uitgawes", en: "Expenses" },
  fs_tot_in: { af: "Totale inkomste", en: "Total income" },
  fs_tot_uit: { af: "Totale uitgawes", en: "Total expenses" },
  fs_oorskot: { af: "Oorskot vir die tydperk", en: "Surplus for the period" },
  fs_ongekat: { af: "Ongekategoriseer", en: "Uncategorised" },
  fs_hosting_kop: { af: "Word die hosting gedek?", en: "Is the hosting covered?" },
  fs_hosting_uit: {
    af: "Uitgawes gemerk \u201cgedek deur hosting\u201d",
    en: "Expenses marked \u201ccovered by hosting\u201d",
  },
  fs_hosting_hulp: {
    af: "Uitgawes wat as \u201cgedek deur hosting\u201d gemerk is, teenoor wat hosting ingebring het. Uitgawes wat iemand uit sy eie sak gedra het sonder om te eis, is nie hierin nie.",
    en: "Expenses marked \u201ccovered by hosting\u201d, against what hosting brought in. Expenses someone carried out of pocket without claiming are not included.",
  },
  fs_bank_kop: { af: "Klop dit teen die bank?", en: "Does it match the bank?" },
  fs_bank_leeg: {
    af: "Tik die bankbalans op twee dae in \u2014 die dag voor die tydperk begin, en die laaste dag. Dan wys hierdie blok of die staat volledig is.",
    en: "Enter the bank balance on two days \u2014 the day before the period starts, and the last day. Then this block shows whether the statement is complete.",
  },
  fs_bank_datum: { af: "Datum", en: "Date" },
  fs_bank_bedrag: { af: "Bankbalans op daardie dag", en: "Bank balance on that day" },
  fs_bank_stoor: { af: "Teken aan", en: "Record" },
  fs_bank_open: { af: "Bankbalans op", en: "Bank balance on" },
  fs_bank_sluit: { af: "Bankbalans op", en: "Bank balance on" },
  fs_bank_beweeg: { af: "Inkomste min uitgawes", en: "Income less expenses" },
  fs_bank_verwag: { af: "Behoort te wees", en: "Should be" },
  fs_bank_verskil: { af: "Verskil", en: "Difference" },
  fs_bank_klop: {
    af: "Die tydperk is volledig \u2014 elke sent in die bank het 'n inskrywing.",
    en: "The period is complete \u2014 every cent in the bank has an entry.",
  },
  fs_bank_verskil_hulp: {
    af: "Daar ontbreek inskrywings vir hierdie verskil, of 'n vereffening val buite die tydperk. Paystack vereffen in bondels.",
    en: "Entries are missing for this difference, or a settlement falls outside the period. Paystack settles in batches.",
  },
  fs_wag_kop: { af: "Wag vir 'n kategorie", en: "Waiting for a category" },
  fs_wag_hulp: {
    af: "Beskrywings wat nie by 'n item in die register pas nie. Die bedrae staan hierbo as Ongekategoriseer \u2014 hulle verdwyn nooit.",
    en: "Descriptions that do not match an item in the register. The amounts appear above as Uncategorised \u2014 they never disappear.",
  },
  fs_laai_fout: { af: "Kon nie die staat laai nie.", en: "Could not load the statement." },

  st_werk_titel: {
    af: "Begunstigdes wat uit die hoofrekening betaal moet word",
    en: "Beneficiaries to be paid from the main account",
  },
  st_werk_hulp: {
    af: "Een oorbetaling per begunstigde, met een bankverwysing.",
    en: "One transfer per beneficiary, with one bank reference.",
  },
  st_werk_leeg: { af: "Niks staan uit nie.", en: "Nothing outstanding." },
  st_klaar_titel: {
    af: "Begunstigdes wat reeds betaling ontvang het",
    en: "Beneficiaries who have already been paid",
  },
  st_klaar_leeg: { af: "Nog niemand is uitbetaal nie.", en: "Nobody has been paid out yet." },
  st_klaar_hulp: { af: "Nuutste eerste.", en: "Most recent first." },
  st_verwag_titel: { af: "Onbetaalde fakture", en: "Unpaid invoices" },
  st_verwag_hulp: {
    af: "Uitgereik en nog onbetaal. 'n Betaalskakel verval nie.",
    en: "Issued and still unpaid. A payment link does not expire.",
  },
  st_verwag_leeg: { af: "Geen onbetaalde faktuur nie.", en: "No unpaid invoices." },
  st_merk_almal: { af: "Merk almal", en: "Select all" },
  st_merk_geen: { af: "Merk niks", en: "Select none" },
  st_datum: { af: "Datum van die oorbetaling", en: "Date of the transfer" },
  st_verwysing: { af: "Bankverwysing", en: "Bank reference" },
  st_verwysing_plek: { af: "Soos dit in die bankstaat staan", en: "As it appears on the bank statement" },
  st_som_voor: { af: "Word afgemerk:", en: "Will be marked off:" },
  st_niks_gekies: {
    af: "Kies watter rye hierdie oorbetaling dek.",
    en: "Select which rows this transfer covers.",
  },
  st_merk: { af: "Merk as betaal", en: "Mark as paid" },
  st_fout_verwysing: { af: "Vul die bankverwysing in.", en: "Enter the bank reference." },
  st_fout_merk: { af: "Kon nie afmerk nie. Probeer weer.", en: "Could not mark off. Please try again." },
  st_laai_fout: { af: "Kon nie die staat laai nie.", en: "Could not load the statement." },
  st_direk: { af: "Direk deur Paystack", en: "Directly by Paystack" },
  st_met_hand: { af: "Met die hand", en: "By hand" },
  st_uitgereik: { af: "uitgereik", en: "issued" },
  st_betaalbaar: { af: "betaalbaar teen", en: "payable by" },
  st_verw_kort: { af: "verwysing", en: "reference" },
  st_begunstigde: { af: "begunstigde", en: "beneficiary" },
  st_begunstigdes: { af: "begunstigdes", en: "beneficiaries" },
  st_ry: { af: "ry", en: "row" },
  st_rye: { af: "rye", en: "rows" },
  st_faktuur: { af: "faktuur", en: "invoice" },
  st_fakture: { af: "fakture", en: "invoices" },
  st_inskrywing: { af: "inskrywing", en: "entry" },
  st_inskrywings: { af: "inskrywings", en: "entries" },

  // ── Die register van werk en uitgawes (faktuurpaneel-werk.js) ──────────
  // Twee soorte, een register. Die toets is of iemand geld UITGEHAAL het:
  // ja, dan is dit 'n uitgawe wat presies terugkom; nee, hy het gewerk.
  wi_titel: { af: "Werk en uitgawes", en: "Work and expenses" },
  wi_kategorie: { af: "Kategorie", en: "Category" },
  wi_kategorie_hulp: {
    af: "Waaronder hierdie item op die staat val. Die staat pas 'n faktuur se re\u00eblbeskrywing teen hierdie naam.",
    en: "Where this item falls on the statement. The statement matches an invoice line's description against this name.",
  },
  wi_kat_geen: { af: "\u2014 geen kategorie \u2014", en: "\u2014 no category \u2014" },

  // ── Die register van finansiele kategoriee ──
  //
  // NIE die winkel se produkkategoriee nie. Die woord "kategorie" dra twee
  // betekenisse in hierdie stelsel, en die "kt_"-voorvoegsel hou hulle uit
  // mekaar: kt_ is finansieel, kat_ is die winkel s'n.
  kt_titel: { af: "Kategorie\u00eb", en: "Categories" },
  kt_nuwe_knop: { af: "+ Nuwe kategorie", en: "+ New category" },
  kt_nuwe_titel: { af: "Nuwe kategorie", en: "New category" },
  kt_wysig_titel: { af: "Wysig kategorie", en: "Edit category" },
  kt_lei: {
    af: "'n Kategorie word nooit uitgevee nie. Is sy verkeerd, word sy onder die regte een gesit \u2014 dan bly 'n ou staat lees soos hy gelees het.",
    en: "A category is never deleted. If it is wrong, it is placed under the right one \u2014 then an old statement still reads as it read.",
  },
  kt_in: { af: "Inkomste", en: "Income" },
  kt_uit: { af: "Uitgawe", en: "Expense" },
  kt_rigting_hulp: {
    af: "Bankkoste is nooit inkomste nie. Die rigting keer dat 'n bedrag aan die verkeerde kant van die staat beland.",
    en: "Bank charges are never income. The direction stops an amount landing on the wrong side of the statement.",
  },
  kt_veld_naam: { af: "Naam", en: "Name" },
  kt_veld_onder: { af: "Val onder", en: "Falls under" },
  kt_geen_ouer: { af: "\u2014 hoofkategorie \u2014", en: "\u2014 main category \u2014" },
  kt_onder_hulp: {
    af: "Laat leeg vir 'n hoofkategorie. 'n Kategorie mag self inskrywings dra \u00e9n subkategorie\u00eb h\u00ea.",
    en: "Leave empty for a main category. A category may carry entries of its own and have subcategories.",
  },
  kt_hosting: { af: "Word deur hosting gedek", en: "Covered by hosting" },
  kt_hosting_kort: { af: "Hosting", en: "Hosting" },
  kt_hosting_hulp: {
    af: "Die staat tel op wat hier gemerk is en vergelyk dit met die hosting wat ingesamel is. So sien 'n mens of die persentasie reg is.",
    en: "The statement totals what is marked here and compares it with the hosting collected. That is how you see whether the percentage is right.",
  },
  kt_veld_nota: { af: "Aantekening", en: "Note" },
  kt_opsioneel: { af: "\u2014 opsioneel", en: "\u2014 optional" },
  kt_nota_hulp: {
    af: "Vir die boekhouer. Verskyn langs die kategorie in die register.",
    en: "For the bookkeeper. Appears beside the category in the register.",
  },
  kt_vas: { af: "Stelsel", en: "System" },
  kt_toets: { af: "Toets", en: "Test" },
  kt_vas_hulp: {
    af: "Hierdie kategorie word deur die stelsel geskryf. Haar naam en rigting bly; sy mag wel onder 'n ander een gesit word.",
    en: "This category is written by the system. Its name and direction stay; it may however be placed under another one.",
  },
  kt_naam_kort: { af: "Die naam is verpligtend.", en: "The name is required." },
  kt_skrap: { af: "Skrap", en: "Delete" },
  kt_skrap_vra: { af: "Vee hierdie kategorie uit?", en: "Delete this category?" },
  kt_kanselleer: { af: "Kanselleer", en: "Cancel" },
  kt_stoor: { af: "Stoor", en: "Save" },
  kt_een: { af: "kategorie", en: "category" },
  kt_meer: { af: "kategorie\u00eb", en: "categories" },
  kt_leeg: {
    af: "Die register is nog leeg. Voeg die eerste kategorie by.",
    en: "The register is still empty. Add the first category.",
  },
  kt_laai_fout: { af: "Kon nie die kategorie\u00eb laai nie.", en: "Could not load the categories." },
  wi_soek_plek: { af: "Soek op naam of beskrywing", en: "Search by name or description" },
  wi_nuwe_knop: { af: "+ Nuwe item", en: "+ New item" },
  wi_kop_werk: { af: "Werk wat betaal word", en: "Work that is paid for" },
  wi_kop_uitgawe: { af: "Uitgawes wat teruggekry word", en: "Expenses that are reimbursed" },
  wi_leeg: {
    af: "Die register is nog leeg. Voeg die eerste item by.",
    en: "The register is still empty. Add the first item.",
  },
  wi_geen_pas: { af: "Geen item pas nie.", en: "No item matches." },
  // ── Skrap in die register van werk en uitgawes ──
  //
  // DIT WEIER NIKS, en dit is 'n besluit. 'n Kliënt en 'n begunstigde word met
  // 'n VERWYSING aan 'n faktuur gekoppel; 'n werk-item met TEKS. Skrap 'n mens
  // die item, bly elke bestaande faktuur presies soos sy was — net die
  // voorstellys verloor die woord.
  //
  // Die syfer staan dus IN die vraag, nie in 'n weiering nie. Sou dit weier,
  // kon 'n tikfout wat een keer op een faktuur beland het, nooit weer uit die
  // voorstellys nie — en dit is juis die tikfoute wat 'n mens wil verwyder.
  wi_skrap: { af: "Skrap", en: "Delete" },
  wi_skrap_vra: { af: "Skrap?", en: "Delete?" },
  wi_staan_op: { af: "Staan op", en: "Used on" },
  wi_faktuur: { af: "faktuur", en: "invoice" },
  wi_fakture: { af: "fakture", en: "invoices" },
  wi_konsep: { af: "konsep", en: "draft" },
  wi_konsepte: { af: "konsepte", en: "drafts" },
  wi_en: { af: "en", en: "and" },
  wi_ongebruik: { af: "Nog nêrens gebruik nie", en: "Not used anywhere yet" },
  wi_skrap_fout: { af: "Kon nie die item skrap nie.", en: "The item could not be deleted." },
  wi_laai_fout: { af: "Kon nie die register laai nie.", en: "Could not load the register." },
  wi_item: { af: "item", en: "item" },
  wi_items: { af: "items", en: "items" },
  wi_van: { af: "van", en: "of" },
  wi_afgeskakel: { af: "Afgeskakel", en: "Switched off" },
  wi_nuwe: { af: "Nuwe item", en: "New item" },
  wi_wysig: { af: "Wysig item", en: "Edit item" },
  wi_lei: {
    af: "Die item sê wat gedoen is. Wie dit kry en hoeveel, word per faktuur gestel.",
    en: "The item says what was done. Who receives it and how much is set per invoice.",
  },
  wi_soort_werk: { af: "Werk", en: "Work" },
  wi_soort_uitgawe: { af: "Uitgawe", en: "Expense" },
  wi_hulp_werk: {
    af: "Arbeid wat betaal word. Die deel is inkomste, en dit mag 'n vaste bedrag of 'n persentasie wees.",
    en: "Labour that is paid for. The share is income, and it may be a fixed amount or a percentage.",
  },
  wi_hulp_uitgawe: {
    af: "Geld wat iemand uitgehaal het en presies moet terugkry. Altyd 'n vaste bedrag.",
    en: "Money someone laid out and must get back exactly. Always a fixed amount.",
  },
  wi_veld_naam: { af: "Naam", en: "Name" },
  wi_veld_beskrywing: { af: "Beskrywing", en: "Description" },
  wi_opsioneel: { af: "— opsioneel", en: "— optional" },
  wi_beskrywing_hulp: {
    af: "Wys by die item wanneer 'n mens hom in 'n begroting kies.",
    en: "Shows beside the item when it is chosen in a budget.",
  },
  wi_aktief: { af: "Wys in die keuselys", en: "Show in the picker" },
  wi_aktief_hulp: {
    af: "'n Item word afgeskakel, nooit uitgevee nie — ou fakture verwys daarna.",
    en: "An item is switched off, never deleted — old invoices refer to it.",
  },
  wi_naam_verplig: { af: "Die naam is verplig.", en: "The name is required." },
  wi_stoor_fout: { af: "Kon nie stoor nie. Probeer weer.", en: "Could not save. Please try again." },
  wi_stoor: { af: "Stoor", en: "Save" },
  wi_kanselleer: { af: "Kanselleer", en: "Cancel" },

};

/* ═══════════════════════════════════════════════════════════════════════
   'N BEDRAG IS TAAL

   Die desimaalteken verskil: in Afrikaans is dit 'n KOMMA — R20 000,00 — en
   in Suid-Afrikaanse Engels 'n punt. Op 'n faktuur is dit nie 'n voorkeur nie;
   dit is die konvensie waarteen 'n debiteureklerk lees. Daarom hoort dit hier
   en nie in elke skerm apart nie.

   GEEN SPASIE NA DIE R. Dan is die spasie binne die getal ondubbelsinnig 'n
   duisendskeiding en niks anders nie.

   Die duisendskeiding is 'n HARDE spasie (\u00A0), sodat 'n bedrag nooit oor
   twee reels breek en soos twee getalle lyk nie.

   Die sent kom in as 'n heelgetal, want dit is hoe bedrae in die stelsel leef.
   Die taal word UITDRUKLIK deurgegee: die dokument gebruik die FAKTUUR se
   taal, die skerm die platform s'n, en die begroting bly Afrikaans. Drie
   bronne, een formateerder.
   ═══════════════════════════════════════════════════════════════════════ */
function t_rand(sent, taal) {
  const n = Math.round(Number(sent) || 0);
  const heel = Math.floor(Math.abs(n) / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  const sente = String(Math.abs(n) % 100).padStart(2, "0");
  const punt = taal === "en" ? "." : ",";
  return (n < 0 ? "-" : "") + "R" + heel + punt + sente;
}

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

// Dieselfde woordeboek, maar die taal word MEEGEGEE in plaas van uit
// localStorage gelees.
//
// t() bedien die platform: die gebruiker kies 'n taal en elke skerm volg.
// Die faktuurdokument werk anders - sy taal staan op die faktuur se eie
// rekord, want 'n skool in die Wes-Kaap en 'n departement in Gauteng kry nie
// noodwendig dieselfde een nie. Sou die dokument t() gebruik, sou dit in die
// taal druk wat toevallig in hierdie blaaier gekies is.
//
// t() bly onaangeraak. Dit loop op elke bladsy in die stelsel.
function t_in(sleutel, taal) {
  const inskrywing = WOORDEBOEK[sleutel];
  if (!inskrywing) {
    console.warn(`Geen vertaling vir sleutel "${sleutel}" nie`);
    return sleutel;
  }
  return inskrywing[taal === "en" ? "en" : "af"] || inskrywing.af;
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

// DIE WAG IS OMSTREDE OP DIE BEDIENER. _faktuur-pdf.js laai hierdie lêer om
// dieselfde woordelys as die skerm te gebruik — een bron vir die dokument se
// terme, nie 'n tweede kopie wat uit pas raak nie. In Node bestaan `document`
// nie, en die aanroep sou stort voordat een woord gelees is.
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    pas_i18n_toe();
    koppel_taal_wisselaar();
    wys_taal_wisselaar_status();
  });
}

// Node kan die woordeboek laai. t_in(sleutel, taal) is die enigste ding wat
// die bediener nodig het: hy lees nie 'n platform-taal nie, hy kry die
// faktuur se eie taal saam.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { WOORDEBOEK, t_in, t_rand };
}
