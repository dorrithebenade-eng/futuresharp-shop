// netlify/functions/skoon-toetsdata.js
//
// Vee elke faktuur en kwotasie uit wat die TOETSSTEMPEL dra.
//
// ─────────────────────────────────────────────────────────────────────────
// HY SLUIT HOMSELF AF.
//
// Die eerste twee weergawes hiervan was tydelike lêers wat ná gebruik weer
// verwyder is. Dit het drie keer op een aand gebeur, en elke keer was dit 'n
// aflaai, 'n push en 'n bou vir 'n handeling van vyf sekondes.
//
// Hierdie een bly staan, maar hy loop SLEGS terwyl TOETSFASE aan is —
// dieselfde poort as die stempel wat hy lees. Sit 'n mens die fase af, weier
// hy, en dan is daar weer geen pad om 'n uitgereikte faktuur uit te vee nie.
//
// Dit is die punt van die hele ontwerp: die afwesigheid van daardie pad moet
// oorbly wanneer die toetsfase verby is, en dit gebeur dan vanself in plaas
// van deur te onthou om 'n lêer te verwyder.
//
// skrap-faktuur.js en skrap-kwotasie.js bly onaangeraak. Hulle weier 'n
// aanvaarde kwotasie en 'n uitgereikte faktuur ook met die stempel — die
// eerste omdat 'n faktuur na haar verwys, die tweede omdat 'n gaping in die
// nommerreeks sigbaar moet wees. Albei reëls is reg vir werklike data.
//
// ─────────────────────────────────────────────────────────────────────────
// TWEE STAPPE, EN DIE EERSTE VEE NIKS UIT NIE
//
//   Sonder `bevestig` gee hy net 'n LYS van wat hy sou uitvee.
//   Met `bevestig` vee hy hulle uit.
//
// EEN STORE, TWEE VOORVOEGSELS. Fakture en kwotasies leef in DIESELFDE
// Blob-store, met `FS-` en `KW-` op die sleutel. Die eerste weergawe het die
// store twee keer geloop en elke rekord dubbel getel — die lys het vier gesê
// waar dit twee was.
//
// HY RAAK NIKS ANDERS NIE: geen kliënt, geen begunstigde, geen kategorie,
// geen werk-item, geen joernaalinskrywing.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store, is_toetsfase } = require("./_fakture");

const WAGWOORD = "vee-alle-toetsdata-uit";

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  // DIE POORT. Sonder die toetsfase bestaan hierdie pad nie.
  if (!is_toetsfase()) {
    return {
      statusCode: 409,
      body: "Die toetsfase is verby. 'n Uitgereikte faktuur word gekanselleer, nooit uitgevee nie.",
    };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const store = kry_fakture_store();

  let blobs = [];
  try {
    ({ blobs } = await store.list());
  } catch (fout) {
    console.error("Kon nie die store lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die rekords lys nie" };
  }

  const lys = [];
  for (const b of blobs || []) {
    let rekord = null;
    try {
      rekord = await store.get(b.key, { type: "json" });
    } catch {
      rekord = null;
    }
    if (!rekord || rekord.toets !== true) continue;
    lys.push({
      sleutel: b.key,
      soort: String(b.key).startsWith("KW") ? "kwotasie" : "faktuur",
      nommer: rekord.nommer || null,
      stand: rekord.stand || "",
      klient: (rekord.klient && rekord.klient.naam) || "",
      totaal_sent: rekord.totaal_sent || 0,
    });
  }

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
    try {
      await store.delete(item.sleutel);
      uitslag.push({ sleutel: item.sleutel, doen: "geskrap" });
    } catch (fout) {
      console.error(`Kon nie ${item.sleutel} skrap nie:`, fout);
      uitslag.push({ sleutel: item.sleutel, doen: "skrapfout" });
    }
  }

  console.log(
    `${uitslag.length} toetsrekords geskrap deur ${(gebruiker && gebruiker.email) || "onbekend"}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geskrap: uitslag.length, uitslag }),
  };
};
