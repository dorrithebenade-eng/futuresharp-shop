// netlify/functions/eenmalig-stel-uitgawetak.js
//
// TYDELIK. HIERDIE LÊER WORD DIESELFDE DAG WEER VERWYDER.
//
// ─────────────────────────────────────────────────────────────────────────
// WAT HY DOEN
//
// Bring die finansiële kategorieë in lyn met hoe 'n NPC se staat gelees word:
//
//   Inkomste
//     Diensinkomste                         (bestaan; stelsel)
//     Skenkings en donasies                 NUUT
//   Direkte projekkoste                     NUUT
//     Vergoeding vir dienste                NUUT
//     Aanbiedings                           geskuif
//     Akkommodasie                          geskuif + hernoem
//     Reiskoste                             geskuif (kinders volg vanself)
//   Administrasie- en bedryfskoste          NUUT
//     Bankkoste                             NUUT
//       Paystack — transaksiefooi           geskuif
//
// WAAROM 'n eenmalige Function en nie sewe handstappe nie: die volgorde maak
// saak (die ouers moet eerste bestaan), en 'n halwe boom is erger as geen.
//
// ─────────────────────────────────────────────────────────────────────────
// WAT HY NIE DOEN NIE
//
//   Hy VEE NIKS UIT NIE. Hy skep en hy skuif, en niks anders.
//   Hy raak nie een INKOMSTEkategorie aan nie, behalwe om een nuwe by te voeg.
//   Hy verander geen `rigting` en geen `gedek_deur_hosting` nie.
//   'n Kategorie wat reeds op sy plek is, word oorgeslaan en so gerapporteer.
//
// DIE ID VERANDER NOOIT. `Akkomodasie` word hernoem na `Akkommodasie`, maar
// haar id bly `akkomodasie` -- 'n uitgereikte faktuur en 'n joernaalinskrywing
// wys daarheen. Dit is presies waarom die id nie die naam is nie.
//
// TWEE SLOTTE: die rol `boekhouding`, en 'n wagwoord in die liggaam.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fin_kategoriee_store,
  maak_slug,
  nuwe_kategorie,
} = require("./_fin-kategoriee");

const WAGWOORD = "stel-die-uitgawetak";

// Wat geskep moet word, in hierdie volgorde: 'n ouer moet bestaan voordat sy
// kind na haar kan wys.
const SKEP = [
  { naam: "Skenkings en donasies", rigting: "in", onder: "",
    nota: "Nie diensinkomste nie. 'n NPC rapporteer skenkings apart." },
  { naam: "Direkte projekkoste", rigting: "uit", onder: "",
    nota: "Uitgawes wat aan 'n projek vaskleef: loop hierdie uitgawe saam met 'n faktuur?" },
  { naam: "Vergoeding vir dienste", rigting: "uit", onder: "direkte-projekkoste",
    nota: "Wat aan iemand betaal word vir werk gelewer. Nie 'n uitkering van surplus nie." },
  { naam: "Administrasie- en bedryfskoste", rigting: "uit", onder: "",
    nota: "Loop of daar werk is of nie." },
  { naam: "Bankkoste", rigting: "uit", onder: "administrasie-en-bedryfskoste",
    nota: "" },
];

// Wat geskuif word: id -> nuwe ouer. Die naam skuif saam waar hy verkeerd is.
const SKUIF = [
  { id: "aanbiedings", onder: "direkte-projekkoste" },
  { id: "akkomodasie", onder: "direkte-projekkoste", nuwe_naam: "Akkommodasie" },
  { id: "reiskoste", onder: "direkte-projekkoste" },
  { id: "paystack-transaksiefooi", onder: "bankkoste" },
];

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
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  if (invoer.bevestig !== WAGWOORD) {
    return { statusCode: 400, body: "Geen bevestiging nie" };
  }

  const store = kry_fin_kategoriee_store();
  const wie = (gebruiker && gebruiker.email) || "onbekend";
  const uitslag = [];

  // ── Skep ────────────────────────────────────────────────────────────────
  for (const wat of SKEP) {
    const id = maak_slug(wat.naam);
    let bestaande = null;
    try {
      bestaande = await store.get(id, { type: "json" });
    } catch {
      bestaande = null;
    }
    if (bestaande) {
      uitslag.push({ id, doen: "bestaan reeds" });
      continue;
    }

    const rekord = nuwe_kategorie();
    rekord.id = id;
    rekord.naam = wat.naam;
    rekord.onder = wat.onder;
    rekord.rigting = wat.rigting;
    rekord.nota = wat.nota;
    rekord.geskep_deur = wie;

    try {
      await store.setJSON(id, rekord);
      uitslag.push({ id, doen: "geskep", naam: wat.naam, onder: wat.onder || "(hoof)" });
    } catch (fout) {
      console.error(`Kon nie ${id} skep nie:`, fout);
      uitslag.push({ id, doen: "skryffout" });
    }
  }

  // ── Skuif ───────────────────────────────────────────────────────────────
  for (const wat of SKUIF) {
    let rekord = null;
    try {
      rekord = await store.get(wat.id, { type: "json" });
    } catch {
      rekord = null;
    }
    if (!rekord) {
      uitslag.push({ id: wat.id, doen: "nie gevind nie" });
      continue;
    }

    const was_onder = rekord.onder || "(hoof)";
    const was_naam = rekord.naam;

    rekord.onder = wat.onder;
    if (wat.nuwe_naam) rekord.naam = wat.nuwe_naam;
    rekord.bygewerk_op = new Date().toISOString();

    try {
      await store.setJSON(wat.id, rekord);
      uitslag.push({
        id: wat.id,
        doen: "geskuif",
        van: was_onder,
        na: wat.onder,
        naam: was_naam === rekord.naam ? rekord.naam : `${was_naam} -> ${rekord.naam}`,
      });
    } catch (fout) {
      console.error(`Kon nie ${wat.id} skuif nie:`, fout);
      uitslag.push({ id: wat.id, doen: "skryffout" });
    }
  }

  console.log(`EENMALIG: uitgawetak gestel deur ${wie}`);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uitslag }),
  };
};
