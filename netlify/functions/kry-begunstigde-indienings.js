// netlify/functions/kry-begunstigde-indienings.js
//
// Boekhouding-beskermd — die wagkamer se lys.
//
// Elke indiening word MERK, nooit outomaties opgelos nie. Die toets is die
// E-POS en niks anders nie: 'n naam het vyf skryfwyses en vrye teks pas nie
// betroubaar nie. Kleinletter gestoor, kleinletter vergelyk — dieselfde reel
// as die klienteregister.
//
// Die merkie se twee vorme verskil:
//
//   in_register   die adres staan reeds by 'n BEGUNSTIGDE. Waarskynlik
//                 dieselfde mens wat weer ingedien het.
//   is_outeur     die adres staan by 'n OUTEUR. Dan het hy dalk reeds 'n
//                 ACCT_-kode, en die regte handeling by die oordrag is om
//                 daardie kode oor te plak in plaas van 'n tweede
//                 subrekening te maak. Paystack hou die eerste uitbetaling
//                 na 'n nuwe subrekening terug tot iemand dit goedkeur.
//
// DIE TWEE OPSOEKE MAG DIE SKERM NOOIT BREEK NIE. Misluk een, verskyn die
// indienings sonder daardie merkie. Dieselfde beginsel as 'n e-pos wat nie
// 'n betaling mag breek nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const ROLLE = ["boekhouding"];
const STORE = "begunstigde-indienings";

function epos_van(rekord) {
  const k = (rekord && rekord.kontak_inligting) || {};
  return String(k.epos || "").trim().toLowerCase();
}

async function lees_almal(naam) {
  const store = kry_store(naam);
  const { blobs } = await store.list();
  return (
    await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie - boekhouding-rol vereis" };
  }

  const store = kry_store(STORE);

  let blobs = [];
  try {
    const uit = await store.list();
    blobs = uit.blobs || [];
  } catch (fout) {
    // 'n Store wat nog nooit geskryf is nie, bestaan dalk nie. Dit is 'n lee
    // wagkamer, nie 'n fout nie.
    console.error("Kon nie die wagkamer lys nie:", fout);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indienings: [] }),
    };
  }

  // Die koersteller woon in dieselfde store en is NIE 'n indiening nie.
  const sleutels = blobs.map((b) => b.key).filter((k) => k.indexOf("IN-") === 0);

  const indienings = (
    await Promise.all(sleutels.map((k) => store.get(k, { type: "json" })))
  ).filter(Boolean);

  let begunstigdes = [];
  try {
    begunstigdes = await lees_almal("begunstigdes");
  } catch (fout) {
    console.error("Kon nie die begunstigdes lees vir die merkie nie:", fout);
  }

  let outeurs = [];
  try {
    outeurs = await lees_almal("outeurs");
  } catch (fout) {
    console.error("Kon nie die outeurs lees vir die merkie nie:", fout);
  }

  const verryk = indienings.map((i) => {
    const epos = epos_van(i);
    const b = epos ? begunstigdes.find((x) => epos_van(x) === epos) : null;
    const o = epos
      ? outeurs.find((x) => String(x.epos || "").trim().toLowerCase() === epos)
      : null;
    return {
      ...i,
      in_register: Boolean(b),
      register_naam: b ? b.naam || "" : "",
      is_outeur: Boolean(o),
      // Sy EIE kode uit die outeursregister. Die skerm gebruik dit om te se
      // watter kode oorgeplak moet word.
      outeur_subrekening_kode: o ? o.subrekening_kode || "" : "",
    };
  });

  // Oudste eerste: 'n wagkamer word van bo af afgewerk, en die een wat die
  // langste wag, hoort eerste.
  const gesorteer = verryk.sort((a, b) =>
    String(a.ingedien_op || "").localeCompare(String(b.ingedien_op || ""))
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ indienings: gesorteer }),
  };
};
