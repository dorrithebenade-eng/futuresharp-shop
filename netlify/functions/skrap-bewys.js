// netlify/functions/skrap-bewys.js
// Weergawe 3 (16 Oktober 2026): ook by 'n faktuur se betaling.
// Weergawe 2 (28 September 2026): ook by 'n joernaalinskrywing.
// Weergawe 1 (25 September 2026).
//
// Boekhouding-beskermd -- vee een bewysstuk uit en maak dit los van sy rekord.
// Invoer: { toekenning, item, sleutel }  of  { inskrywing, sleutel }  of  { faktuur, sleutel }

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_toekennings_store } = require("./_toekennings");
const { kry_joernaal_store } = require("./_joernaal");
const { kry_fakture_store, sleutel_na_nommer } = require("./_fakture");
const B = require("./_bewysstukke");

function antwoord(liggaam) {
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(liggaam) };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const dok = String(invoer.sleutel || "");
  const inskrywing_sleutel = String(invoer.inskrywing || "");
  const faktuur_sleutel = String(invoer.faktuur || "");

  let rekord;
  let houer;                 // die voorwerp met die `dokumente`-lys
  let stoor_rekord;

  if (faktuur_sleutel) {
    if (!sleutel_na_nommer(faktuur_sleutel)) return { statusCode: 400, body: "Ongeldige faktuur" };
    const fstore = kry_fakture_store();
    try {
      rekord = await fstore.get(faktuur_sleutel, { type: "json" });
    } catch (fout) {
      return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
    }
    if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };
    houer = rekord.betaling;
    stoor_rekord = () => fstore.setJSON(faktuur_sleutel, rekord);
  } else if (inskrywing_sleutel) {
    if (!inskrywing_sleutel.startsWith("J-")) return { statusCode: 400, body: "Ongeldige inskrywing" };
    const jstore = kry_joernaal_store();
    try {
      rekord = await jstore.get(inskrywing_sleutel, { type: "json" });
    } catch (fout) {
      return { statusCode: 500, body: "Kon nie die inskrywing laai nie" };
    }
    if (!rekord) return { statusCode: 404, body: "Inskrywing nie gevind nie" };
    houer = rekord;
    stoor_rekord = () => jstore.setJSON(inskrywing_sleutel, rekord);
  } else {
    const tstore = kry_toekennings_store();
    try {
      rekord = await tstore.get(String(invoer.toekenning || ""), { type: "json" });
    } catch (fout) {
      return { statusCode: 500, body: "Kon nie die toekenning laai nie" };
    }
    if (!rekord) return { statusCode: 404, body: "Toekenning nie gevind nie" };
    houer = (rekord.kontrolelys || []).find((i) => i.id === invoer.item);
    stoor_rekord = () => tstore.setJSON(rekord.id, rekord);
  }
  if (!houer || !(houer.dokumente || []).some((d) => d.sleutel === dok)) {
    return { statusCode: 404, body: "Bewysstuk nie gevind nie" };
  }

  // Eers die koppeling, dan die leer: misluk die tweede, bly net 'n wees in
  // die store agter, nie 'n rekord wat na 'n leer wys wat nie bestaan nie.
  houer.dokumente = houer.dokumente.filter((d) => d.sleutel !== dok);
  rekord.bygewerk_op = new Date().toISOString();
  try {
    await stoor_rekord();
  } catch (fout) {
    return { statusCode: 500, body: "Kon nie die rekord stoor nie" };
  }
  try {
    await B.kry_bewys_store().delete(dok);
  } catch (fout) {
    console.error(`Kon nie bewysstuk ${dok} uitvee nie:`, fout);
  }

  if (faktuur_sleutel) {
    return antwoord({ faktuur: { sleutel: faktuur_sleutel, dokumente: B.kort_lys(rekord.betaling.dokumente) } });
  }
  if (inskrywing_sleutel) {
    await B.spieel_na_bankreel(rekord);
    return antwoord({ inskrywing: { sleutel: rekord.sleutel, dokumente: B.kort_lys(rekord.dokumente) } });
  }
  return antwoord({ toekenning: rekord });
};
