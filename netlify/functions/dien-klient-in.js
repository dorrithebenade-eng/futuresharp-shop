// netlify/functions/dien-klient-in.js
//
// Die publieke kliëntvorm se indiening. GEEN ROL, GEEN SESSIE.
//
// DIT IS DIE ENIGSTE ONBESKERMDE SKRYF-FUNCTION IN DIE STELSEL. Elke ander
// een gaan deur kry_gebruiker_en_kontroleer_rol(). Hierdie een kan nie —
// die kliënt meld nooit aan nie; hy is 'n rekord, nie 'n rekening. Daarom
// staan die drie maatreëls van die begin af hier en word hulle nie later
// bygelap nie:
//
//   1. 'n Heuningpot-veld wat 'n mens nie sien nie en 'n bot wel vul.
//   2. Koersbeperking per IP, plus 'n globale plafon.
//   3. 'n Lengteplafon op elke veld, en beheerkarakters wat uitval.
//
// WAT DIT NIE DOEN NIE: ontsnap. Die teks word RAAK gestoor soos die kliënt
// dit getik het, want die ontsnapping hoort waar dit VERTOON word — en dit
// gebeur reeds: faktuurpaneel-kliente.js stuur elke veld deur fk_ontsnap()
// voordat dit in innerHTML beland. Ontsnap 'n mens ook hier, staan `&amp;` in
// die store en dan op die gedrukte faktuur. Een ontsnapping, by die skerm.
//
// NIKS WORD SAAMGESMELT NIE. Dieselfde skool kan twee keer indien — 'n nuwe
// skoolhoof, 'n ander nommer, of iemand wat die vorm bloot herhaal. Albei
// word gestoor, elk met sy eie nommer, en kry-kliente.js merk die paar. 'n
// Outomatiese samesmelting sou 'n besluit neem wat 'n mens moet neem.

const {
  kry_kliente_store,
  skoon_epos,
  skep_nommer,
  nuwe_klient,
  SOORTE,
  voeg_geskiedenis_by,
} = require("./_kliente");

const KOERS_SLEUTEL = "_koers";
const VENSTER_MS = 60 * 60 * 1000;   // een uur
const PER_IP = 5;                    // indienings per IP per uur
const GLOBAAL = 60;                  // indienings altesaam per uur

// Die lengteplafonne. Hulle keer 'n megagreep in 'n naamveld, nie 'n lang
// naam nie — 'n skool met 'n dubbele naam en 'n aanhangsel pas maklik.
const MAKS = {
  naam: 200,
  kontak: 200,
  epos: 200,
  selfoon: 60,
  adres: 600,
};

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
// maak, nie om die sesde indiening op die sekonde te vang. Die heuningpot dra
// die res.
//
// Elke skryf ruim die venster op, sodat die rekord nie groei nie.
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
    // 'n Mislukte tellerskryf mag nie 'n werklike kliënt keer nie.
    console.error("Kon nie die koersteller skryf nie:", fout);
  }

  return { toegelaat: true };
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

  const soort = SOORTE.includes(invoer.soort) ? invoer.soort : "instansie";
  const naam = skoon_teks(invoer.naam, MAKS.naam, false);
  const epos = skoon_epos(skoon_teks(invoer.epos, MAKS.epos, false));

  // DIE VORM VRA MEER AS WAT DIE PANEEL VRA. In die paneel kan 'n kliënt met
  // net 'n naam gestoor word, want "+ Nuwe kliënt" moet midde-in 'n faktuur
  // werk en jy het die res dalk nog nie. Hier tik die kliënt SELF, en 'n
  // indiening sonder 'n e-pos is 'n rekord waarmee niemand iets kan doen nie:
  // die e-pos is die duplikaat-toets én die pad waarlangs die proforma gaan.
  if (!naam) {
    return { statusCode: 400, body: "Die naam is verplig" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(epos)) {
    return { statusCode: 400, body: "'n Geldige e-posadres is verplig" };
  }

  const store = kry_kliente_store();

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

  // bron: "vorm" gee die rekord gesien: false, en dít is wat die Nuut-merkie
  // in die paneel laat verskyn. Sonder dit verskyn 'n indiening stilweg
  // tussen veertig ander en niemand weet daar was een nie.
  const rekord = nuwe_klient("vorm");
  rekord.soort = soort;
  rekord.naam = naam;
  // 'n PRIVAAT KLIËNT DRA NOOIT 'N KONTAKPERSOON NIE. Die vorm versteek die
  // veld, maar 'n regstreekse POST kan hom stuur.
  rekord.kontak = soort === "privaat" ? "" : skoon_teks(invoer.kontak, MAKS.kontak, false);
  rekord.epos = epos;
  rekord.selfoon = skoon_teks(invoer.selfoon, MAKS.selfoon, false);
  rekord.adres = skoon_teks(invoer.adres, MAKS.adres, true);

  try {
    rekord.nommer = await skep_nommer(store);
  } catch (fout) {
    console.error("Kon nie 'n kliëntnommer kry nie:", fout);
    return { statusCode: 500, body: "Kon nie die besonderhede stoor nie" };
  }

  voeg_geskiedenis_by(rekord, "ingedien", "", "Deur die kliëntvorm");

  try {
    await store.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    console.error("Kon nie die indiening stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die besonderhede stoor nie" };
  }

  // DIE NOMMER GAAN NIE TERUG NIE. Dit is 'n publieke punt: gee ons K0041
  // terug, kan iemand die reeks aflees en weet hoeveel kliënte daar is.
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
