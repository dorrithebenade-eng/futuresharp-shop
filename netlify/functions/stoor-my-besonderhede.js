// netlify/functions/stoor-my-besonderhede.js
//
// Stoor die drie dinge op "My besonderhede" wat werklik die outeur s'n is:
// die verkoopkennisgewing, sy selfoon en sy adres. Niks anders nie.
//
// DIE WITLYS IS DIE HELE PUNT. Alles onder "Op rekord" — naam, e-pos,
// ID-nommer, BTW, bank — raak die ooreenkoms of die uitbetaling, en gaan
// deur Future Sharp. Dat die UI dit as teks wys en nie as 'n veld nie, is
// nie 'n beveiliging nie; 'n aanvraag wat `naam` of `bank_rekeningnommer`
// saamstuur, moet HIER doodloop. Die rekord word gespreid uit wat reeds in
// die store staan, en slegs drie plekke word aangeraak.
//
// EEN OPROEP PER KAART. Die skerm het twee stoorknoppies, en elke knoppie
// stuur net sy eie deel. 'n Ontbrekende `kennisgewings` of `kontak` beteken
// "los dit soos dit is" — nie "maak dit leeg" nie.
//
// ROL: "koper". 'n Outeur is in Identity se oë 'n gewone koper; die
// werklike grens is dat kry_my_outeur() slegs die inskrywing teruggee wat
// aan hierdie rekening behoort, en dat ons net daardie sleutel skryf.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_outeur } = require("./_my-outeur");

// Dieselfde snit as wysig-outeur.js, sodat 'n veld nie 'n ander lengte kry
// afhangende van wie dit gestoor het nie.
const KONTAK_VELDE = ["selfoon", "adres"];
const MAKS_LENGTE = 200;

// Leeg is 'n geldige waarde: 'n outeur wat 'n ou selfoonnommer uitvee, moet
// dit kan doen sonder om die ou een te laat staan. Daarom trim-en-snit ons
// eerder as om leë waardes weg te gooi soos wysig-outeur.js doen.
function skoon_teks(waarde) {
  return String(waarde === undefined || waarde === null ? "" : waarde)
    .trim()
    .slice(0, MAKS_LENGTE);
}

function het(voorwerp, veld) {
  return Object.prototype.hasOwnProperty.call(voorwerp, veld);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  const myne = await kry_my_outeur(gebruiker);
  if (!myne) {
    return { statusCode: 403, body: "Hierdie rekening is nie as 'n outeur geregistreer nie" };
  }

  let versoek;
  try {
    versoek = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  // Lees vars uit die store eerder as om die weergawe van kry_my_outeur()
  // te skryf. Daardie een kom uit 'n list()-deurloop; hierdie een is 'n
  // direkte get() op die sleutel wat ons gaan skryf.
  const store = kry_store("outeurs");
  let bestaande;
  try {
    bestaande = await store.get(myne.outeur_id, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie outeur ${myne.outeur_id} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie jou besonderhede stoor nie" };
  }

  if (!bestaande) {
    return { statusCode: 404, body: "Hierdie inskrywing bestaan nie meer nie" };
  }

  const bygewerk = { ...bestaande };
  let iets_verander = false;

  // --- Kennisgewings ---
  const kennisgewings = versoek.kennisgewings;
  if (kennisgewings && typeof kennisgewings === "object" && het(kennisgewings, "by_verkoop")) {
    // 'n Boolean, nie iets wat na een lyk nie. Die string "false" is waar,
    // en _kennisgewing-outeur.js toets op `=== false` — 'n verkeerde tipe
    // sou die pos stilweg weer aanskakel.
    if (typeof kennisgewings.by_verkoop !== "boolean") {
      return { statusCode: 400, body: "Ongeldige waarde vir by_verkoop" };
    }
    bygewerk.kennisgewings = {
      ...(bestaande.kennisgewings || {}),
      by_verkoop: kennisgewings.by_verkoop,
    };
    iets_verander = true;
  }

  // --- Kontakbesonderhede ---
  const kontak = versoek.kontak;
  if (kontak && typeof kontak === "object") {
    const saam = { ...(bestaande.kontak_inligting || {}) };
    KONTAK_VELDE.forEach((veld) => {
      if (het(kontak, veld)) saam[veld] = skoon_teks(kontak[veld]);
    });
    bygewerk.kontak_inligting = saam;
    iets_verander = true;
  }

  if (!iets_verander) {
    return { statusCode: 400, body: "Niks om te stoor nie" };
  }

  const nou = new Date().toISOString();
  bygewerk.gewysig_op = nou;
  bygewerk.gewysig_deur = gebruiker.email || myne.naam || "";

  try {
    await store.setJSON(myne.outeur_id, bygewerk);
  } catch (fout) {
    console.error(`Kon nie outeur ${myne.outeur_id} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie jou besonderhede stoor nie" };
  }

  // Gee net terug wat die skerm nou wys. Die res van die rekord — bank,
  // subrekening-kode, ID — hoort nie in 'n antwoord op 'n stoor nie.
  const uit_kontak = bygewerk.kontak_inligting || {};
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      kennisgewings: { by_verkoop: (bygewerk.kennisgewings || {}).by_verkoop !== false },
      kontak: {
        selfoon: uit_kontak.selfoon || "",
        adres: uit_kontak.adres || "",
      },
      gestoor_op: nou,
    }),
  };
};
