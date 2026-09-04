// netlify/functions/_kwotasies.js
//
// Die kwotasie: die sleutel, die nommer, die stande en die hersienings.
//
// DIE KWOTASIE IS NIE 'N FAKTUUR NIE. Hy is 'n AANBOD. Niks in die boeke
// hang daarvan af nie: hy verskyn nêrens op die staat nie, nêrens in die
// joernaal nie, en hy is nie betaalbaar nie. Inkomste begin by die faktuur
// se uitreiking.
//
// HY LEEF IN DIESELFDE STORE AS DIE FAKTURE, met 'n ander voorvoegsel. Dit
// is nie 'n gerief nie — dit is wat die omskakeling meganies eenvoudig maak
// en wat keer dat 'n kwotasie ooit 'n faktuurnommer opgebruik:
//
//   * _fakture.js se skep_nommer() lys met prefix "FS-". 'n KW-sleutel tel
//     dus NOOIT saam vir die faktuurreeks nie. Dieselfde beskerming wat
//     KONSEP- reeds geniet.
//   * skep_nommer() hieronder lys met prefix "KW-", en die faktuurreeks tel
//     nooit saam vir die kwotasiereeks nie.
//
// MAAR: kry-fakture.js, kry-staat.js en kry-joernaal.js doen almal 'n KALE
// store.list(). Sonder 'n filter sien hulle die kwotasies. Daardie filter
// word by elkeen van hulle bygevoeg; hierdie lêer gee die toets waarmee dit
// gedoen word (is_kwotasie_sleutel).
//
// DIE STANDE IS EIE WOORDE, NIE DIE FAKTUUR S'N NIE:
//
//   konsep     — begin, nog nie uitgereik nie; het nog geen nommer
//   uitgereik  — die aanbod staan; die kliënt kan aanvaar
//   aanvaar    — 'n faktuur is uitgereik; die kwotasie is TOE
//   verwerp    — die kliënt het gesê nee; met die hand gestel
//
// "UITGEREIK" EN NIE "GESTUUR" NIE, en dit is die belangrikste besluit in
// hierdie lêer. kry-staat.js en kry-joernaal.js filtreer albei op
// `r.stand === "gestuur"` NÁ 'n kale list(). Sou 'n kwotasie daardie woord
// dra, tel 'n blote aanbod as verwagte inkomste op die staat en as 'n
// inskrywing in die joernaal sodra êrens 'n voorvoegselfilter weggelaat
// word. Twee slotte, nie een: die voorvoegsel EN die woord.
//
// `uitgereik_op` staan reeds op die faktuurrekord, dus is die woord nie
// uitgedink nie.
//
// "VERVAL" IS GEEN STAND NIE. Dit word by die LEES bereken uit geldig_tot.
// Niks loop op 'n skedule nie, en 'n gestoorde stand sou verkeerd staan tot
// iemand die bladsy oopmaak — dieselfde beginsel as die staat, wat 'n
// suiwer berekening bly en nooit gestoor word nie.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "fakture";

const STANDE = ["konsep", "uitgereik", "aanvaar", "verwerp"];

// Die stande waarin 'n kwotasie nog aanvaar KAN word. Alles anders is toe.
const OOP_STANDE = ["uitgereik"];

function kry_kwotasies_store() {
  return kry_store(STORE_NAAM);
}

// ─────────────────────────────────────────────────────────────────────────
// DIE NOMMER
//
// KW/01961 — deurlopend, nooit teruggestel, geen datum in.
//
// WAAROM 1961 EN NIE 1 NIE: 'n reeks wat by 0001 begin, laat 'n bestaande
// besigheid soos 'n nuwe een lyk. Future Sharp kwoteer al 'n paar jaar.
// Dieselfde beginpunt as die faktuurreeks, op 27 Augustus 2026 gekies.
//
// DIE TWEE REEKSE LOOP VAN DIE BEGIN AF UITMEKAAR. KW/01961 word by
// aanvaarding FS/01961, maar KW/01962 kan FS/01965 word omdat daar intussen
// fakture direk uitgereik is. Dit is nie 'n fout nie; dit is wat twee
// onafhanklike reekse doen. DIE NOMMER WORD DUS NOOIT SONDER SY VOORVOEGSEL
// GESKRYF NIE — nie in 'n e-pos se onderwerpreël, nie op 'n bankstaat nie.
const BEGIN_NOMMER = 1961;
const SYFERS = 5;

// OP DIE DOKUMENT STAAN `/`; IN DIE STORE STAAN `-`. Blobs behandel 'n
// skuinsstreep as 'n padskeiding: `KW/01961` sou 'n gids `KW/` met 'n item
// `01961` word en list() sou 'n boom teruggee. Presies dieselfde omskakeling
// as _fakture.js, en sy leef ook hier op twee funksies en nêrens anders nie.
const SLEUTEL_VOORVOEGSEL = "KW-";
const NOMMER_VOORVOEGSEL = "KW/";

function nommer_na_sleutel(nommer) {
  const teks = String(nommer || "").trim();
  if (!teks.startsWith(NOMMER_VOORVOEGSEL)) return null;
  const syfers = teks.slice(NOMMER_VOORVOEGSEL.length);
  if (!/^\d+$/.test(syfers)) return null;
  return SLEUTEL_VOORVOEGSEL + syfers;
}

function sleutel_na_nommer(sleutel) {
  const teks = String(sleutel || "").trim();
  if (!teks.startsWith(SLEUTEL_VOORVOEGSEL)) return null;
  const syfers = teks.slice(SLEUTEL_VOORVOEGSEL.length);
  if (!/^\d+$/.test(syfers)) return null;
  return NOMMER_VOORVOEGSEL + syfers;
}

// DIE TOETS WAARMEE DIE FAKTUURLESERS FILTREER. kry-fakture.js, kry-staat.js
// en kry-joernaal.js roep hom aan om 'n kwotasie oor te slaan.
//
// Hy dek ALBEI kwotasiesleutels — die genommerde EN die konsep — want 'n
// konsepkwotasie is net so min 'n faktuur as 'n uitgereikte een.
function is_kwotasie_sleutel(sleutel) {
  const teks = String(sleutel || "").trim();
  return (
    teks.startsWith(SLEUTEL_VOORVOEGSEL) || teks.startsWith(KONSEP_VOORVOEGSEL)
  );
}

function volgnommer_van(sleutel) {
  const nommer = sleutel_na_nommer(sleutel);
  if (!nommer) return 0;
  const getal = Number(nommer.slice(NOMMER_VOORVOEGSEL.length));
  return Number.isFinite(getal) ? getal : 0;
}

// Die volgende nommer, as 'n SLEUTEL (`KW-01962`).
//
// Die nommer word by UITREIKING toegeken, nie by die skep van 'n konsep nie —
// anders lê daar gate in die reeks van kwotasies wat nooit uitgegaan het nie.
//
// DIT IS _fakture.js SE skep_nommer() WOORD VIR WOORD, met 'n ander
// voorvoegsel. Die lus is NIE oorbodig nie: Blobs se list() is eventueel
// konsekwent (sowat vier sekondes), en Dorrithé en Ignatius reik albei
// kwotasies uit. Twee binne 'n paar sekondes van mekaar sou dieselfde nommer
// kry sonder die bestaan-toets.
async function skep_nommer(store) {
  let sleutels = [];
  try {
    const lys = await store.list({ prefix: SLEUTEL_VOORVOEGSEL });
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die kwotasies lys nie:", fout);
    throw fout;
  }

  let hoogste = 0;
  sleutels.forEach((sleutel) => {
    const getal = volgnommer_van(sleutel);
    if (getal > hoogste) hoogste = getal;
  });

  const begin = Math.max(BEGIN_NOMMER, hoogste + 1);

  for (let poging = 0; poging < 20; poging += 1) {
    const kandidaat =
      SLEUTEL_VOORVOEGSEL + String(begin + poging).padStart(SYFERS, "0");
    if (!sleutels.includes(kandidaat)) {
      // list() loop agter. 'n Sleutel wat nie in die lys was nie, kan reeds
      // bestaan — dus vra ons hom direk.
      const bestaan = await store.get(kandidaat, { type: "json" });
      if (!bestaan) return kandidaat;
      sleutels.push(kandidaat);
    }
  }

  throw new Error("Kon nie 'n vry kwotasienommer kry nie");
}

// ─────────────────────────────────────────────────────────────────────────
// DIE KONSEP SE SLEUTEL
//
// 'n EIE voorvoegsel, nie _fakture.js se "KONSEP-" nie. Sou 'n konsepkwotasie
// daardie voorvoegsel deel, kon geen leser 'n konsepfaktuur van 'n
// konsepkwotasie onderskei sonder om die rekord te OPEN — en die hele punt
// van die voorvoegselfilter is om te filtreer VOOR die get().
const KONSEP_VOORVOEGSEL = "KWKONSEP-";

function skep_konsep_sleutel() {
  const stam = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  let staart = "";
  const KARAKTERS = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 6; i += 1) {
    staart += KARAKTERS[Math.floor(Math.random() * KARAKTERS.length)];
  }
  return KONSEP_VOORVOEGSEL + stam + "-" + staart;
}

function is_konsep_sleutel(sleutel) {
  return String(sleutel || "").startsWith(KONSEP_VOORVOEGSEL);
}

// ─────────────────────────────────────────────────────────────────────────
// DIE GELDIGHEID
//
// 'n FAKTUUR VERVAL NIE; 'n KWOTASIE MOET. Die faktuur se betaalskakel bly
// doelbewus oop, en `verval_op` staan daar leeg. Hier is dit die
// teenoorgestelde: 'n kwotasie is 'n PRYS, en 'n prys wat nie verval nie,
// bind Future Sharp aan koste van agt maande gelede.
//
// Verstek 30 dae, per kwotasie oorskryfbaar, en dit begin OOR by elke
// hersiening — 'n nuwe aanbod is 'n nuwe 30 dae.
const GELDIG_DAE = 30;

function verstek_geldig_tot(vanaf) {
  const d = vanaf ? new Date(vanaf) : new Date();
  if (!Number.isFinite(d.getTime())) return null;
  d.setDate(d.getDate() + GELDIG_DAE);
  return d.toISOString();
}

// VERVAL WORD BEREKEN, NOOIT GESTOOR NIE.
//
// Die vergelyking loop op die DATUM, nie op die tydstempel nie. 'n Kwotasie
// wat op 3 Oktober verval, is die HELE 3 Oktober geldig — 'n aanbod wat om
// 09:14 doodgaan omdat dit toe uitgereik is, is nie wat "geldig tot" beteken
// nie, en dit is nie wat die kliënt op die dokument gelees het nie.
function is_verval(rekord, nou) {
  if (!rekord || !rekord.geldig_tot) return false;
  const tot = String(rekord.geldig_tot).slice(0, 10);
  const vandag = (nou ? new Date(nou) : new Date()).toISOString().slice(0, 10);
  return vandag > tot;
}

// Die stand SOOS DIE SKERM HOM MOET WYS. Die rekord dra "uitgereik"; die
// skerm wys "verval" wanneer die datum verby is. Elke leser roep hom aan,
// sodat die berekening op EEN plek leef.
function vertoon_stand(rekord, nou) {
  if (!rekord) return "konsep";
  if (rekord.stand === "uitgereik" && is_verval(rekord, nou)) return "verval";
  return rekord.stand || "konsep";
}

// 'n Kwotasie kan aanvaar word as hy uitgereik EN nie verval is nie.
// aanvaar-kwotasie.js is die enigste plek waar hierdie antwoord tel, en dit
// is die enigste plek waar hy afgedwing word — die skerm mag 'n knoppie
// wegsteek, maar die Function besluit.
function kan_aanvaar(rekord, nou) {
  if (!rekord) return false;
  if (!OOP_STANDE.includes(rekord.stand)) return false;
  if (rekord.faktuur_nommer) return false;
  return !is_verval(rekord, nou);
}

// ─────────────────────────────────────────────────────────────────────────

function voeg_geskiedenis_by(rekord, handeling, wie, nota) {
  if (!Array.isArray(rekord.geskiedenis)) rekord.geskiedenis = [];
  rekord.geskiedenis.push({
    handeling,
    wie: wie || "",
    nota: nota || "",
    op: new Date().toISOString(),
  });
  return rekord;
}

// ─────────────────────────────────────────────────────────────────────────
// DIE HERSIENING
//
// 'n Kliënt vra 'n aanpassing. Dit gebeur BUITE die stelsel — hy bel of skryf
// 'n e-pos — en die uitkoms is 'n nuwe aanbod onder DIESELFDE nommer.
//
// WAAROM NIE KANSELLEER EN 'N NUWE NOMMER NIE: drie rondtes met een skool sou
// KW/01964, 01965 en 01966 gee plus twee dooie rekords, en die register lyk
// soos foute waar dit gewone handel was. Die nommer identifiseer die
// ONDERHANDELING, nie elke aanbod daarin nie.
//
// DIE OU AANBOD MOET DOOD WEES, NIE NET OU NIE. Die kliënt hou 'n dokument
// met KW/01964 op R28 400 in sy hand. Die skakel is dieselfde skakel, en hy
// wys ALTYD die huidige hersiening — dus kan die ou prys nie aanvaar word
// nie. Die momentopname is 'n REKORD van wat aangebied is, nooit iets wat
// weer lewendig kan word nie.
//
// Wat bewaar word, is wat die kliënt GESIEN het: die reëls, die totaal, die
// aantekening en die geldigheidsdatum. Die verdeling word NIE bewaar nie —
// sy is backoffice, sy het nooit uitgegaan nie, en 'n momentopname daarvan
// sou lyk of dit iets beteken.
function neem_momentopname(rekord, wie) {
  if (!Array.isArray(rekord.hersienings)) rekord.hersienings = [];
  rekord.hersienings.push({
    nommer: rekord.hersiening || 1,
    uitgereik_op: rekord.uitgereik_op || null,
    geldig_tot: rekord.geldig_tot || null,
    totaal_sent: Number(rekord.totaal_sent) || 0,
    reels: JSON.parse(JSON.stringify(rekord.reels || [])),
    dokument_nota: rekord.dokument_nota || "",
    vervang_op: new Date().toISOString(),
    vervang_deur: wie || "",
  });
  return rekord;
}

// ─────────────────────────────────────────────────────────────────────────
// DIE PUBLIEKE KODE
//
// Dieselfde probleem as by die faktuur, en dieselfde oplossing. Die
// kwotasienommer is deurlopend en dus tel-baar: sonder 'n kode kon iemand by
// KW-01961 begin en deur die reeks loop om elke kliënt se bedrag te sien.
//
// Hier weeg dit SWAARDER as by die faktuur, want die publieke bladsy dra 'n
// knoppie wat 'n faktuur uitreik. Pas die kode nie, is die antwoord 404.
const crypto = require("crypto");

function skep_publieke_kode() {
  return crypto.randomBytes(16).toString("hex");
}

// ─────────────────────────────────────────────────────────────────────────
// DIE TOETSSTEMPEL
//
// Dieselfde stempel as die faktuur s'n, en om dieselfde rede: terwyl
// TOETSFASE aan is, kry elke NUWE kwotasie `toets: true` en daardie data kan
// later weg. Die stempel verander nooit. Geen skakelaar wat iemand kan
// omdraai.
function is_toetsfase() {
  return String(process.env.TOETSFASE || "").trim().toLowerCase() === "aan";
}

// ─────────────────────────────────────────────────────────────────────────
// DIE LEË REKORD
//
// DIE VELDNAME IS DIE FAKTUUR S'N. Dit is nie netheid nie: faktuur-vorm.js
// en faktuur-backoffice.js lees `reels`, `koste`, `klient`, `afslag_sent`,
// `totaal_sent`, `dokument_nota` en `taal` op die naam. Dieselfde vorm is
// wat toelaat dat EEN bladsy albei dokumente dra.
//
// LET WEL: kry-kwotasies.js bou sy antwoord VELD VIR VELD. 'n Nuwe veld hier
// kom NIE vanself deur nie — dieselfde slaggat as `leers` in
// kry-indienings.js, waar 'n outeur se manuskrip gelyk het of hy weg is.
function nuwe_kwotasie(wie) {
  const nou = new Date().toISOString();
  return {
    nommer: null,               // eers by uitreiking; die vorm `KW/01961`
    stand: "konsep",
    geskep_op: nou,
    bygewerk_op: nou,
    geskep_deur: wie || "",     // WYS IN DIE REGISTER. Twee konsepte vir
                                // dieselfde skool, een van elke direkteur, is
                                // andersins nie uitmekaar te ken nie.
    uitgereik_op: null,

    // Die datum op die dokument. Sien die volle nota by nuwe_faktuur() in
    // _fakture.js; leeg beteken die dag van uitreiking.
    dokument_datum: null,

    taal: "af",

    klient_id: null,
    klient: {
      naam: "",
      kontakpersoon: "",
      epos: "",
      selfoon: "",
      adres: "",
    },
    // Die afdeling binne die instansie -- 'n graadgroep, 'n fase, 'n sektor.
    // Sien die volle nota by nuwe_faktuur() in _fakture.js: dit staan op die
    // DOKUMENT en nooit op die klientrekord nie.
    afdeling: "",

    bestelnommer: "",           // opsioneel. 'n Skool se PO bestaan gewoonlik
                                // nog nie wanneer gekwoteer word nie.

    // ELKE REEL DRA SY EIE VERDELING, presies soos die faktuur. Sien
    // Verdeling-Per-Lynitem-Ontwerp.md. Die kwotasie loop dieselfde
    // faktuur-som.js, insluitend die stukkend-kontrole: 'n prys wat nie sy
    // eie verdeling kan dra nie, word HIER gekeer, waar dit nog kan verander.
    reels: [],                  // { soort, beskrywing, hoeveelheid,
                                //   prys_pp_sent, bedrag_sent, vou_in,
                                //   hosting_pct, verdeling: [] }
                                //
                                // `vou_in` bepaal of hierdie reel se bedrag by
                                // die reel BO HAAR tel wanneer die dokument
                                // druk. Sien _fakture.js en
                                // Reels-Invou-En-Volgorde-Ontwerp.md. Dit raak
                                // niks aan die som nie.

    dokument_nota: "",

    koste: [],                  // die begroting; verskyn nêrens op die
                                // dokument nie

    afslag_sent: 0,
    koepon_kode: null,
    skenking_sent: 0,
    totaal_sent: 0,

    btw_koers: 0,
    btw_bedrag_sent: 0,

    // DIE VERDELING VRIES NIE HIER NIE. Sy vries by die FAKTUUR se
    // uitreiking, wat by aanvaarding gebeur. 'n Gevriesde verdeling op 'n
    // kwotasie sou beteken dat 'n aanbod van ses weke gelede se betaalroetes
    // geld — en of 'n begunstigde 'n subrekening het, is 'n feit oor VANDAG,
    // nie oor die dag van die aanbod nie. Die BEDRAE kom uit die kwotasie;
    // die ROETES word by uitreiking bepaal.

    // Die geldigheid. Word by uitreiking gestel en begin oor by elke
    // hersiening. Sien verstek_geldig_tot() en is_verval().
    geldig_tot: null,

    // Die hersienings. 1 is die eerste uitreiking; die lys dra die VORIGE
    // aanbodde. Sien neem_momentopname().
    hersiening: 1,
    hersienings: [],

    // Wat by aanvaarding gebeur het. ALBEI REKORDS BLY BESTAAN: die kwotasie
    // is die bewys van wat aanvaar is, die faktuur is wat betaal word.
    //
    // `faktuur_sleutel` is wat 'n mens gebruik om die faktuur te vind;
    // `faktuur_nommer` is wat 'n mens lees. Die tweede is nie afleibaar uit
    // die eerste sonder _fakture.js nie, en die register moet hom wys sonder
    // om die faktuur te open.
    aanvaar_op: null,
    aanvaar_deur_naam: "",      // die persoon wat geklik het. 'n Kwotasie word
    aanvaar_deur_epos: "",      // AANGESTUUR — hy is dikwels nie die
                                // geadresseerde nie, en "aanvaar" sonder 'n
                                // persoon daaragter is geen rekord nie.
    faktuur_sleutel: null,
    faktuur_nommer: null,
    aanvaarde_hersiening: null, // WATTER aanbod aanvaar is

    // Verwerping. Met die hand gestel: daar is GEEN verwerp-knoppie op die
    // publieke bladsy nie. 'n Kliënt wat wil onderhandel, sien anders 'n
    // knoppie wat die gesprek toemaak, en klik hom omdat dit die naaste is
    // aan "nee, nie so nie". Antwoord hy eenvoudig nie, doen verval die werk.
    verwerp_op: null,
    verwerp_deur: null,
    verwerp_rede: null,

    publieke_kode: null,        // by uitreiking; 'n konsep het geen skakel

    toets: is_toetsfase(),

    geskiedenis: [],
  };
}

// 'n Aanvaarde of verwerpte kwotasie is TOE. Elke skryf-Function moet dit
// vra voordat hy iets verander.
//
// 'n VERVALLE KWOTASIE IS NIE TOE NIE. Hy kan hersien word — dit is juis wat
// 'n mens doen wanneer 'n skool eers ná ses weke antwoord — en die hersiening
// gee hom 'n nuwe dertig dae.
function is_toe(rekord) {
  return Boolean(
    rekord && (rekord.stand === "aanvaar" || rekord.stand === "verwerp")
  );
}

module.exports = {
  STORE_NAAM,
  STANDE,
  OOP_STANDE,
  BEGIN_NOMMER,
  GELDIG_DAE,
  SLEUTEL_VOORVOEGSEL,
  KONSEP_VOORVOEGSEL,
  kry_kwotasies_store,
  nommer_na_sleutel,
  sleutel_na_nommer,
  is_kwotasie_sleutel,
  skep_nommer,
  skep_konsep_sleutel,
  is_konsep_sleutel,
  verstek_geldig_tot,
  is_verval,
  vertoon_stand,
  kan_aanvaar,
  neem_momentopname,
  skep_publieke_kode,
  is_toetsfase,
  voeg_geskiedenis_by,
  nuwe_kwotasie,
  is_toe,
};
