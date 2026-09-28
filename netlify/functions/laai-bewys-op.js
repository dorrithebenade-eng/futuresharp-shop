// netlify/functions/laai-bewys-op.js
// Weergawe 2 (28 September 2026): ook by 'n joernaalinskrywing.
// Weergawe 1 (25 September 2026).
//
// Boekhouding-beskermd -- laai een bewysstuk op.
//
// Invoer, een van twee:
//   { toekenning, item, leernaam, inhoud_tipe, data_base64 }   'n kontrolelys-item
//   { inskrywing, leernaam, inhoud_tipe, data_base64 }         'n joernaalinskrywing
//
// Die leer word eers gestoor en dan eers aan die rekord gekoppel. Misluk die
// koppeling, word die leer weer uitgevee, sodat daar nie 'n wees in die store
// agterbly nie.
//
// 'n Kontrolelys-item word NIE outomaties afgemerk nie. 'n Opgelaaide leer se
// nog nie of dit die regte een is nie; dit bly 'n mens se besluit.
//
// Foto's word in die blaaier verklein en, as daar meer as een is, tot een PDF
// saamgevoeg (bewys.js). Hier kom dus net die klaar leer aan.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_toekennings_store } = require("./_toekennings");
const { kry_joernaal_store } = require("./_joernaal");
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

  const tipe = String(invoer.inhoud_tipe || "");
  if (!B.TIPES[tipe]) {
    return { statusCode: 400, body: "Net PDF, foto (JPG, PNG, WebP), Word of Excel word aanvaar." };
  }
  let data;
  try {
    data = Buffer.from(String(invoer.data_base64 || ""), "base64");
  } catch {
    return { statusCode: 400, body: "Die lêer kon nie gelees word nie." };
  }
  if (!data.length) return { statusCode: 400, body: "Die lêer is leeg." };
  if (data.length > B.MAKS_GREPE) return { statusCode: 413, body: "Die lêer is groter as 4 MB. Maak dit eers kleiner." };

  const naam = String(invoer.leernaam || "bewysstuk").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
  const bstore = B.kry_bewys_store();
  const inskrywing_sleutel = String(invoer.inskrywing || "");

  // -- Die teiken laai --------------------------------------------------
  let stoor_rekord;          // skryf die teiken terug
  let lys;                   // die dokumente-lys om by te voeg
  let sleutel;
  let rekord;

  if (inskrywing_sleutel) {
    if (!inskrywing_sleutel.startsWith("J-")) return { statusCode: 400, body: "Ongeldige inskrywing" };
    const jstore = kry_joernaal_store();
    try {
      rekord = await jstore.get(inskrywing_sleutel, { type: "json" });
    } catch (fout) {
      return { statusCode: 500, body: "Kon nie die inskrywing laai nie" };
    }
    if (!rekord) return { statusCode: 404, body: "Inskrywing nie gevind nie" };
    rekord.dokumente = Array.isArray(rekord.dokumente) ? rekord.dokumente : [];
    lys = rekord.dokumente;
    sleutel = B.skep_sleutel(inskrywing_sleutel, "joernaal", tipe);
    stoor_rekord = () => jstore.setJSON(inskrywing_sleutel, rekord);
  } else {
    const tstore = kry_toekennings_store();
    try {
      rekord = await tstore.get(String(invoer.toekenning || ""), { type: "json" });
    } catch (fout) {
      return { statusCode: 500, body: "Kon nie die toekenning laai nie" };
    }
    if (!rekord) return { statusCode: 404, body: "Toekenning nie gevind nie" };
    const item = (rekord.kontrolelys || []).find((i) => i.id === invoer.item);
    if (!item) return { statusCode: 404, body: "Item nie gevind nie" };
    item.dokumente = Array.isArray(item.dokumente) ? item.dokumente : [];
    lys = item.dokumente;
    sleutel = B.skep_sleutel(rekord.id, item.id, tipe);
    stoor_rekord = () => tstore.setJSON(rekord.id, rekord);
  }

  // -- Stoor en koppel --------------------------------------------------
  try {
    await bstore.set(sleutel, data, { metadata: { inhoud_tipe: tipe, naam } });
  } catch (fout) {
    console.error("Kon nie die bewysstuk stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die lêer stoor nie" };
  }

  lys.push({
    sleutel, naam, tipe, grootte: data.length,
    op: new Date().toISOString(), deur: gebruiker.email || "",
  });
  rekord.bygewerk_op = new Date().toISOString();
  try {
    await stoor_rekord();
  } catch (fout) {
    console.error("Kon nie die bewysstuk koppel nie:", fout);
    try { await bstore.delete(sleutel); } catch { /* die log hierbo se genoeg */ }
    return { statusCode: 500, body: "Kon nie die lêer aan die rekord koppel nie" };
  }

  if (inskrywing_sleutel) {
    await B.spieel_na_bankreel(rekord);
    return antwoord({ inskrywing: { sleutel: rekord.sleutel, dokumente: B.kort_lys(rekord.dokumente) } });
  }
  return antwoord({ toekenning: rekord });
};
