// netlify/functions/skrap-toetse.js
// Weergawe 4 (25 September 2026): en hul koppelings.
// Weergawe 3: hul bewysstukke gaan ook saam weg.
// Weergawe 2: toekennings op toetsprojekte gaan saam, en
// 'n toetsbefondser met 'n toekenning op 'n regte projek bly staan.
//
// Vee ALLE toetsprojekte, toetskliënte, toetsbefondsers en -skenkers en
// toetsbefondsingsoorte in een handeling uit. Rol: boekhouding.
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
const { kry_befondsers_store, lees_almal: lees_befondsers } = require("./_befondsers");
const { kry_soorte_store, SAAD_SLEUTEL } = require("./_befondsingsoorte");
const { kry_bankstate_store } = require("./_bankstate");
const { kry_toekennings_store, lees_almal: lees_toekennings } = require("./_toekennings");
const { vee_uit_vir } = require("./_bewysstukke");
const { kry_koppelings_store, lees_almal: lees_koppelings, sleutel_van } = require("./_koppelings");
const { kry_joernaal_store } = require("./_joernaal");

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

  const bstore = kry_befondsers_store();
  const sstore = kry_soorte_store();

  let projekte, kliente, gefaktureer, befondsers, soorte;
  try {
    projekte = await lees_almal(pstore);
    befondsers = await lees_befondsers(bstore);
    // Net die GESTOORDE soorte: 'n voorgelaaide soort is nooit 'n toets nie.
    const { blobs: sblobs } = await sstore.list();
    soorte = (
      await Promise.all((sblobs || []).filter((b) => b.key !== SAAD_SLEUTEL)
        .map((b) => sstore.get(b.key, { type: "json" })))
    ).filter(Boolean);

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
  let befondsers_weg = 0;
  let soorte_weg = 0;
  let state_weg = 0;
  const foute = [];

  // TOETSSTATE, saam met die joernaalinskrywings wat uit hul reels geskep is.
  // Hul sleutels begin met B-T; 'n regte staat se sleutel nie.
  try {
    const bs = kry_bankstate_store();
    const js = kry_joernaal_store();
    const { blobs } = await bs.list({ prefix: "B-T" });
    for (const b of blobs || []) {
      const staat = await bs.get(b.key, { type: "json" });
      if (!staat || staat.toets !== true) continue;
      for (const r of staat.reels || []) {
        if (r.stand === "toegewys" && r.joernaal_sleutel) await js.delete(r.joernaal_sleutel);
      }
      await bs.delete(b.key);
      state_weg += 1;
    }
  } catch (fout) {
    console.error("Kon nie die toetsstate uitvee nie:", fout);
    foute.push("toetsstate");
  }

  // Toekennings: die op toetsprojekte gaan weg. 'n Toetsbefondser met 'n
  // toekenning op 'n REGTE projek bly staan; iemand het 'n regte projek aan 'n
  // toets gekoppel, en dit is 'n vraag vir 'n mens.
  const toetsprojek_ids = new Set(projekte.filter((p) => is_toets_naam(p.naam)).map((p) => p.id));
  const bf_op_regte = new Set();
  try {
    const kstore = kry_koppelings_store();
    for (const k of await lees_koppelings(kstore)) {
      if (toetsprojek_ids.has(k.projek_id)) await kstore.delete(sleutel_van(k.id));
    }
    const tstore = kry_toekennings_store();
    for (const t of await lees_toekennings(tstore)) {
      if (toetsprojek_ids.has(t.projek_id)) {
        await vee_uit_vir(t);
        await tstore.delete(t.id);
      }
      else bf_op_regte.add(t.befondser);
    }
  } catch (fout) {
    console.error("Kon nie die toekennings van toetsprojekte uitvee nie:", fout);
    foute.push("toekennings");
  }

  for (const b of befondsers.filter((x) => is_toets_naam(x.naam))) {
    if (bf_op_regte.has(b.nommer)) {
      bly.push(`${b.nommer} ${b.naam}: befondser op 'n regte projek`);
      continue;
    }
    try {
      await bstore.delete(b.nommer);
      befondsers_weg += 1;
    } catch (fout) {
      console.error(`Kon nie toetsbefondser ${b.nommer} uitvee nie:`, fout);
      foute.push(`${b.nommer} ${b.naam}`);
    }
  }
  for (const s of soorte.filter((x) => is_toets_naam(x.naam))) {
    try {
      await sstore.delete(s.id);
      soorte_weg += 1;
    } catch (fout) {
      console.error(`Kon nie toetssoort "${s.id}" uitvee nie:`, fout);
      foute.push(s.naam);
    }
  }

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
    `Toetse geskrap deur ${gebruiker.email || ""}: ${projekte_weg} projekte, ${kliente_weg} kliënte, ` +
    `${befondsers_weg} befondsers en skenkers, ${soorte_weg} befondsingsoorte, ${state_weg} toetsstate`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projekte: projekte_weg, kliente: kliente_weg,
      befondsers: befondsers_weg, soorte: soorte_weg, state: state_weg, bly, foute,
    }),
  };
};
