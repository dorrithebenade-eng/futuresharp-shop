// netlify/functions/skrap-fin-kategorie.js
//
// Vee een finansiele kategorie uit. Rol: boekhouding.
//
// DIE REEL IS "GEEN SKRAP NIE", EN HIERDIE LEER IS NIE 'N UITSONDERING DAAROP.
//
// Die reel bestaan om HISTORIESE BEDRAE te beskerm. "Reis koste" — 'n spelfout
// wat 'n maand lank gebruik is — moet bly bestaan en onder "Reiskoste" gesit
// word, sodat 'n staat wat verlede maand uitgegaan het, vandag nog dieselfde
// lees.
//
// Is daar egter GEEN bedrag nie, beskerm die reel niks. Dan is dit bloot 'n
// tikfout van 'n minuut gelede.
//
// TWEE POORTE, EN 'N MENS MOET DEUR ALBEI:
//
//   1. Die kategorie dra die TOETSSTEMPEL, of sy word deur niks gebruik nie.
//
//   2. Sy het geen SUBKATEGORIEE nie. 'n Ouer wat verdwyn, laat haar kinders
//      as weeskinders agter; hulle bly sigbaar op vlak 1, maar die boom wat
//      iemand gebou het, is stukkend sonder dat hy dit gevra het.
//
// EN DIE VASTE TWEE NOOIT. Diensinkomste en Paystack se transaksiefooi word
// deur die stelsel geskryf en die staat verwys direk na hul id's.
//
// WAT "GEBRUIK" BETEKEN
//
// Twee plekke wys na 'n kategorie: 'n werk-item in die register van werk en
// uitgawes, en 'n joernaalinskrywing. Albei word gelees voordat daar uitgevee
// word.
//
// 'n LEESFOUT OP EEN VAN DIE TWEE KEER DIE SKRAP. Dit is die veilige rigting:
// misluk die lees en gaan ons voort, vee ons moontlik 'n kategorie uit wat wel
// gebruik word, en dan wys 'n inskrywing na iets wat nie meer bestaan nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const {
  kry_fin_kategoriee_store,
  VAS,
  is_toetsfase,
} = require("./_fin-kategoriee");

const ROLLE = ["boekhouding"];

// Tel hoeveel inskrywings na hierdie kategorie wys. Gooi op 'n leesfout —
// die oproeper moet dan STOP, nie voortgaan nie.
// DIE FAKTUURREELS TEL SAAM.
//
// Sedert 4 September 2026 dra elke faktuur- en kwotasiereel 'n `kategorie_id`.
// Sou hulle nie hier tel nie, kon 'n kategorie geskrap word waarna 'n
// UITGEREIKTE faktuur wys -- en daardie faktuur is gevries en kan nie
// reggemaak word nie. Die staat sou dan 'n bedrag onder 'n kategorie wys wat
// nie meer bestaan nie.
//
// Dit lees elke rekord in die faktuurstore. Dieselfde prestasiekwessie as
// kry-joernaal.js, en om dieselfde rede aanvaarbaar: skrap gebeur selde, en
// die alternatief is 'n stukkende verwysing.
async function tel_verwysings(id) {
  let werk = 0;
  let joernaal = 0;
  let reels = 0;

  const werk_store = kry_store("werk-items");
  const { blobs: werk_blobs } = await werk_store.list();
  const werk_items = (
    await Promise.all((werk_blobs || []).map((b) => werk_store.get(b.key, { type: "json" })))
  ).filter(Boolean);
  werk = werk_items.filter((w) => w && w.kategorie_id === id).length;

  const jn_store = kry_store("joernaal");
  const { blobs: jn_blobs } = await jn_store.list();
  const jn_items = (
    await Promise.all((jn_blobs || []).map((b) => jn_store.get(b.key, { type: "json" })))
  ).filter(Boolean);
  joernaal = jn_items.filter((r) => r && r.kategorie_id === id).length;

  // Fakture en kwotasies leef in DIESELFDE store, met verskillende
  // voorvoegsels op die sleutel. Ons tel albei: 'n kwotasie word later 'n
  // faktuur, en 'n verwysing wat dan breek, breek op die verkeerde oomblik.
  const fk_store = kry_store("fakture");
  const { blobs: fk_blobs } = await fk_store.list();
  const fk_items = (
    await Promise.all((fk_blobs || []).map((b) => fk_store.get(b.key, { type: "json" })))
  ).filter(Boolean);
  for (const dok of fk_items) {
    if (!dok || !Array.isArray(dok.reels)) continue;
    reels += dok.reels.filter((r) => r && r.kategorie_id === id).length;
  }

  return { werk, joernaal, reels, totaal: werk + joernaal + reels };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const id = String(invoer.id || "").trim();
  if (!id) return { statusCode: 400, body: "Verpligte veld: id" };

  if (VAS[id]) {
    return {
      statusCode: 409,
      body: "Hierdie kategorie word deur die stelsel geskryf en kan nie uitgevee word nie.",
    };
  }

  const store = kry_fin_kategoriee_store();

  let almal = [];
  let kategorie = null;
  try {
    const { blobs } = await store.list();
    almal = (
      await Promise.all((blobs || []).map((b) => store.get(b.key, { type: "json" })))
    ).filter(Boolean);
    kategorie = almal.find((k) => k.id === id) || null;
  } catch (fout) {
    console.error("Kon nie die kategoriee lees voor die skrap nie:", fout);
    return { statusCode: 500, body: "Kon nie die kategoriee laai nie" };
  }

  if (!kategorie) return { statusCode: 404, body: "Kategorie nie gevind nie" };
  if (kategorie.vas) {
    return {
      statusCode: 409,
      body: "Hierdie kategorie word deur die stelsel geskryf en kan nie uitgevee word nie.",
    };
  }

  // ── Poort 2: geen subkategoriee ─────────────────────────────────────────
  const kinders = almal.filter((k) => k.onder === id);
  if (kinders.length) {
    return {
      statusCode: 409,
      body: `Hierdie kategorie het ${kinders.length} subkategorie${kinders.length === 1 ? "" : "e"}. Skuif hulle eers weg.`,
    };
  }

  // ── Poort 1: toetsstempel, of ongebruik ─────────────────────────────────
  let verwysings;
  try {
    verwysings = await tel_verwysings(id);
  } catch (fout) {
    console.error(`Kon nie die verwysings na "${id}" tel nie:`, fout);
    return {
      statusCode: 500,
      body: "Kon nie nagaan of die kategorie gebruik word nie. Niks is uitgevee nie.",
    };
  }

  const dra_stempel = kategorie.toets === true && is_toetsfase();
  if (!dra_stempel && verwysings.totaal > 0) {
    return {
      statusCode: 409,
      body: `Hierdie kategorie word deur ${verwysings.totaal} inskrywing${verwysings.totaal === 1 ? "" : "s"} gebruik. Sit haar eerder onder 'n ander kategorie.`,
    };
  }

  try {
    await store.delete(id);
  } catch (fout) {
    console.error(`Kon nie kategorie "${id}" uitvee nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kategorie uitvee nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, uitgevee: true, verwysings: verwysings.totaal }),
  };
};
