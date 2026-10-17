// netlify/functions/_projekte.js
//
// Die register van PROJEKTE -- waarvoor geld ontvang en bestee is.
//
// 'N TWEEDE AS, NIE 'N DEEL VAN DIE KATEGORIEBOOM NIE.
//
// Die kategorie se WAT die geld was (Platforms en sagteware, Reiskoste). Die
// projek se WAARVOOR dit was (Studievaardigheid: skole 2026). Dieselfde
// LearnWorlds-rekening kan onder een kategorie val en oor twee projekte
// verdeel word. Sou projekte subkategoriee wees, moet elke kategorie een keer
// per projek herhaal word en die boom ontplof.
//
// BEFONDSERS KOM UIT DIE KLIENTEREGISTER.
//
// 'n Besigheid wat 'n projek befonds, is gewoonlik ook die een aan wie 'n
// faktuur of kwotasie gaan: dieselfde naam, kontakpersoon en e-pos. Twee
// registers vir dieselfde besigheid dryf uitmekaar. Die projek dra dus net
// kliëntnommers (K0007), nie 'n afskrif van die besonderhede nie.
//
// NUL, EEN OF MEER BEFONDSERS. 'n Projek sonder befondser is geldig: Future
// Sharp se eie werk. Met meer as een moet 'n inkomste-inskrywing later se van
// wie die geld gekom het, anders kan 'n kwitansie of sertifikaat nie aan die
// regte befondser uitgereik word nie. Daardie reel woon by die joernaal, nie
// hier nie.
//
// SKRAP HET TWEE UITKOMSTE, soos by die kategoriee: ongebruik of 'n toets
// word uitgevee; gebruik word gedeaktiveer. Sien skrap-projek.js.
//
// 'N TOETS IS 'N NAAM WAT MET "TOETS" BEGIN (25 September 2026).
//
// Dieselfde patroon as die studievaardigheidsregistrasies se TOETS-nommer: 'n
// bewuste keuse per rekord, nie iets wat die stelsel uit TOETSFASE aflei nie.
// Die eerste weergawe het elke projek as toets gemerk solank TOETSFASE aan
// was, en dan sou die REGTE projekte van die terugwerkende invoer ook
// uitveebaar gewees het. Haal 'n mens TOETS uit die naam, is dit 'n regte
// projek.
//
// Hoofletters en 'n woordgrens: "TOETS Skole", "TOETS-2" en "TOETS" tel;
// "Toetsafnemers" en "TOETSING" nie. Dieselfde reel geld vir kliënte; sien
// skrap-toetse.js.
//
// NOMMER, FINANSIERING EN INSTANSIE (17 Oktober 2026).
//
// Elke projek kry 'n nommer P-JJJJ-NNN by sy eerste stoor. Die jaar is die
// jaar waarin die projek geskep is, en die volgnommer begin elke jaar by 001.
// Die nommer verander nooit, ook nie as die naam verander nie: dit is waarna
// 'n faktuur, 'n befondser en 'n verslag verwys.
//
// Finansiering se wie betaal, en bepaal hoe die geld op die staat val:
//   fooie     die kliënt betaal vir die diens wat hy self ontvang (verstek)
//   toelae    'n befondser betaal sodat ander die diens kry; beperk tot die
//             projek, en 'n 18A-kwitansie is moontlik
//   borgskap  'n borg betaal en kry iets terug; geen 18A-kwitansie nie
// Die verstek is fooie, sodat 'n gewone projek niks ekstra verg nie.
//
// Instansie se waar die werk gedoen word. Die ou vrye-teks `soort` bly op die
// rekord staan vir projekte wat dit reeds dra, maar die vorm stuur dit nie meer
// nie.

const { kry_store } = require("./_blob-store");
const { maak_slug } = require("./_fin-kategoriee");

const STORE_NAAM = "projekte";

const FINANSIERING = ["fooie", "toelae", "borgskap"];
const INSTANSIES = ["skole", "ouers", "hoer", "korporatief"];
const NR_PATROON = /^P-(\d{4})-(\d{3,})$/;

// Die volgende nommer vir `jaar`, uit die nommers wat reeds bestaan.
function volgende_nr(almal, jaar) {
  let hoogste = 0;
  (almal || []).forEach((p) => {
    const m = NR_PATROON.exec(String((p && p.nr) || ""));
    if (m && Number(m[1]) === jaar) hoogste = Math.max(hoogste, Number(m[2]));
  });
  return `P-${jaar}-${String(hoogste + 1).padStart(3, "0")}`;
}

function jaar_van(iso) {
  const j = Number(String(iso || "").slice(0, 4));
  return j >= 2000 && j <= 2100 ? j : new Date().getFullYear();
}

function is_toets_naam(naam) {
  return /^\s*TOETS\b/.test(String(naam || ""));
}

function kry_projekte_store() {
  return kry_store(STORE_NAAM);
}

function nuwe_projek() {
  const nou = new Date().toISOString();
  return {
    id: "",               // uit die naam, verander nooit
    nr: "",               // P-JJJJ-NNN, by die eerste stoor
    finansiering: "fooie",
    instansie: "",
    van: "",              // JJJJ-MM-DD, opsioneel
    tot: "",
    naam: "",
    befondsers: [],       // kliëntnommers, in die volgorde waarin hulle bygevoeg is
    // 'n Rekord van voor hierdie veld bestaan nie, maar dieselfde reel as die
    // kategoriee geld: elke leser toets `aktief !== false`.
    aktief: true,
    toets: false,         // altyd is_toets_naam(naam); by elke stoor herbereken
    nota: "",
    geskep_op: nou,
    geskep_deur: "",
    bygewerk_op: nou,
  };
}

// Een lys, sonder duplikate, sonder lee waardes, in die volgorde gegee.
function skoon_befondsers(lys) {
  if (!Array.isArray(lys)) return [];
  const gesien = new Set();
  const uit = [];
  lys.forEach((n) => {
    const nommer = String(n || "").trim();
    if (!nommer || gesien.has(nommer)) return;
    gesien.add(nommer);
    uit.push(nommer);
  });
  return uit.slice(0, 50);
}

async function lees_almal(store) {
  const { blobs } = await store.list();
  return (
    await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);
}

module.exports = {
  STORE_NAAM,
  FINANSIERING,
  INSTANSIES,
  volgende_nr,
  jaar_van,
  kry_projekte_store,
  nuwe_projek,
  skoon_befondsers,
  lees_almal,
  maak_slug,
  is_toets_naam,
};
