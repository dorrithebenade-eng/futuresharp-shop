// netlify/functions/eenmalig-skoon-toetsdata.js
//
// TYDELIK. HIERDIE LÊER WORD DIESELFDE DAG WEER VERWYDER.
//
// ─────────────────────────────────────────────────────────────────────────
// WAT HY DOEN
//
// Vee elke faktuur en elke kwotasie uit wat die TOETSSTEMPEL dra.
//
// skrap-faktuur.js en skrap-kwotasie.js weier 'n AANVAARDE kwotasie en 'n
// uitgereikte faktuur ook wanneer die stempel daar is — die eerste omdat 'n
// faktuur na haar verwys, die tweede omdat 'n gaping in die nommerreeks
// sigbaar moet wees. Albei reëls is reg vir werklike data en bly onaangeraak.
//
// Hier is die hele stel toetsdata, en die stempel is presies die merk wat sê
// dit mag weg.
//
// ─────────────────────────────────────────────────────────────────────────
// TWEE STAPPE, EN DIE EERSTE VEE NIKS UIT NIE
//
//   Sonder `bevestig` gee hy net 'n LYS van wat hy sou uitvee.
//   Met `bevestig` vee hy hulle uit.
//
// Dit is die enigste manier om te sien wat weggaan voordat dit weg is. 'n
// Lys van name is goedkoper as 'n herstel wat nie bestaan nie.
//
// HY RAAK NIKS ANDERS NIE: geen klient, geen begunstigde, geen kategorie,
// geen werk-item, geen joernaalinskrywing.
//
// DIE NOMMERREEKS SPRING TERUG. skep_nommer() lees die hoogste bestaande
// sleutel; is alles weg, begin die volgende faktuur weer by FS/01961.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store } = require("./_fakture");
const { kry_kwotasies_store } = require("./_kwotasies");

const WAGWOORD = "vee-alle-toetsdata-uit";

async function versamel(store, soort) {
  const uit = [];
  let blobs = [];
  try {
    ({ blobs } = await store.list());
  } catch (fout) {
    console.error(`Kon nie ${soort} lys nie:`, fout);
    return uit;
  }
  for (const b of blobs || []) {
    let rekord = null;
    try {
      rekord = await store.get(b.key, { type: "json" });
    } catch {
      rekord = null;
    }
    if (!rekord || rekord.toets !== true) continue;
    uit.push({
      soort,
      sleutel: b.key,
      nommer: rekord.nommer || null,
      stand: rekord.stand || "",
      klient: (rekord.klient && rekord.klient.naam) || "",
      totaal_sent: rekord.totaal_sent || 0,
    });
  }
  return uit;
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
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const f_store = kry_fakture_store();
  const k_store = kry_kwotasies_store();

  const lys = [
    ...(await versamel(f_store, "faktuur")),
    ...(await versamel(k_store, "kwotasie")),
  ];

  // STAP EEN: net kyk.
  if (invoer.bevestig !== WAGWOORD) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sou_uitvee: lys.length,
        lys,
        volgende: `Stuur weer met { "bevestig": "${WAGWOORD}" } om hulle uit te vee.`,
      }),
    };
  }

  // STAP TWEE: uitvee.
  const uitslag = [];
  for (const item of lys) {
    const store = item.soort === "faktuur" ? f_store : k_store;
    try {
      await store.delete(item.sleutel);
      uitslag.push({ sleutel: item.sleutel, doen: "geskrap" });
    } catch (fout) {
      console.error(`Kon nie ${item.sleutel} skrap nie:`, fout);
      uitslag.push({ sleutel: item.sleutel, doen: "skrapfout" });
    }
  }

  console.log(
    `EENMALIG: ${uitslag.length} toetsrekords geskrap deur ` +
      `${(gebruiker && gebruiker.email) || "onbekend"}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: uitslag.length, uitslag }),
  };
};
