// netlify/functions/_befondsers.js
//
// Die register van BEFONDSERS en SKENKERS -- wie fondse aan Future Sharp gee.
//
// 'N EIE REGISTER, NIE DIE KLIENTE NIE (25 September 2026). 'n Kliënt betaal
// vir 'n diens wat hy ontvang: 'n skool, 'n ouer. 'n Befondser of skenker is
// ekstern en stel fondse beskikbaar. Die twee oorvleuel in die praktyk byna
// nooit, en 'n skool is hoogstens die instansie VIR WIE 'n projek is.
//
// EEN STOOR, TWEE ROLLE, TWEE OORTJIES. `rol` is "befondser" (fondse volgens 'n
// ooreenkoms of toekenning) of "skenker" (gee sonder ooreenkoms). Die velde is
// dieselfde, want 'n 18A-sertifikaat vra dieselfde besonderhede van albei.
//
// DIE NOMMER DRA DIE ROL: F0001 vir 'n befondser, S0001 vir 'n skenker. Die
// rol verander dus nie ná die skep nie; 'n skenker wat later 'n toekenning
// gee, word as befondser aangeteken.
//
// DIE VELDE WAT 'N 18A-SERTIFIKAAT VRA staan reeds hier, almal opsioneel:
// soort, registrasie- of ID-nommer, handelsnaam, belastingnommer, telefoon,
// e-pos en adres. Die stelsel se eers wanneer 'n sertifikaat gevra word wat
// ontbreek.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "befondsers";
const ROLLE = { befondser: "F", skenker: "S" };
const SOORTE = ["maatskappy", "trust", "organisasie", "persoon"];

function kry_befondsers_store() {
  return kry_store(STORE_NAAM);
}

function is_toets_naam(naam) {
  return /^\s*TOETS\b/.test(String(naam || ""));
}

// Dieselfde patroon as _kliente.js se skep_nommer: uit die bestaande sleutels,
// en elke kandidaat word gelees voordat hy uitgegee word, want list() loop agter.
async function skep_nommer(store, rol) {
  const voor = ROLLE[rol];
  if (!voor) throw new Error("Onbekende rol");
  const lys = await store.list({ prefix: voor });
  const sleutels = (lys.blobs || []).map((b) => b.key);

  let hoogste = 0;
  sleutels.forEach((s) => {
    const getal = Number(s.slice(1));
    if (Number.isFinite(getal) && getal > hoogste) hoogste = getal;
  });

  for (let poging = 1; poging <= 20; poging += 1) {
    const kandidaat = voor + String(hoogste + poging).padStart(4, "0");
    if (!sleutels.includes(kandidaat)) {
      const bestaan = await store.get(kandidaat, { type: "json" });
      if (!bestaan) return kandidaat;
      sleutels.push(kandidaat);
    }
  }
  throw new Error("Kon nie 'n vry nommer kry nie");
}

function nuwe_befondser(rol) {
  const nou = new Date().toISOString();
  return {
    nommer: null,
    rol,
    soort: "maatskappy",
    naam: "",
    handelsnaam: "",        // as dit van die geregistreerde naam verskil
    registrasienommer: "",  // CIPC- of trustnommer, of ID-nommer by 'n persoon
    belastingnommer: "",
    kontakpersoon: "",
    epos: "",
    telefoon: "",
    adres: "",              // vrye teksblok, soos by die kliënte
    nota: "",
    aktief: true,
    geskep_op: nou,
    geskep_deur: "",
    bygewerk_op: nou,
  };
}

async function lees_almal(store) {
  const { blobs } = await store.list();
  return (
    await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);
}

module.exports = {
  STORE_NAAM,
  ROLLE,
  SOORTE,
  kry_befondsers_store,
  is_toets_naam,
  skep_nommer,
  nuwe_befondser,
  lees_almal,
};
