// netlify/functions/skrap-toetse.js
//
// Vee ALLE toetsprojekte en toetskliënte in een handeling uit. Rol: boekhouding.
//
// DIESELFDE PATROON AS DIE STUDIEVAARDIGHEIDSPANEEL SE "Skrap alle
// toetsregistrasies": 'n toets is 'n bewuste merk op die rekord self, die knoppie
// word met getikte woorde oopgesluit, en die bediener toets die woorde weer.
//
// WAT 'N TOETS IS: 'n naam wat met TOETS begin (hoofletters, woordgrens). Vir
// kliënte geld dit ongeag die rol wat hulle speel: befondser, skenker, of die
// kliënt op 'n toetsfaktuur.
//
// WAT BLY STAAN, EN WAAROM
//
//   'n Toetskliënt met 'n faktuur of kwotasie, ook 'n konsep. skrap-klient.js
//   se reel: 'n uitgereikte faktuur dra sy kliënt se besonderhede, en 'n
//   konsep word 'n faktuur. Dit word gerapporteer, nie stil oorgeslaan nie.
//
//   'n Toetskliënt wat befondser van 'n REGTE projek is. Dan het iemand 'n
//   regte projek aan 'n toetskliënt gekoppel, en dit is 'n vraag vir 'n mens.
//
// VOLGORDE: eers word alles gelees en besluit, dan uitgevee. 'n Leesfout
// halfpad stop die hele handeling voordat een rekord weg is.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_kliente_store } = require("./_kliente");
const { kry_fakture_store } = require("./_fakture");
const { kry_projekte_store, lees_almal, is_toets_naam } = require("./_projekte");

const ROLLE = ["boekhouding"];
const WOORDE = "SKRAP TOETSE";

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
  if (String(invoer.woorde || "").trim() !== WOORDE) {
    return { statusCode: 400, body: `Tik ${WOORDE} om te bevestig` };
  }

  const pstore = kry_projekte_store();
  const kstore = kry_kliente_store();

  let projekte, kliente, gefaktureer;
  try {
    projekte = await lees_almal(pstore);

    const { blobs } = await kstore.list({ prefix: "K" });
    kliente = (
      await Promise.all((blobs || []).map((b) => kstore.get(b.key, { type: "json" })))
    ).filter(Boolean);

    // Elke kliënt waarna 'n faktuur, kwotasie of konsep wys.
    const fstore = kry_fakture_store();
    const { blobs: fblobs } = await fstore.list();
    const fakture = (
      await Promise.all((fblobs || []).map((b) => fstore.get(b.key, { type: "json" })))
    ).filter(Boolean);
    gefaktureer = new Set(fakture.map((f) => f.klient_id).filter(Boolean));
  } catch (fout) {
    console.error("Kon nie lees voor die skrap van toetse nie:", fout);
    return { statusCode: 503, body: "Kon nie die registers lees nie. Niks is uitgevee nie." };
  }

  const toetsprojekte = projekte.filter((p) => is_toets_naam(p.naam));
  const op_regte_projek = new Set();
  projekte
    .filter((p) => !is_toets_naam(p.naam))
    .forEach((p) => (p.befondsers || []).forEach((n) => op_regte_projek.add(n)));

  const toetskliente = kliente.filter((k) => is_toets_naam(k.naam));
  const uitvee_kliente = [];
  const bly = [];
  toetskliente.forEach((k) => {
    if (gefaktureer.has(k.nommer)) {
      bly.push(`${k.nommer} ${k.naam}: het 'n faktuur of kwotasie`);
    } else if (op_regte_projek.has(k.nommer)) {
      bly.push(`${k.nommer} ${k.naam}: befondser van 'n regte projek`);
    } else {
      uitvee_kliente.push(k);
    }
  });

  let projekte_weg = 0;
  let kliente_weg = 0;
  const foute = [];

  for (const p of toetsprojekte) {
    try {
      await pstore.delete(p.id);
      projekte_weg += 1;
    } catch (fout) {
      console.error(`Kon nie toetsprojek "${p.id}" uitvee nie:`, fout);
      foute.push(p.naam);
    }
  }
  for (const k of uitvee_kliente) {
    try {
      await kstore.delete(k.nommer);
      kliente_weg += 1;
    } catch (fout) {
      console.error(`Kon nie toetskliënt ${k.nommer} uitvee nie:`, fout);
      foute.push(`${k.nommer} ${k.naam}`);
    }
  }

  console.log(
    `Toetse geskrap deur ${gebruiker.email || ""}: ${projekte_weg} projekte, ${kliente_weg} kliënte`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projekte: projekte_weg, kliente: kliente_weg, bly, foute }),
  };
};
