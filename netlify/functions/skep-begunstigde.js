// netlify/functions/skep-begunstigde.js
//
// Boekhouding-beskermd — voeg 'n nuwe inskrywing by die "begunstigdes"-store.
//
// DIESELFDE VORM AS skep-outeur.js. 'n Aparte store, want 'n begunstigde is
// nie 'n outeur nie: hy word vir 'n werksessie, kursus, verslag of koste
// betaal, nie vir 'n boek nie. Wie toevallig albei is, staan in albei
// registers.
//
// DIE WOORD IS "BEGUNSTIGDE", NIE "AANBIEDER" NIE. Dieselfde mens is die
// een keer die aanbieder van 'n werkswinkel en die ander keer bloot iemand
// wat sy reiskoste terugkry. Die register mag nie 'n rol vasspyker wat per
// faktuur verskil nie; wat vasstaan, is dat hy geld ontvang.
//
// DIE SUBREKENING-KODE WORD NIE GEDUPLISEER NIE. Is die persoon reeds 'n
// outeur, word sy BESTAANDE ACCT_-kode hier ingeplak. Dan word daar nie
// weer op Paystack se eerste-uitbetaling-goedkeuring gewag nie.
//
// DIE BANKVELDE, BYGEVOEG 19 AUGUSTUS 2026.
//
// Hulle was aanvanklik hier UITGESLUIT op grond daarvan dat 'n begunstigde
// se subrekening altyd vooraf met die hand by Paystack opgestel word — die
// bankrekord is dus daar en nie hier nie.
//
// Daardie aanname val weg sodra ons 'n vorm aan die persoon self stuur. Hy
// tik sy besonderhede in; iemand moet hulle kan SIEN om die subrekening te
// maak. Sonder 'n plek om hulle te sit, beland hulle in 'n e-pos of 'n
// WhatsApp, en dan is hulle op die slegste moontlike plek.
//
// Die kode skep NIE die subrekening nie. Dit bly 'n handmatige stap in
// Paystack se paneel; hierdie velde is die bron waaruit 'n mens dit doen.
//
// REKENINGHOUER IS NIE DIESELFDE AS NAAM. Paystack vereis dat die
// rekeninghouer se naam met die bankrekening klop, en 'n begunstigde betaal
// dalk in sy vrou se rekening of 'n trust s'n. Dieselfde les as
// skep-outeur.js.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

// 'n LYS, nie 'n string nie. Kom daar later 'n lees-alleen rol by
// (`boekhouding_lees`), is dit een woord hier en geen herstrukturering.
const ROLLE = ["boekhouding"];

const KONTAK_VELDE = ["epos", "selfoon", "adres"];

// Die bankvelde leef in hul EIE voorwerp, nie in kontak_inligting nie. 'n
// Bankrekening is nie 'n kontakbesonderheid, en die dag wanneer iemand
// hulle apart moet kan wegsteek of skrap, is die skeiding reeds daar.
const BANK_VELDE = [
  "rekeninghouer",
  "bank_naam",
  "rekeningnommer",
  "takkode",
  "tipe",
];

function maak_slug(teks) {
  return teks
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Die wit-lys filter VELD VIR VELD — 'n veld wat nie hier staan nie, val
// stil weg by die stoor. Kom daar later een by, moet hy hier EN in
// wysig-begunstigde.js bygevoeg word.
function skoon_kontak_inligting(kontak_inligting) {
  if (!kontak_inligting || typeof kontak_inligting !== "object") return {};
  const skoon = {};
  for (const veld of KONTAK_VELDE) {
    if (kontak_inligting[veld]) {
      let waarde = String(kontak_inligting[veld]).trim().slice(0, 200);
      // Die e-pos word kleinletter gestoor, soos in _kliente.js. Twee
      // skryfwyses van dieselfde posbus is dieselfde posbus.
      if (veld === "epos") waarde = waarde.toLowerCase();
      skoon[veld] = waarde;
    }
  }
  return skoon;
}

// Dieselfde wit-lys-patroon. Die rekeningnommer en die takkode word van
// spasies ontdoen — 'n mens tik "6309 2592 857" van 'n bankstaat af, en
// Paystack wil syfers he. Die res bly presies soos ingetik.
function skoon_bank(bank) {
  if (!bank || typeof bank !== "object") return {};
  const skoon = {};
  for (const veld of BANK_VELDE) {
    if (bank[veld]) {
      let waarde = String(bank[veld]).trim().slice(0, 200);
      if (veld === "rekeningnommer" || veld === "takkode") {
        waarde = waarde.replace(/\s+/g, "");
      }
      skoon[veld] = waarde;
    }
  }
  return skoon;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const naam = (invoer.naam || "").trim();
  const subrekening_kode = (invoer.subrekening_kode || "").trim();

  if (!naam) {
    return { statusCode: 400, body: "Verpligte veld: naam" };
  }
  if (subrekening_kode && !subrekening_kode.startsWith("ACCT_")) {
    return { statusCode: 400, body: "Subrekening-kode moet met ACCT_ begin" };
  }

  const begunstigde_id = maak_slug(naam);
  if (!begunstigde_id) {
    return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  }

  const store = kry_store("begunstigdes");

  const bestaande = await store.get(begunstigde_id, { type: "json" });
  if (bestaande) {
    return { statusCode: 409, body: `'n Inskrywing met naam "${naam}" bestaan reeds` };
  }

  // Die status word AFGELEI, nooit ingestuur nie. Sonder 'n subrekening kan
  // niemand deur Paystack uitbetaal word nie, en dan moet die skerm dit sê.
  // Dit KEER niks: die ry gaan na die hoofrekening en word met die hand
  // oorbetaal, presies soos Future Sharp se eie ry.
  const inskrywing = {
    begunstigde_id,
    naam,
    subrekening_kode,
    status: subrekening_kode ? "aktief" : "wag_vir_subrekening",
    kontak_inligting: skoon_kontak_inligting(invoer.kontak_inligting),
    bank: skoon_bank(invoer.bank),
    geskep_op: new Date().toISOString(),
    geskep_deur: gebruiker.email,
  };

  await store.setJSON(begunstigde_id, inskrywing);

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inskrywing),
  };
};
