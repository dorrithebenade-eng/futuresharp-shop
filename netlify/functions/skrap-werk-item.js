// netlify/functions/skrap-werk-item.js
//
// Vee 'n item uit die register van werk en uitgawes. Rol: boekhouding.
//
// DIT WEIER NIKS, EN DIT IS 'N BESLUIT.
//
// 'n Kliënt en 'n begunstigde word met 'n VERWYSING aan 'n faktuur gekoppel —
// `klient_id`, `begunstigde_id`. Skrap 'n mens hulle, wys daardie verwysing na
// niks en die faktuur is stukkend. Daarom weier skrap-klient.js en
// skrap-begunstigde.js.
//
// 'n WERK-ITEM WORD NIE SO GEKOPPEL NIE. Die faktuur stoor die beskrywing as
// TEKS: `{ beskrywing: "Reiskoste" }`, nie 'n verwysing nie. Skrap 'n mens
// die item, bly elke bestaande faktuur presies soos sy was. Net die
// voorstellys verloor die woord.
//
// WAAROM DIT NIE NET "VEILIG" IS NIE. 'n Woord wat op twintig fakture staan,
// verdwyn uit die voorstellys, en die volgende faktuur tik dit weer — dalk
// anders. Dit is die enigste ding wat 'n register doen: dieselfde woord elke
// keer, sodat 'n mens later kan tel wat aan reis bestee is.
//
// DIE ANTWOORD IS DUS TEL, NIE WEIER NIE. Die telling gaan saam met die
// bevestiging: "Skrap? Staan op 3 fakture." Jy besluit. Sou dit weier, kon 'n
// tikfout wat een keer op een faktuur beland het, nooit weer uit die
// voorstellys nie — en dit is juis die tikfoute wat 'n mens wil verwyder.
//
// DIE TELLING IS HOOFLETTERONAFHANKLIK. "Reiskoste" op die een faktuur en
// "reiskoste" op die ander is twee gebruike van dieselfde item. 'n Telling wat
// hulle apart hou, sou lieg — en 'n mens sou 'n item skrap wat dink dis
// ongebruik.
//
// 'N STUKKENDE TELLING MAG NOOIT SOOS NUL LYK NIE. Val die Blob-oproep om, gee
// die Function 500 en die item bly staan. Dieselfde les as los-duplikaat.js:
// die gevaarlikste fout is die een wat soos "veilig" lyk.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_werk_items_store } = require("./_werk-items");
const { kry_fakture_store } = require("./_fakture");

function normaliseer(waarde) {
  return String(waarde == null ? "" : waarde).trim().toLowerCase();
}

// Tel hoeveel fakture 'n reël met hierdie beskrywing dra.
//
// KONSEPTE TEL SAAM, en apart. 'n Konsep is nog nie 'n dokument nie, maar hy
// is wel iemand se halfklaar werk — 'n woord wat uit die voorstellys verdwyn
// terwyl 'n konsep hom gebruik, is presies wanneer die volgende spelling
// ontstaan.
async function fakture_met(beskrywing) {
  const soek = normaliseer(beskrywing);
  if (!soek) return { fakture: 0, konsepte: 0 };

  const store = kry_fakture_store();
  const lys = await store.list();

  let fakture = 0;
  let konsepte = 0;

  for (const b of lys.blobs || []) {
    const rekord = await store.get(b.key, { type: "json" });
    if (!rekord || !Array.isArray(rekord.reels)) continue;

    // Een keer per FAKTUUR, nie per reel nie. Twee reels met dieselfde
    // beskrywing op een faktuur is een faktuur wat die woord gebruik.
    const gebruik = rekord.reels.some((r) => normaliseer(r && r.beskrywing) === soek);
    if (!gebruik) continue;

    if (rekord.stand === "konsep") konsepte += 1;
    else fakture += 1;
  }

  return { fakture, konsepte };
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

  const item_id = String(invoer.item_id || "").trim();
  if (!item_id) return { statusCode: 400, body: "Geen item nie" };

  const store = kry_werk_items_store();

  let rekord;
  try {
    rekord = await store.get(item_id, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie item ${item_id} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die item laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Item nie gevind nie" };

  // Die telling loop VOOR die skrap, want sy is deel van die rekord van wat
  // gebeur het. Ná die skrap sou sy nog steeds klop, maar dan staan sy nêrens.
  let gevind;
  try {
    gevind = await fakture_met(rekord.naam);
  } catch (fout) {
    console.error("Kon nie die fakture nagaan nie:", fout);
    return {
      statusCode: 500,
      body: "Kon nie die fakture nagaan nie. Probeer weer — die item is nie geskrap nie.",
    };
  }

  try {
    await store.delete(item_id);
  } catch (fout) {
    console.error(`Kon nie item ${item_id} skrap nie:`, fout);
    return { statusCode: 500, body: "Kon nie die item skrap nie" };
  }

  // Aangeteken, want die rekord self kan niks meer sê nie: hy is weg. Die
  // telling staan saam met die naam, sodat 'n mens later kan sien wat verdwyn
  // het en hoeveel dokumente die woord gedra het.
  console.log(
    `Werk-item ${item_id} ("${rekord.naam}") geskrap deur ` +
      `${(gebruiker && gebruiker.email) || "onbekend"} — ` +
      `${gevind.fakture} fakture, ${gevind.konsepte} konsepte`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      geskrap: item_id,
      naam: rekord.naam || "",
      fakture: gevind.fakture,
      konsepte: gevind.konsepte,
    }),
  };
};
