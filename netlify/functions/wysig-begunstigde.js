// netlify/functions/wysig-begunstigde.js
//
// Boekhouding-beskermd — wysig 'n bestaande inskrywing se naam,
// subrekening-kode, kontakbesonderhede en bankbesonderhede in die
// "begunstigdes"-store.
//
// DIE ID VERANDER NIE MET DIE NAAM NIE. Die slug word by die skepping
// vasgestel en bly staan, want 'n faktuur se gevriesde verdeling verwys
// daarna. Verander die ID saam met 'n naamregstelling, verwys 'n ou
// faktuur na niks.
//
// Die subrekening-kode word hier bygevoeg wanneer dit by Paystack opgestel
// is — dieselfde patroon as wysig-outeur.js. Word dit weer leeg gemaak,
// val die status terug na wag_vir_subrekening; die status word AFGELEI,
// nooit ingestuur nie.
//
// DIE BANKVELDE, BYGEVOEG 19 AUGUSTUS 2026. Sien die kop van
// skep-begunstigde.js vir waarom hulle nou hier is. Die twee wit-lyste moet
// IDENTIES bly: 'n veld wat net op een plek bykom, word geskep en dan by
// die eerste wysiging stil weggegooi.
//
// LET OP: hierdie lêer is die enigste plek waar bankbesonderhede weer
// VERDWYN. Sien die blok by `const bank` hieronder.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const ROLLE = ["boekhouding"];

const KONTAK_VELDE = ["epos", "selfoon", "adres"];

const BANK_VELDE = [
  "rekeninghouer",
  "bank_naam",
  "rekeningnommer",
  "takkode",
  "tipe",
];

function skoon_kontak_inligting(kontak_inligting) {
  if (!kontak_inligting || typeof kontak_inligting !== "object") return {};
  const skoon = {};
  for (const veld of KONTAK_VELDE) {
    if (kontak_inligting[veld]) {
      let waarde = String(kontak_inligting[veld]).trim().slice(0, 200);
      if (veld === "epos") waarde = waarde.toLowerCase();
      skoon[veld] = waarde;
    }
  }
  return skoon;
}

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

  const begunstigde_id = (invoer.begunstigde_id || "").trim();
  const naam = (invoer.naam || "").trim();
  const subrekening_kode = (invoer.subrekening_kode || "").trim();

  if (!begunstigde_id) {
    return { statusCode: 400, body: "Verpligte veld: begunstigde_id" };
  }
  if (!naam) {
    return { statusCode: 400, body: "Verpligte veld: naam" };
  }
  if (subrekening_kode && !subrekening_kode.startsWith("ACCT_")) {
    return { statusCode: 400, body: "Subrekening-kode moet met ACCT_ begin" };
  }

  const store = kry_store("begunstigdes");

  const bestaande = await store.get(begunstigde_id, { type: "json" });
  if (!bestaande) {
    return { statusCode: 404, body: `Geen inskrywing met ID "${begunstigde_id}" gevind nie` };
  }

  // Die twee voorwerpe word SAAMGEVOEG, nie vervang nie. Word 'n rekord
  // ooit deur 'n skerm gestoor wat net van party velde weet, mag die res
  // nie verdwyn nie — dieselfde rede as by kontak_inligting.
  const saamgevoegde_bank = {
    ...bestaande.bank,
    ...skoon_bank(invoer.bank),
  };

  // DIE BANKBESONDERHEDE VERDWYN SODRA DAAR 'N KODE IS.
  //
  // Hulle bestaan vir één doel: om die subrekening by Paystack met die hand
  // op te stel. Is die kode hier, is daardie werk gedoen en is die kopie 'n
  // afskrif van iets wat by Paystack lê — sy voeg niks by en sy is die
  // sensitiefste ding in hierdie store.
  //
  // GEEN KNOPPIE NIE, 'N REËL. 'n Handmatige "vee uit"-knoppie word die
  // eerste keer gedruk en die tiende keer nie, en dan lê daar bankrekeninge
  // van drie mense wat almal reeds subrekeninge het. Dieselfde beginsel as
  // die status, wat ook AFGELEI word en nooit ingestuur nie.
  //
  // Dit maak die belofte op die publieke vorm waar: die besonderhede word
  // gebruik om die betaalrekening op te stel en nie by Future Sharp gehou
  // nie. Hulle lê hoogstens 'n paar dae, tussen die vorm en die subrekening.
  //
  // WORD DIE KODE OOIT WEER LEEG GEMAAK — 'n subrekening wat gesluit is —
  // kom die bankbesonderhede NIE terug nie en moet 'n mens weer vra. Dit is
  // die regte kant om op te fouteer.
  const bank = subrekening_kode ? {} : saamgevoegde_bank;

  const bygewerk = {
    ...bestaande,
    naam,
    subrekening_kode,
    status: subrekening_kode ? "aktief" : "wag_vir_subrekening",
    kontak_inligting: {
      ...bestaande.kontak_inligting,
      ...skoon_kontak_inligting(invoer.kontak_inligting),
    },
    bank,
    gewysig_op: new Date().toISOString(),
    gewysig_deur: gebruiker.email,
  };

  await store.setJSON(begunstigde_id, bygewerk);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bygewerk),
  };
};
