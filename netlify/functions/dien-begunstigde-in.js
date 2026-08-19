// netlify/functions/dien-begunstigde-in.js
//
// Die publieke begunstigdevorm se indiening. GEEN ROL, GEEN SESSIE.
//
// DIT SKRYF NIE NA DIE REGISTER NIE. Dit skryf na 'n WAGKAMER — die
// "begunstigde-indienings"-store — en iemand met die boekhouding-rol dra dit
// daarna oor.
//
// Dit verskil doelbewus van dien-klient-in.js, wat reguit in die
// kliënteregister skryf. Die rede is die `begunstigde_id`: dit is 'n slak van
// die naam en dit VERANDER NOOIT, want 'n faktuur se gevriesde verdeling
// verwys daarna. Tik iemand "eugene marais" of "E. Marais", is dit die
// verkeerde sleutel vir ewig en die enigste herstel is om die rekord oor te
// maak. Die wagkamer is die plek waar 'n mens kyk voordat daardie sleutel
// vasgestel word.
//
// Die tweede rede is die bankbesonderhede. 'n Publieke Function wat reguit in
// die register skryf, sou beteken enigiemand kan 'n bankrekening onder 'n
// bestaande naam inskryf.
//
// DIE DRIE MAATREËLS STAAN VAN DIE BEGIN AF HIER, soos by die kliëntvorm:
//
//   1. 'n Heuningpot-veld wat 'n mens nie sien nie en 'n bot wel vul.
//   2. Koersbeperking per IP, plus 'n globale plafon.
//   3. 'n Lengteplafon op elke veld, en beheerkarakters wat uitval.
//
// WAT DIT NIE DOEN NIE: ontsnap. Die teks word RAAK gestoor soos die persoon
// dit getik het; die ontsnapping hoort waar dit VERTOON word. Ontsnap 'n mens
// ook hier, staan `&amp;` in die store en later op 'n skerm.

const { kry_store } = require("./_blob-store");

const STORE = "begunstigde-indienings";
const KOERS_SLEUTEL = "_koers";
const VENSTER_MS = 60 * 60 * 1000;   // een uur
const PER_IP = 5;                    // indienings per IP per uur
const GLOBAAL = 60;                  // indienings altesaam per uur

const MAKS = {
  naam: 200,
  epos: 200,
  selfoon: 60,
  adres: 600,
  rekeninghouer: 200,
  bank_naam: 120,
  rekeningnommer: 40,
  takkode: 20,
};

const TIPES = ["tjek", "spaar"];

// Beheerkarakters val uit, maar 'n REËLBREUK oorleef in die adres: dit is 'n
// vrye teksblok wat gedruk word soos dit gestoor is.
function skoon_teks(waarde, maks, hou_reels) {
  let uit = String(waarde == null ? "" : waarde);
  uit = hou_reels
    ? uit.replace(/\r\n/g, "\n").replace(/[^\S\n]*\n[^\S\n]*/g, "\n")
    : uit.replace(/\s+/g, " ");
  // eslint-disable-next-line no-control-regex
  uit = uit.replace(hou_reels ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "");
  return uit.trim().slice(0, maks);
}

// Die rekeningnommer en die takkode word van ALLE spasies ontdoen — 'n mens
// tik "6309 2592 857" van 'n bankstaat af. Dieselfde reël as skep-begunstigde.js.
function skoon_syfers(waarde, maks) {
  return String(waarde == null ? "" : waarde).replace(/\s+/g, "").slice(0, maks);
}

function kry_ip(event) {
  const k = event.headers || {};
  const deur =
    k["x-nf-client-connection-ip"] ||
    k["client-ip"] ||
    (k["x-forwarded-for"] || "").split(",")[0];
  return String(deur || "").trim() || "onbekend";
}

// KOERSBEPERKING IN ÉÉN BLOB-SLEUTEL. Blobs se skryfwerk is laaste-wen, dus
// kan twee indienings binne dieselfde oomblik mekaar oorskryf en een tel nie.
// Dit is aanvaarbaar: die punt is om 'n skrip te keer wat honderde rekords
// maak, nie om die sesde indiening op die sekonde te vang.
async function koers_toets(store, ip) {
  let rekord = { ips: {} };
  try {
    const bestaande = await store.get(KOERS_SLEUTEL, { type: "json" });
    if (bestaande && bestaande.ips) rekord = bestaande;
  } catch (fout) {
    // Bestaan nog nie. Dan is dit die eerste indiening.
  }

  const nou = Date.now();
  const grens = nou - VENSTER_MS;

  let totaal = 0;
  const skoon = {};
  Object.keys(rekord.ips).forEach((sleutel) => {
    const tye = (rekord.ips[sleutel] || []).filter((t) => t > grens);
    if (tye.length) {
      skoon[sleutel] = tye;
      totaal += tye.length;
    }
  });

  const myne = skoon[ip] || [];
  if (myne.length >= PER_IP || totaal >= GLOBAAL) {
    return { toegelaat: false };
  }

  myne.push(nou);
  skoon[ip] = myne;

  try {
    await store.setJSON(KOERS_SLEUTEL, { ips: skoon, bygewerk_op: new Date().toISOString() });
  } catch (fout) {
    // 'n Mislukte tellerskryf mag nie 'n werklike indiening keer nie.
    console.error("Kon nie die koersteller skryf nie:", fout);
  }

  return { toegelaat: true };
}

// Die sleutel is 'n tydstempel plus 'n ewekansige stert. NIE 'n slak van die
// naam nie: twee mense met dieselfde naam moet albei kan indien, en die
// besluit oor wie die register se `begunstigde_id` kry, hoort by die oordrag.
//
// Die voorvoegsel `IN-` hou hom uit die pad van `_koers`.
function skep_sleutel() {
  const nou = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
  const stert = Math.random().toString(36).slice(2, 8);
  return `IN-${nou}-${stert}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch (fout) {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  // DIE HEUNINGPOT GEE 'N GEWONE 200. Sê ons "afgekeur", weet die skrip watter
  // veld om leeg te laat en die volgende poging kom deur.
  if (String(invoer.webwerf || "").trim()) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  }

  const naam = skoon_teks(invoer.naam, MAKS.naam, false);
  const epos = skoon_teks(invoer.epos, MAKS.epos, false).toLowerCase();

  // NAAM EN E-POS IS VERPLIG, die res nie. Die e-pos is die duplikaat-toets
  // en die enigste manier om die persoon terug te kontak as iets ontbreek.
  // Die bankbesonderhede is NIE verplig nie: iemand wat sy takkode nie byderhand
  // het nie, moet die vorm kan indien eerder as om hom te laat vaar.
  if (!naam) {
    return { statusCode: 400, body: "Die naam is verplig" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(epos)) {
    return { statusCode: 400, body: "'n Geldige e-posadres is verplig" };
  }

  const store = kry_store(STORE);

  let koers;
  try {
    koers = await koers_toets(store, kry_ip(event));
  } catch (fout) {
    console.error("Kon nie die koers toets nie:", fout);
    koers = { toegelaat: true };
  }
  if (!koers.toegelaat) {
    return { statusCode: 429, body: "Te veel indienings" };
  }

  const tipe = TIPES.includes(invoer.tipe) ? invoer.tipe : "";

  const rekord = {
    sleutel: skep_sleutel(),
    naam,
    kontak_inligting: {
      epos,
      selfoon: skoon_teks(invoer.selfoon, MAKS.selfoon, false),
      adres: skoon_teks(invoer.adres, MAKS.adres, true),
    },
    bank: {
      rekeninghouer: skoon_teks(invoer.rekeninghouer, MAKS.rekeninghouer, false),
      bank_naam: skoon_teks(invoer.bank_naam, MAKS.bank_naam, false),
      rekeningnommer: skoon_syfers(invoer.rekeningnommer, MAKS.rekeningnommer),
      takkode: skoon_syfers(invoer.takkode, MAKS.takkode),
      tipe,
    },
    ingedien_op: new Date().toISOString(),
  };

  try {
    await store.setJSON(rekord.sleutel, rekord);
  } catch (fout) {
    console.error("Kon nie die indiening stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die besonderhede stoor nie" };
  }

  // DIE SLEUTEL GAAN NIE TERUG NIE. Dit is 'n publieke punt; niks wat die
  // store se inhoud verraai, hoort in die antwoord nie.
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
