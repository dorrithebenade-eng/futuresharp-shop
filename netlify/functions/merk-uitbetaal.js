// netlify/functions/merk-uitbetaal.js
//
// Merk uitstaande uitbetaalrye as met die hand betaal. Rol: boekhouding.
//
// EEN OORBETALING, EEN VERWYSING, BAIE RYE. Die werklys groepeer per
// begunstigde, dus kom hier 'n lys rye oor MEER AS EEN faktuur in, met één
// datum en één bankverwysing. Dit is wat met die bankstaat klop: daar staan
// een bedrag, nie drie.
//
// DIE BEDRAG WORD NOOIT OORGETIK NIE. Hy kom uit die gevriesde verdeling en
// word hier net afgemerk. Klop iets nie, word die faktuur gekanselleer en 'n
// nuwe uitgereik — dieselfde reël as 'n betaalde faktuur wat toe is.
//
// DIT IS NIE 'N VYFDE STAND NIE. Die faktuur se stande gaan oor of die KLIËNT
// betaal het. Of die ontvanger sy geld gekry het, is 'n ander vraag en leef op
// `uitbetalings[].stand`, langs `lewering`.
//
// DIE INDEKS IS DIE SLEUTEL, NIE DIE NAAM NIE. Twee rye vir dieselfde persoon
// op een faktuur is moontlik. 'n Naam sou albei afmerk terwyl net een betaal
// is.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fakture_store,
  sleutel_na_nommer,
  voeg_geskiedenis_by,
} = require("./_fakture");

function teks(waarde) {
  return String(waarde == null ? "" : waarde).trim();
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const rye = Array.isArray(invoer.rye) ? invoer.rye : [];
  if (!rye.length) {
    return { statusCode: 400, body: "Geen rye om af te merk nie" };
  }

  // DIE VERWYSING IS VERPLIG. Sonder haar sit 'n mens ses maande later met 'n
  // afgemerkte ry en geen manier om hom teen die bankstaat te toets nie —
  // presies die probleem wat hierdie skerm oplos.
  const verwysing = teks(invoer.verwysing);
  if (!verwysing) {
    return { statusCode: 400, body: "Die bankverwysing is verplig" };
  }

  const datum_in = teks(invoer.datum);
  let betaal_op;
  if (datum_in) {
    const d = new Date(datum_in);
    if (Number.isNaN(d.getTime())) {
      return { statusCode: 400, body: "Ongeldige datum" };
    }
    betaal_op = d.toISOString();
  } else {
    betaal_op = new Date().toISOString();
  }

  const nota = teks(invoer.nota);
  const wie = (gebruiker && gebruiker.email) || "";
  const store = kry_fakture_store();

  // Groepeer per faktuur, want 'n faktuur word EEN keer gelees en EEN keer
  // geskryf al word drie van sy rye afgemerk.
  const per_faktuur = new Map();
  for (const ry of rye) {
    const sleutel = teks(ry.faktuur_sleutel);
    const indeks = Number(ry.indeks);
    if (!sleutel || !Number.isInteger(indeks) || indeks < 0) {
      return { statusCode: 400, body: "Ongeldige ry" };
    }
    if (!per_faktuur.has(sleutel)) per_faktuur.set(sleutel, []);
    per_faktuur.get(sleutel).push(indeks);
  }

  let afgemerk = 0;
  let sent_totaal = 0;
  const oorgeslaan = [];

  for (const [sleutel, indekse] of per_faktuur) {
    let rekord;
    try {
      rekord = await store.get(sleutel, { type: "json" });
    } catch (fout) {
      console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
      oorgeslaan.push(sleutel);
      continue;
    }
    if (!rekord) {
      oorgeslaan.push(sleutel);
      continue;
    }

    const lys = Array.isArray(rekord.uitbetalings) ? rekord.uitbetalings : [];
    let hierdie = 0;
    let hierdie_sent = 0;
    const name = [];

    indekse.forEach((ix) => {
      const ry = lys[ix];
      // 'N RY WAT REEDS BETAAL IS, WORD NIE WEER AFGEMERK NIE. Twee gesprekke,
      // twee oortjies, of 'n dubbelklik — die tweede poging moet stil oorslaan
      // en nie 'n tweede geskiedenis-inskrywing skryf nie.
      if (!ry || ry.stand !== "uitstaande") return;

      ry.stand = "betaal_met_hand";
      ry.betaal_op = betaal_op;
      ry.verwysing = verwysing;
      ry.deur = wie;
      if (nota) ry.nota = nota;

      hierdie += 1;
      hierdie_sent += Number(ry.bedrag_sent) || 0;
      if (ry.ontvanger) name.push(ry.ontvanger);
    });

    if (!hierdie) continue;

    const nommer = rekord.nommer || sleutel_na_nommer(sleutel) || sleutel;
    voeg_geskiedenis_by(
      rekord,
      "uitbetaal",
      wie,
      `${[...new Set(name)].join(", ")} — verwysing ${verwysing}${nota ? ` (${nota})` : ""}`
    );
    rekord.bygewerk_op = new Date().toISOString();

    try {
      await store.setJSON(sleutel, rekord);
    } catch (fout) {
      console.error(`Kon nie faktuur ${nommer} skryf nie:`, fout);
      oorgeslaan.push(sleutel);
      continue;
    }

    afgemerk += hierdie;
    sent_totaal += hierdie_sent;
  }

  if (!afgemerk) {
    return { statusCode: 409, body: "Niks is afgemerk nie. Die rye is dalk reeds betaal." };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ afgemerk, sent_totaal, oorgeslaan }),
  };
};
