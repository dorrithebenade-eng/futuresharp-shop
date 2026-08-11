// netlify/functions/kry-my-outeur.js
//
// Gee die outeur-inskrywing terug wat aan die aangemelde gebruiker behoort.
// Dit is die fondament van die outeurspaneelbord: elke ander outeur-Function
// begin deur hierdie koppeling te doen.
//
// WAAROM DIT NODIG IS: 'n outeur het GEEN eie Identity-rol nie. Wanneer 'n
// uitnodiging voltooi word, skep voltooi-uitnodiging.js twee dinge langs
// mekaar — 'n inskrywing in die "outeurs"-store, en 'n gewone koper-rekening
// via die publieke /signup-eindpunt. Niks verbind hulle nie. Die enigste
// gemeenskaplike gegewe is die e-posadres.
//
// DIE E-POS IS 'N SWAK SKAKEL, en daarom skryf hierdie Function 'n vaste
// verband op sodra hy dit die eerste keer vind:
//
//   1. Is daar reeds 'n inskrywing met identity_id == die gebruiker s'n?
//      Gebruik dit. Dit is die pad wat ná die eerste aanmelding altyd loop.
//   2. Andersins: soek op e-pos. Kry ons presies een, skryf identity_id
//      daarop en gaan voort.
//   3. Kry ons meer as een, skryf NIKS nie en gee 409 terug. Twee outeurs
//      met dieselfde e-pos (pen-naam, egpaar wat saam skryf) is 'n saak vir
//      'n mens om op te los, nie vir 'n raaiskoot nie.
//
// Ná stap 2 kan die outeur sy e-pos in Identity verander sonder om die
// koppeling te breek.
//
// ROL: "koper". 'n Outeur is in Identity se oë 'n gewone koper — dit is die
// rol wat identity-signup.js outomaties toeken. Die werklike grens is nie
// die rol nie, maar die feit dat ons SLEGS die inskrywing teruggee wat aan
// hierdie gebruiker behoort.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

// Velde wat die outeur oor homself mag sien. Alles wat nie hier staan nie,
// word weggelaat — 'n nuwe interne veld op die inskrywing lek dus nie
// vanself na die front-end nie.
const KONTAK_VELDE_SIGBAAR = [
  "epos",
  "selfoon",
  "adres",
  "id_nommer",
  "btw_nommer",
  "bank_naam",
  "bank_tak_kode",
];

// Wys net die laaste vier syfers. Die outeur weet self wat sy nommer is;
// die skerm hoef dit nie te herhaal nie.
function verdoesel_rekeningnommer(nommer) {
  const skoon = String(nommer || "").replace(/\s+/g, "");
  if (!skoon) return "";
  if (skoon.length <= 4) return skoon;
  return "•••• " + skoon.slice(-4);
}

function normaliseer_epos(epos) {
  return String(epos || "").trim().toLowerCase();
}

// Bou die antwoord vir die front-end. subrekening_kode word NOOIT
// teruggegee nie — dit is interne argitektuur, nie outeursinligting nie.
function bou_antwoord(inskrywing) {
  const kontak = inskrywing.kontak_inligting || {};
  const sigbaar = {};
  KONTAK_VELDE_SIGBAAR.forEach((veld) => {
    if (kontak[veld]) sigbaar[veld] = kontak[veld];
  });
  sigbaar.bank_rekeningnommer = verdoesel_rekeningnommer(kontak.bank_rekeningnommer);

  return {
    outeur_id: inskrywing.outeur_id,
    naam: inskrywing.naam,
    // "gereed" beteken die uitbetalingsrekening is opgestel. Die woord
    // "subrekening" verskyn doelbewus nêrens nie.
    uitbetaling_gereed: Boolean(inskrywing.subrekening_kode),
    kontak_inligting: sigbaar,
    kennisgewings: inskrywing.kennisgewings || {},
    // Die hangende bankversoek. Hierdie bouer werk VELD VIR VELD, dus kom
    // 'n nuwe veld op die rekord nie vanself deur nie — dieselfde slaggat
    // wat op 8 Aug die outeur se lêers laat verdwyn het.
    //
    // Die rekeningnommer kom VOL terug, anders as die een op rekord. Hy het
    // dit self ingetik en moet 'n tikfout kan sien voordat Future Sharp dit
    // oorneem; verdoeseling begin weer sodra dit deurgevoer is.
    bank_versoek: inskrywing.bank_versoek || null,
    geskep_op: inskrywing.geskep_op || null,
  };
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  const store = kry_store("outeurs");

  let sleutels;
  try {
    const lys = await store.list();
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die outeurs-register lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die register lees nie" };
  }

  const inskrywings = await Promise.all(
    sleutels.map((sleutel) => store.get(sleutel, { type: "json" }).catch(() => null))
  );
  const geldig = inskrywings.filter(Boolean);

  // 1. Reeds gekoppel.
  const gekoppel = geldig.find((i) => i.identity_id && i.identity_id === gebruiker.id);
  if (gekoppel) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bou_antwoord(gekoppel)),
    };
  }

  // 2. Soek op e-pos — maar slaan inskrywings oor wat reeds aan iemand
  //    anders behoort, anders kan twee gebruikers om dieselfde inskrywing
  //    baklei wanneer 'n e-pos hergebruik word.
  const my_epos = normaliseer_epos(gebruiker.email);
  const passend = geldig.filter((i) => {
    if (i.identity_id && i.identity_id !== gebruiker.id) return false;
    const epos = i.kontak_inligting && i.kontak_inligting.epos;
    return normaliseer_epos(epos) === my_epos && my_epos !== "";
  });

  if (!passend.length) {
    return { statusCode: 404, body: "Geen outeur-inskrywing vir hierdie rekening nie" };
  }

  if (passend.length > 1) {
    console.warn(
      `Meer as een outeur-inskrywing met e-pos ${my_epos}: ` +
        passend.map((i) => i.outeur_id).join(", ")
    );
    return {
      statusCode: 409,
      body: "Meer as een outeur is by hierdie e-posadres geregistreer — kontak Future Sharp",
    };
  }

  // 3. Skryf die verband op. Misluk dit, gaan ons steeds voort: die outeur
  //    kom by sy data uit en die volgende aanmelding probeer weer.
  const inskrywing = passend[0];
  const gekoppelde_inskrywing = {
    ...inskrywing,
    identity_id: gebruiker.id,
    identity_gekoppel_op: new Date().toISOString(),
  };

  try {
    await store.setJSON(inskrywing.outeur_id, gekoppelde_inskrywing);
  } catch (fout) {
    console.error(
      `Kon nie identity_id op outeur ${inskrywing.outeur_id} skryf nie:`,
      fout
    );
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bou_antwoord(gekoppelde_inskrywing)),
  };
};
