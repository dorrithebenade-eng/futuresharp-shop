// netlify/functions/tel-werk-items.js
//
// Tel hoeveel fakture elke item in die register van werk en uitgawes gebruik.
// Rol: boekhouding.
//
// WAAROM DIT 'N EIE FUNCTION IS EN NIE DEEL VAN kry-werk-items.js NIE.
//
// kry-werk-items.js loop by ELKE opening van die register, en by elke wisseling
// tussen die sub-registers. Hy lees twaalf klein rekords en is klaar. Sou die
// telling by hom inwoon, sou elke opening ook ELKE FAKTUUR lees — en
// kry-joernaal.js, wat presies dit doen, staan reeds as 'n prestasiekwessie op
// die lys.
//
// Die telling word slegs gevra wanneer 'n mens die werk-register OOPMAAK, en
// een keer vir die hele register. Sonder dit sou twaalf items twaalf volle
// deurlope beteken.
//
// EEN DEURLOOP, 'N KAART TERUG. Die antwoord is 'n voorwerp met die
// GENORMALISEERDE beskrywing as sleutel: { "reiskoste": { fakture: 3,
// konsepte: 1 } }. Die skerm soek sy item se naam daarin op, ook genormaliseer.
//
// HOOFLETTERONAFHANKLIK, DEURGAANS. "Reiskoste" op die een faktuur en
// "reiskoste" op die ander is twee gebruike van dieselfde item. 'n Telling wat
// hulle apart hou, sou lieg — en 'n mens sou 'n item skrap wat dink dis
// ongebruik.
//
// DIT TEL WAT OP FAKTURE STAAN, NIE WAT IN DIE REGISTER STAAN NIE. 'n
// Beskrywing wat nooit by die register uitgekom het nie, word ook getel. Dit is
// die punt: die skerm gebruik dieselfde kaart om te wys watter woorde in
// omloop is.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store } = require("./_fakture");

function normaliseer(waarde) {
  return String(waarde == null ? "" : waarde).trim().toLowerCase();
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const store = kry_fakture_store();

  let blobs = [];
  try {
    const lys = await store.list();
    blobs = lys.blobs || [];
  } catch (fout) {
    // GEEN LEE KAART BY 'N FOUT NIE. 'n Lee kaart lyk soos "niks word gebruik
    // nie", en dan skrap iemand 'n item wat op twintig fakture staan omdat die
    // knoppie gese het dit is ongebruik. Dieselfde les as los-duplikaat.js.
    console.error("Kon nie die fakture lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die fakture nagaan nie" };
  }

  const kaart = {};
  let gelees = 0;

  for (const b of blobs) {
    let rekord;
    try {
      rekord = await store.get(b.key, { type: "json" });
    } catch (fout) {
      // EEN STUKKENDE REKORD MAG NIE DIE HELE TELLING OMGOOI NIE, maar hy mag
      // ook nie stilweg verdwyn nie: `volledig` sê vir die skerm dat die
      // syfers 'n ondergrens is.
      console.error(`Kon nie faktuur ${b.key} lees nie:`, fout);
      continue;
    }
    if (!rekord || !Array.isArray(rekord.reels)) continue;
    gelees += 1;

    const is_konsep = rekord.stand === "konsep";

    // EEN KEER PER FAKTUUR, nie per reel nie. Twee reels met dieselfde
    // beskrywing op een faktuur is een faktuur wat die woord gebruik.
    const gesien = new Set();
    for (const r of rekord.reels) {
      const naam = normaliseer(r && r.beskrywing);
      if (!naam || gesien.has(naam)) continue;
      gesien.add(naam);
      if (!kaart[naam]) kaart[naam] = { fakture: 0, konsepte: 0 };
      if (is_konsep) kaart[naam].konsepte += 1;
      else kaart[naam].fakture += 1;
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kaart,
      // Hoeveel fakture werklik gelees is. Is dit minder as wat gelys is, het
      // 'n rekord omgeval en is die syfers 'n ondergrens.
      gelees,
      volledig: gelees === blobs.length,
    }),
  };
};
