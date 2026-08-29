// netlify/functions/stoor-joernaal.js
//
// Stoor 'n joernaalinskrywing, of werk een by. Rol: boekhouding.
//
// EEN FUNCTION VIR SKEP EN WYSIG. Dra die invoer 'n `sleutel`, word daardie
// inskrywing bygewerk; andersins word 'n nuwe geskep. Twee Functions sou
// beteken dieselfde skoonmaak op twee plekke staan, en dan verander 'n mens
// die een en nie die ander nie.
//
// DIE DATUM MAG IN DIE VERLEDE LE. Ignatius sit met 'n bankstaat en teken in
// Februarie 'n betaling van Junie aan -- dit is die hele punt van die
// joernaal. Net die toekoms word gekeer.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_joernaal_store,
  RIGTINGS,
  finansiele_jaar,
  skep_sleutel,
  nuwe_inskrywing,
} = require("./_joernaal");

const BESKRYWING_MAKS = 300;
const WIE_MAKS = 120;
const NOTA_MAKS = 500;

function teks(waarde, maks) {
  return String(waarde == null ? "" : waarde).trim().slice(0, maks);
}

// Vandag se datum in ONS tyd, nie in UTC nie. Die bediener loop op UTC; om
// 01:00 in Pretoria is dit daar nog gister, en dan sou "vandag" as toekoms
// gelees word.
function dag_vandag() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

  const datum = teks(invoer.datum, 10);
  const beskrywing = teks(invoer.beskrywing, BESKRYWING_MAKS);
  const rigting = RIGTINGS.includes(invoer.rigting) ? invoer.rigting : "uit";
  const bedrag_sent = Math.round(Number(invoer.bedrag_sent));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return { statusCode: 400, body: "Gee die datum." };
  }
  if (datum > dag_vandag()) {
    return { statusCode: 400, body: "Die datum lê in die toekoms." };
  }
  if (!beskrywing) {
    return { statusCode: 400, body: "Gee 'n beskrywing." };
  }
  if (!Number.isFinite(bedrag_sent) || bedrag_sent <= 0) {
    return { statusCode: 400, body: "Gee die bedrag." };
  }

  const store = kry_joernaal_store();
  const nou = new Date().toISOString();
  const wie_teken_aan = (gebruiker && gebruiker.email) || "";

  const sleutel_in = teks(invoer.sleutel, 80);
  let rekord;

  if (sleutel_in) {
    try {
      rekord = await store.get(sleutel_in, { type: "json" });
    } catch (fout) {
      console.error(`Kon nie joernaalinskrywing ${sleutel_in} lees nie:`, fout);
      return { statusCode: 500, body: "Kon nie die inskrywing laai nie" };
    }
    if (!rekord) return { statusCode: 404, body: "Inskrywing nie gevind nie" };
  } else {
    rekord = nuwe_inskrywing();
    rekord.geskep_deur = wie_teken_aan;
  }

  rekord.datum = datum;
  rekord.beskrywing = beskrywing;
  rekord.wie = teks(invoer.wie, WIE_MAKS);
  rekord.nota = teks(invoer.nota, NOTA_MAKS);
  rekord.bedrag_sent = bedrag_sent;
  rekord.rigting = rigting;

  // GEEN KONTROLE DAT DIE KATEGORIE BESTAAN NIE, en dit is 'n keuse.
  //
  // 'n Lees van die kategorieregister by elke stoor sou hierdie Function op 'n
  // tweede store laat wag om 'n fout te keer wat die skerm reeds keer -- die
  // keuselys bied slegs bestaande kategoriee aan.
  //
  // En 'n kategorie word nooit uitgevee terwyl sy gebruik word nie: dit is
  // presies wat skrap-fin-kategorie.js se poorte doen. 'n Verwysing na iets
  // wat nie bestaan nie, kan dus nie deur normale gebruik ontstaan nie.
  rekord.kategorie_id = teks(invoer.kategorie_id, 120);

  rekord.bygewerk_op = nou;

  // DIE JAAR STAAN IN DIE SLEUTEL, dus moet die sleutel verander wanneer 'n
  // wysiging die datum oor 'n jaargrens skuif. Bly die ou sleutel staan, lees
  // kry-joernaal.js die inskrywing in die VERKEERDE jaar -- en 'n mens sou dit
  // eers by jaareinde agterkom, wanneer die totale nie klop nie.
  //
  // Die ou jaar word uit die SLEUTEL gelees, nie uit die rekord se datum nie:
  // daardie veld is 'n paar reels hierbo reeds oorgeskryf.
  const jaar_nou = finansiele_jaar(datum);
  const jaar_oud = sleutel_in ? Number(sleutel_in.split("-")[1]) : null;
  const moet_skuif = Boolean(sleutel_in) && jaar_oud !== jaar_nou;

  rekord.sleutel = sleutel_in && !moet_skuif ? sleutel_in : skep_sleutel(datum);

  try {
    await store.setJSON(rekord.sleutel, rekord);
    // Skryf eers die nuwe, dan skrap die ou. Misluk die skrap, staan die
    // inskrywing twee keer -- irriterend maar sigbaar. Andersom sou dit
    // verdwyn.
    if (moet_skuif) await store.delete(sleutel_in);
  } catch (fout) {
    console.error("Kon nie die joernaalinskrywing stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die inskrywing stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sleutel: rekord.sleutel, jaar: finansiele_jaar(datum) }),
  };
};
