// netlify/functions/_kliente.js
//
// Die kliënte-store, die kliëntnommer, en die duplikaat-toets.
//
// DIE KLIËNT MELD NIE AAN NIE. Hy is 'n rekord wat in die paneel vasgevang
// word of wat homself deur die kliëntvorm skep — geen Identity-rekening,
// geen rol, geen wagwoord.
//
// TWEE SOORTE: `instansie` en `privaat`. Die onderskeid doen werk. 'n
// Instansie het 'n kontakpersoon wat nie die entiteit self is nie; 'n
// privaat kliënt is sy eie kontak. Daarom geld die kontakveld — en die
// onvolledig-toets daarop — net by 'n instansie.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "kliente";
const SOORTE = ["instansie", "privaat"];

function kry_kliente_store() {
  return kry_store(STORE_NAAM);
}

// 'n E-POS WORD KLEINLETTER GESTOOR EN KLEINLETTER VERGELYK.
//
// Admin@HSBFN.co.za en admin@hsbfn.co.za is dieselfde posbus; geen posdiens
// behandel hulle anders nie. Die omskakeling gebeur by die STOOR, nie net by
// die vergelyking nie — andersins moet elke latere toets onthou om af te
// skakel, en die een plek wat dit vergeet, is waar die duplikaat deurglip.
function skoon_epos(epos) {
  return String(epos || "").trim().toLowerCase();
}

// K0001. Die nommer word toegeken wanneer daar 'n REKORD is om te nommer —
// by die skep in die paneel, of op die oomblik dat iemand die kliëntvorm
// instuur. Nooit by 'n skakel nie: die kliëntvorm-skakel is staande en gaan
// aan almal, dus sou hy nommers vooruit moes uitdeel vir mense wat dalk
// nooit indien nie.
//
// Die volgnommer kom uit die bestaande sleutels, nie uit 'n aparte teller
// nie. Blobs se list() is eventueel konsekwent, dus toets ons of die sleutel
// reeds bestaan voordat hy teruggegee word — dieselfde patroon as
// _indienings.js en _fakture.js.
async function skep_nommer(store) {
  let sleutels = [];
  try {
    const lys = await store.list({ prefix: "K" });
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die kliënte lys nie:", fout);
    throw fout;
  }

  let hoogste = 0;
  sleutels.forEach((sleutel) => {
    const getal = Number(sleutel.slice(1));
    if (Number.isFinite(getal) && getal > hoogste) hoogste = getal;
  });

  for (let poging = 1; poging <= 20; poging += 1) {
    const kandidaat = "K" + String(hoogste + poging).padStart(4, "0");
    if (!sleutels.includes(kandidaat)) {
      const bestaan = await store.get(kandidaat, { type: "json" });
      if (!bestaan) return kandidaat;
      sleutels.push(kandidaat);
    }
  }

  throw new Error("Kon nie 'n vry kliëntnommer kry nie");
}

// Die leë rekord. Elke veld wat later gaan bestaan, staan hier — ook die wat
// leeg bly. LET WEL: kry-kliente.js bou sy antwoord VELD VIR VELD. 'n Nuwe
// veld hier kom NIE vanself deur nie.
function nuwe_klient(bron) {
  const nou = new Date().toISOString();
  return {
    nommer: null,
    soort: "instansie",
    naam: "",
    kontak: "",              // net by 'n instansie
    epos: "",                // altyd kleinletter
    selfoon: "",
    // 'n VRYE TEKSBLOK, nie 'n stel velde nie. 'n Straatadres, 'n posbus en
    // 'n skool se aflewerkantoor het nie dieselfde vorm nie, en 'n vorm wat
    // Straat / Dorp / Kode afdwing, laat 'n mens die verkeerde ding in die
    // verkeerde blokkie tik. Dit word gedruk soos dit gestoor is.
    //
    // Die adres maak NIE 'n rekord onvolledig nie: die proforma gaan per
    // e-pos uit, en 'n adres wat ontbreek keer niks.
    adres: "",
    geskep_op: nou,
    bygewerk_op: nou,
    // "paneel" of "vorm". 'n Indiening deur die publieke vorm dra 'n
    // Nuut-merkie tot iemand hom oopgemaak het — andersins verskyn hy
    // stilweg tussen veertig ander en niemand weet daar was 'n indiening nie.
    bron: bron || "paneel",
    gesien: bron !== "vorm",
    geskiedenis: [],
  };
}

// Onvolledig is 'n TOESTAND, nie 'n fout nie. Die vorm stoor met net 'n
// naam, want "+ Nuwe kliënt" moet midde-in 'n faktuur werk.
//
// Die e-pos dra die proforma; die selfoon is hoe 'n mens iemand bereik
// wanneer die pos stil bly. 'n Kontakpersoon geld NET by 'n instansie —
// sonder daardie onderskeid sou elke privaat kliënt vir ewig onvolledig
// staan vir 'n veld wat nie kan bestaan nie.
function is_onvolledig(rekord) {
  if (!rekord) return true;
  if (!rekord.epos || !rekord.selfoon) return true;
  return rekord.soort === "instansie" && !rekord.kontak;
}

// Die duplikaat-toets is die E-POS, en niks anders nie. Hy is die enigste
// veld waar dieselfde ding nie op twee maniere geskryf kan word nie. 'n
// Skool se naam het vyf skryfwyses en sy nommer drie; 'n toets op "presies
// dieselfde" oor al die velde sou juis die gevalle mis wat die merkie moet
// vang.
//
// `nagegaan` is 'n lys sleutels soos "K0001|K0006". 'n Nagegaande paar keer
// nie terug nie, ook al pas die e-posse steeds — maar 'n DERDE rekord met
// dieselfde adres is 'n nuwe paar.
function paar_sleutel(a, b) {
  return [a, b].sort().join("|");
}

function kry_duplikaat_pare(rekords, nagegaan) {
  const gesien = nagegaan || [];
  const per_epos = {};
  rekords.forEach((r) => {
    const e = skoon_epos(r.epos);
    if (!e) return;
    if (!per_epos[e]) per_epos[e] = [];
    per_epos[e].push(r.nommer);
  });

  const pare = [];
  Object.keys(per_epos).forEach((e) => {
    const lys = per_epos[e].slice().sort();
    for (let i = 0; i < lys.length; i += 1) {
      for (let j = i + 1; j < lys.length; j += 1) {
        const sleutel = paar_sleutel(lys[i], lys[j]);
        if (gesien.includes(sleutel)) continue;
        pare.push({ sleutel, epos: e, nommers: [lys[i], lys[j]] });
      }
    }
  });
  return pare;
}

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

module.exports = {
  STORE_NAAM,
  SOORTE,
  kry_kliente_store,
  skoon_epos,
  skep_nommer,
  nuwe_klient,
  is_onvolledig,
  paar_sleutel,
  kry_duplikaat_pare,
  voeg_geskiedenis_by,
};
