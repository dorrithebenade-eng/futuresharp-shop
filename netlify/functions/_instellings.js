// netlify/functions/_instellings.js
//
// Die maatskappy se eie besonderhede: wat in die kop van elke faktuur staan,
// en die bankbesonderhede wat langs die betaalskakel druk.
//
// HULLE LEEF AS 'N INSTELLING, NIE IN DIE SJABLOON NIE. Tot 16 Augustus het
// die kop in faktuur.html gestaan en die bankblok in faktuur-vorm.js — twee
// plekke, vasgespyker. 'n Adreswysiging sou beteken 'n mens gaan soek waar
// oral die adres staan, en die een plek wat gemis word, druk vir jare die
// verkeerde ding.
//
// EEN REKORD, NIE 'N REGISTER NIE. Daar is een maatskappy, dus een sleutel
// en geen nommers. Die store bestaan sodat 'n tweede soort instelling later
// sy eie sleutel kan kry sonder 'n migrasie.
//
// DIE BANKBESONDERHEDE KEER NIKS. 'n Faktuur met 'n betaalskakel werk sonder
// hulle — die skakel is die hoofpad, en die bankblok is daar vir die kliënt
// wat hom nie kan gebruik nie. Keer 'n mens uitreiking, staan 'n verkoop stil
// vir 'n veld wat die meeste kliënte nooit lees nie. Die skerm WAARSKU in
// plaas daarvan.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "instellings";
const MAATSKAPPY_SLEUTEL = "maatskappy";

function kry_instellings_store() {
  return kry_store(STORE_NAAM);
}

// Die verstek is die waarheid soos hy op 16 Augustus 2026 was, sodat 'n
// stelsel wat nog nooit gestoor het nie, presies dieselfde faktuur druk as
// vantevore. Dit is dieselfde besonderhede as klousule 1 van die
// Outeursooreenkoms.
//
// Die BANKVELDE is doelbewus leeg. 'n Rekeningnommer hoort nie in kode nie —
// hy word op die skerm ingevoer, en tot dan wys die skerm dat hy ontbreek.
function verstek_maatskappy() {
  return {
    naam: "Future Sharp NPC",
    registrasienommer: "2024/117444/08",
    adres: "Posbus 11602, Queenswood, Pretoria, 0121",
    epos: "admin@futuresharp.co.za",

    bank: "",
    bank_rekeningnaam: "",
    bank_rekeningnommer: "",
    bank_takkode: "",
    // Byna altyd 'n tjekrekening, dus 'n teksveld met 'n verstek en nie 'n
    // keuselys nie. 'n Keuselys met twee opsies waarvan een altyd gekies
    // word, is 'n vraag wat nie gevra hoef te word nie.
    bank_rekeningtipe: "Tjekrekening",

    bygewerk_op: null,
    bygewerk_deur: null,
  };
}

// Die velde wat 'n mens mag skryf. NIKS GAAN DEUR 'N SPREAD NIE — 'n nuwe
// veld wat ongevalideer deurglip, is presies waar wysig-produk.js se
// `...wysigings` al gebyt het.
const SKRYFBARE_VELDE = [
  "naam",
  "registrasienommer",
  "adres",
  "epos",
  "bank",
  "bank_rekeningnaam",
  "bank_rekeningnommer",
  "bank_takkode",
  "bank_rekeningtipe",
];

// Elke veld word gelees, gesnoei en begrens. Die adres is 'n vrye teksblok —
// 'n posbus, 'n straatadres en 'n aflewerkantoor het nie dieselfde vorm nie,
// en 'n vorm wat Straat / Dorp / Kode afdwing, laat 'n mens die verkeerde
// ding in die verkeerde blokkie tik. Dit druk soos dit gestoor is.
const MAKS = {
  naam: 120,
  registrasienommer: 40,
  adres: 400,
  epos: 160,
  bank: 60,
  bank_rekeningnaam: 120,
  bank_rekeningnommer: 40,
  bank_takkode: 20,
  bank_rekeningtipe: 40,
};

function skoon_veld(naam, waarde) {
  const teks = String(waarde == null ? "" : waarde).trim();
  return teks.slice(0, MAKS[naam] || 200);
}

// DIE ONVOLLEDIG-TOETS GAAN SLEGS OOR DIE BANK. Die maatskappyvelde dra 'n
// verstek en kan dus nie leeg staan nie; die bankvelde begin leeg en druk
// as strepies tot iemand hulle invul.
//
// Die rekeningtipe tel NIE: hy dra 'n verstek en 'n faktuur sonder hom lees
// steeds heeltemal reg.
function bank_onvolledig(rekord) {
  const m = rekord || {};
  return (
    !String(m.bank || "").trim() ||
    !String(m.bank_rekeningnaam || "").trim() ||
    !String(m.bank_rekeningnommer || "").trim() ||
    !String(m.bank_takkode || "").trim()
  );
}

async function kry_maatskappy() {
  const store = kry_instellings_store();
  let rekord = null;
  try {
    rekord = await store.get(MAATSKAPPY_SLEUTEL, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die maatskappy-instelling lees nie:", fout);
  }

  // 'n Ontbrekende veld val terug op die verstek, nie op 'n leë string nie.
  // Kom daar later 'n veld by, dra elke ou rekord hom vanself.
  const verstek = verstek_maatskappy();
  if (!rekord) return verstek;
  const uit = { ...verstek };
  SKRYFBARE_VELDE.forEach((veld) => {
    if (typeof rekord[veld] === "string" && rekord[veld].trim()) {
      uit[veld] = rekord[veld];
    }
  });
  uit.bygewerk_op = rekord.bygewerk_op || null;
  uit.bygewerk_deur = rekord.bygewerk_deur || null;
  return uit;
}

module.exports = {
  kry_instellings_store,
  MAATSKAPPY_SLEUTEL,
  SKRYFBARE_VELDE,
  verstek_maatskappy,
  skoon_veld,
  bank_onvolledig,
  kry_maatskappy,
};
