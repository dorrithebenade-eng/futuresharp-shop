// netlify/functions/stoor-indiening.js
//
// Stoor 'n konsep, of werk 'n bestaande een by. Dit is wat elke paar
// sekondes aangeroep word terwyl die outeur tik, en ook wanneer hy die
// "Stoor as konsep"-knoppie druk.
//
// EEN KONSEP PER TITEL, wat bygewerk word — nie een per stoor nie. Sonder
// 'n nommer skep ons 'n nuwe rekord; met 'n nommer werk ons daardie een by.
//
// WAT DIE OUTEUR MAG STOOR: die vorm se velde, en niks anders nie. Die
// stand, die nommer, die outeur_id en die geskiedenis word HIER bepaal. 'n
// Aanvraag wat `stand: "op_rak"` saamstuur, word geïgnoreer — die outeur
// raak nooit die winkel nie, en dit moet in die kode staan, nie net in die
// UI nie.
//
// 'n INGEDIENDE REKORD IS TOE. Die outeur kan hom onttrek (daardie handeling
// leef in 'n eie Function), maar nie stilweg wysig terwyl iemand daarna kyk
// nie. 'n Boek op die rak word gewysig deur 'n hangende wysiging, wat ook
// hier deurkom — die verskil is dat die LEWENDE waardes onaangeraak bly tot
// dit goedgekeur is.
//
// ROL: "koper". 'n Outeur is in Identity se oë 'n gewone koper; die
// werklike grens is dat ons slegs 'n rekord aanraak wat aan hom behoort.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_outeur } = require("./_my-outeur");
const {
  kry_indienings_store,
  skep_nommer,
  voeg_geskiedenis_by,
  is_myne,
} = require("./_indienings");

// Die vorm se dele. Alles wat nie hier staan nie, word weggegooi — 'n veld
// wat later bykom, moet hier bygevoeg word, en dit is doelbewus.
const VELDE = [
  "titel", "subtitel", "taal", "kategorie", "bladsye",
  "kort_beskrywing", "volledige_beskrywing",
  "isbn_eboek", "isbn_hardekopie",
  "formate",            // { eboek, leen, hardekopie } — elk { aan, modus, invoer, ... }
  "aflewering",         // { tyd, gebiede, voorraad }
  "mede_outeurs",       // [{ naam, epos, pct }]
  "bevestigings",       // { skepper, kopiereg, korrek }
  "onderteken_naam", "onderteken_datum",
];

const MAKS_GREPE = 200000;

function skoon(inhoud) {
  const uit = {};
  VELDE.forEach((veld) => {
    if (Object.prototype.hasOwnProperty.call(inhoud, veld)) uit[veld] = inhoud[veld];
  });
  return uit;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  const outeur = await kry_my_outeur(gebruiker);
  if (!outeur) {
    return { statusCode: 403, body: "Hierdie rekening is nie as 'n outeur geregistreer nie" };
  }

  let versoek;
  try {
    versoek = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  const inhoud = skoon(versoek.data || {});
  const as_teks = JSON.stringify(inhoud);
  if (as_teks.length > MAKS_GREPE) {
    return { statusCode: 413, body: "Die vorm is te groot om te stoor" };
  }

  const store = kry_indienings_store();
  const nou = new Date().toISOString();
  const wie = gebruiker.email || outeur.naam || "";

  // --- 'n Nuwe konsep ---
  if (!versoek.nommer) {
    let nommer;
    try {
      nommer = await skep_nommer(store);
    } catch (fout) {
      console.error("Kon nie 'n vormnommer skep nie:", fout);
      return { statusCode: 500, body: "Kon nie die vorm stoor nie" };
    }

    const rekord = voeg_geskiedenis_by(
      {
        nommer,
        outeur_id: outeur.outeur_id,
        outeur_naam: outeur.naam || "",
        stand: "konsep",
        data: inhoud,
        hangend: null,
        opmerking: "",
        produk_id: null,
        geskep_op: nou,
        gewysig_op: nou,
        geskiedenis: [],
      },
      "geskep",
      wie
    );

    try {
      await store.setJSON(nommer, rekord);
    } catch (fout) {
      console.error("Kon nie die konsep stoor nie:", fout);
      return { statusCode: 500, body: "Kon nie die vorm stoor nie" };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nommer, stand: "konsep", gewysig_op: nou }),
    };
  }

  // --- 'n Bestaande rekord ---
  let rekord;
  try {
    rekord = await store.get(versoek.nommer, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die vorm stoor nie" };
  }

  if (!rekord) {
    return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
  }
  if (!is_myne(rekord, outeur)) {
    return { statusCode: 403, body: "Hierdie vorm behoort nie aan hierdie rekening nie" };
  }

  if (rekord.stand === "ingedien" || rekord.stand === "wysiging") {
    return {
      statusCode: 409,
      body: "Hierdie vorm is ingedien. Onttrek dit eers as jy iets wil verander.",
    };
  }

  if (rekord.stand === "op_rak") {
    // Die boek bly op die rak met sy huidige waardes. Wat hy nou tik, is 'n
    // voorstel wat eers by goedkeuring lewendig word.
    rekord.hangend = inhoud;
  } else {
    rekord.data = inhoud;
  }

  rekord.gewysig_op = nou;

  try {
    await store.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    console.error("Kon nie die konsep bywerk nie:", fout);
    return { statusCode: 500, body: "Kon nie die vorm stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nommer: rekord.nommer, stand: rekord.stand, gewysig_op: nou }),
  };
};
