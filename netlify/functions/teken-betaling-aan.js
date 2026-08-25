// netlify/functions/teken-betaling-aan.js
//
// Teken 'n betaling aan wat NIE deur die betaalskakel gekom het nie. Rol:
// boekhouding.
//
// HOEKOM DIT BESTAAN
//
// Die betaalskakel is die pad wat ons aanbied, en die webhook teken daardie
// betalings self aan. Maar 'n skool betaal soms eenvoudig in die rekening in —
// hulle vra vir bankbesonderhede, of hulle betaal teen 30 dae soos hulle nog
// altyd gedoen het. Die geld is dan werklik daar en `uitbetalings[]` word
// SLEGS deur die webhook geskryf. Sonder hierdie Function bly so 'n faktuur
// vir altyd in Gestuur staan en die staat lieg.
//
// Dit is 'n REGSTELLING NÁ DIE FEIT, nie 'n werkvloei wat aan die kliënt
// aangebied word nie. Die dokument dra een betaalpad: die skakel.
//
// ─────────────────────────────────────────────────────────────────────────
// EEN VOLLE BETALING. GEEN PAAIEMENTE.
//
// Wil 'n kliënt in dele betaal, word DRIE FAKTURE uitgereik — elkeen met sy
// eie nommer, sy eie skakel en sy eie split. Elke een loop dan die normale
// pad van begin tot end.
//
// Paaiemente op EEN faktuur is oorweeg en verwerp. Die gevriesde verdeling is
// 'n flat-tipe split: vaste rande per ontvanger, opgetel teen die volle
// faktuur. Sy pas op niks anders as die volle bedrag nie, en 'n split wat per
// paaiement herbereken word, laat sente wegraak oor die afrondings.
// ─────────────────────────────────────────────────────────────────────────
//
// DIE VERDELING WORD NIE HERBEREKEN NIE, net soos in die webhook. Sy is by
// uitreiking gevries en sy is die rekord van wat besluit is.
//
// MAAR ELKE RY IS HIER `uitstaande`, OOK 'N `split`-RY.
//
// Dit is die enigste plek waar hierdie lêer van die webhook verskil, en dit
// is die belangrikste reël hierin. In die webhook beteken `pad === "split"`
// dat Paystack die geld reeds na daardie begunstigde se subrekening gestuur
// het. Hier het Paystack NIKS gedoen nie — die geld het direk in die
// hoofrekening geland. 'n Ry as `direk_uitbetaal` te merk, sou beteken die
// begunstigde is betaal terwyl niemand hom betaal het nie, en hy sou nooit in
// die uitbetaal-werklys verskyn nie. Die geld sou stilweg by Future Sharp
// bly lê.
//
// DIE BEDRAG WORD AANGETEKEN SOOS DIT ONTVANG IS. Betaal die skool R9 950 op
// 'n faktuur van R10 000, word R9 950 gestoor en die verskil gemerk — nooit
// stilweg reggemaak nie. Dieselfde reël as die webhook s'n.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fakture_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
  voeg_geskiedenis_by,
} = require("./_fakture");
const { kry_maatskappy } = require("./_instellings");
const {
  stuur_kwitansie,
  stuur_state,
  stuur_kennisgewing,
} = require("./_faktuur-betaling");

// Die verwysing op die bankstaat. Dit is hoe hierdie inskrywing ses maande
// later teen die staat versoen word; sonder dit is die aantekening 'n bewering
// sonder bewys.
const VERWYSING_MIN = 2;
const VERWYSING_MAKS = 100;
const NOTA_MAKS = 300;

function rand(sent) {
  const n = Math.round(Number(sent) || 0);
  const heel = Math.floor(Math.abs(n) / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return (n < 0 ? "-" : "") + "R" + heel + "," + String(Math.abs(n) % 100).padStart(2, "0");
}

// Die skerm stuur 'n datum, nie 'n oomblik nie — 'n mens weet wanneer die geld
// gewys het, nie op watter sekonde nie. Middag UTC sodat die dag nie in SAST
// (UTC+2) na gister toe skuif wanneer dit gedruk word.
function datum_na_iso(dag) {
  return `${dag}T12:00:00.000Z`;
}

// VANDAG SE DATUM IN ONS TYD, nie in UTC nie. Die bediener loop op UTC; om
// 09:00 in Pretoria is dit dáár nog 07:00, maar dit is dieselfde dag. Waar
// dit stukkend gaan, is die aand: om 01:00 SAST is dit in UTC nog gister,
// en dan sou "vandag" as toekoms gelees word.
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

  const sleutel = String(invoer.sleutel || "").trim();
  const ontvang_sent = Math.round(Number(invoer.ontvang_sent));
  const dag = String(invoer.ontvang_op || "").trim();
  const verwysing = String(invoer.verwysing || "").trim().slice(0, VERWYSING_MAKS);
  const nota = String(invoer.nota || "").trim().slice(0, NOTA_MAKS);

  if (!sleutel || is_konsep_sleutel(sleutel) || !sleutel_na_nommer(sleutel)) {
    return { statusCode: 400, body: "Ongeldige sleutel" };
  }
  if (!Number.isFinite(ontvang_sent) || ontvang_sent <= 0) {
    return { statusCode: 400, body: "Gee die bedrag wat ontvang is." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) {
    return { statusCode: 400, body: "Gee die datum waarop die geld ontvang is." };
  }
  if (verwysing.length < VERWYSING_MIN) {
    return { statusCode: 400, body: "Gee die verwysing soos dit op die bankstaat lees." };
  }

  const store = kry_fakture_store();
  const nou = new Date().toISOString();
  const wie = (gebruiker && gebruiker.email) || "";

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };

  // ── Wat nie aangeteken kan word nie ────────────────────────────────────

  if (rekord.stand === "konsep") {
    return {
      statusCode: 409,
      body: "Hierdie faktuur is nog nie uitgereik nie. Daar is niks om teen te betaal nie.",
    };
  }
  if (rekord.stand === "betaal") {
    return {
      statusCode: 409,
      body: "Hierdie faktuur is reeds betaal. Kom daar 'n tweede betaling in, is dit 'n dubbelbetaling en moet met die hand hanteer word.",
    };
  }

  // 'N GEKANSELLEERDE FAKTUUR WORD NIE HIER OPGEWEK NIE.
  //
  // Die webhook doen wél 'n betaling op 'n gekanselleerde faktuur aanteken,
  // want dáár het die geld reeds sonder ons toedoen ingekom en die verdeling
  // het klaar gebeur — 'n 200 wat niks doen nie, sou 'n betaling laat
  // verdwyn. Hier is dit andersom: 'n mens sit met die keuse voor hom. Die
  // faktuur is doodgemaak en die rede staan aangeteken; om hom nou betaal te
  // maak, sou daardie besluit stilweg omkeer. Reik 'n nuwe faktuur uit vir
  // die geld wat werklik ontvang is.
  if (rekord.stand === "gekanselleer") {
    return {
      statusCode: 409,
      body: "Hierdie faktuur is gekanselleer. Reik 'n nuwe faktuur uit vir die geld wat ontvang is.",
    };
  }

  // DAE WORD MET DAE VERGELYK, NOOIT MET TYE NIE.
  //
  // Die eerste weergawe het die ontvangs as middag UTC gestoor en dit teen
  // `uitgereik_op` se volle tydstempel gemeet. 'n Faktuur wat ná 14:00 ons
  // tyd uitgereik is, het toe elke betaling van daardie dag geweier — die
  // middag was "voor" die uitreiking. Die dag is al wat hier saak maak.
  const dag_iso = datum_na_iso(dag);
  if (dag > dag_vandag()) {
    return { statusCode: 400, body: "Die datum lê in die toekoms." };
  }
  if (rekord.uitgereik_op && dag < String(rekord.uitgereik_op).slice(0, 10)) {
    return {
      statusCode: 400,
      body: "Die datum lê voor die faktuur uitgereik is.",
    };
  }

  // ── Die aantekening ────────────────────────────────────────────────────

  const verwag_sent = Number(rekord.totaal_sent) || 0;
  const verskil = ontvang_sent - verwag_sent;

  rekord.betaling = {
    metode: "bankoorbetaling",
    ontvang_sent,
    ontvang_op: dag_iso,
    verwysing,
    kanaal: "",
    aangeteken_deur: wie,
    nota:
      (verskil !== 0 ? `Bedrag verskil van die faktuur met ${rand(verskil)}. ` : "") + nota,
  };

  rekord.stand = "betaal";
  rekord.bygewerk_op = nou;

  // ELKE RY WAG. Sien die kop: Paystack was nooit hier nie, dus is daar geen
  // ry wat reeds oppad is na iemand se bank nie.
  const gevries = rekord.verdeling_gevries || {};
  rekord.uitbetalings = (gevries.rye || []).map((r) => ({
    ontvanger: r.naam,
    begunstigde_id: r.begunstigde_id || null,
    bedrag_sent: r.bedrag_sent,
    stand: "uitstaande",
    betaal_op: null,
    verwysing: "",
    deur: "",
  }));

  voeg_geskiedenis_by(
    rekord,
    "betaal",
    wie,
    `${rand(ontvang_sent)} — bankoorbetaling, ${verwysing}` +
      (verskil !== 0 ? ` (verskil ${rand(verskil)})` : "")
  );

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error(`Kon nie die betaling op ${sleutel} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die betaling aanteken nie" };
  }

  console.log(
    `Faktuur ${rekord.nommer || sleutel} met die hand op betaal gestel deur ${wie} — ` +
      `${rand(ontvang_sent)}, bankoorbetaling, ${verwysing}`
  );

  // ── Die eposse ─────────────────────────────────────────────────────────
  //
  // DIESELFDE DRIE AS DIE WEBHOOK, uit dieselfde lêer. Twee kopieë sou beteken
  // 'n mens verander die een en wonder hoekom die ander anders lees.
  //
  // Elkeen in sy eie try/catch binne-in; die faktuur is klaar gestoor en 'n
  // pos wat misluk mag dit nie ongedaan maak nie.
  let maatskappy = null;
  try {
    maatskappy = await kry_maatskappy();
  } catch (fout) {
    console.error("Handmatige betaling: kon nie die instelling lees nie:", fout);
  }

  await stuur_kwitansie(rekord);
  await stuur_state(rekord);
  await stuur_kennisgewing(rekord, maatskappy, false);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sleutel,
      stand: rekord.stand,
      ontvang_sent,
      verskil,
      uitstaande_rye: rekord.uitbetalings.filter((r) => r.bedrag_sent > 0).length,
    }),
  };
};
