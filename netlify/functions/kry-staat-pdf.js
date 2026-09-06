// netlify/functions/kry-staat-pdf.js
//
// Lewer die staat van inkomste en uitgawes as 'n PDF. Rol: boekhouding.
//
// DIT ONTVANG DIE SYFERS; DIT BEREKEN HULLE NIE.
//
// Die skerm het die staat reeds opgetel -- die boom, die eie bedrae, die
// stapsgewyse aftrekking -- en stuur die klaar reels hierheen. Sou hierdie
// leer die optelwerk oordoen, kon die PDF en die skerm uitmekaar loop.
//
// DIE GEVAAR DAARVAN, EN WAAROM DIT AANVAARBAAR IS: iemand met die
// boekhouding-rol kan enige syfer instuur en 'n PDF terugkry. Dieselfde
// persoon kan egter 'n handinskrywing maak en die werklike staat verander --
// die PDF gee hom geen vermoe wat hy nie reeds het nie. Die rol is die
// beskerming, nie die bron van die data.
//
// Die antwoord is die PDF self, as base64, sodat die skerm dit as 'n aflaai
// kan aanbied sonder 'n tweede oproep.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_maatskappy } = require("./_instellings");
const { bou_staat_pdf } = require("./_staat-pdf");

const ROLLE = ["boekhouding"];

// Die grense is ruim en hulle is 'n keering teen 'n stukkende versoek, nie 'n
// verwagte perk nie. 'n Staat met meer as 300 reels is nie 'n staat nie.
const MAKS_RYE = 300;

function is_datum(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function skoon_teks(w, maks) {
  return String(w == null ? "" : w).replace(/\s+/g, " ").trim().slice(0, maks || 200);
}

function skoon_sent(w) {
  const n = Number(w);
  return Number.isFinite(n) ? Math.round(n) : 0;
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

  if (!is_datum(invoer.van) || !is_datum(invoer.tot)) {
    return { statusCode: 400, body: "Verpligte velde: van en tot, as JJJJ-MM-DD" };
  }

  const blokke = (Array.isArray(invoer.blokke) ? invoer.blokke : [])
    .slice(0, 4)
    .map((b) => ({
      titel: skoon_teks(b && b.titel, 60),
      som_sent: skoon_sent(b && b.som_sent),
      rye: (Array.isArray(b && b.rye) ? b.rye : []).slice(0, MAKS_RYE).map((r) => ({
        naam: skoon_teks(r && r.naam, 90),
        vlak: Math.max(0, Math.min(4, Number(r && r.vlak) || 0)),
        eie_sent: skoon_sent(r && r.eie_sent),
        totaal_sent: skoon_sent(r && r.totaal_sent),
        hoof: Boolean(r && r.hoof),
      })),
    }))
    .filter((b) => b.rye.length);

  const slot = (Array.isArray(invoer.slot) ? invoer.slot : [])
    .slice(0, 40)
    .map((r) => ({
      naam: skoon_teks(r && r.naam, 90),
      bedrag_sent: skoon_sent(r && r.bedrag_sent),
      soort: ["reel", "aftrek", "tussen", "som"].includes(r && r.soort) ? r.soort : "reel",
    }));

  if (!blokke.length && !slot.length) {
    return { statusCode: 400, body: "Daar is niks om te druk nie" };
  }

  const nota = invoer.nota && invoer.nota.teks
    ? { kop: skoon_teks(invoer.nota.kop, 60), teks: skoon_teks(invoer.nota.teks, 600) }
    : null;

  let maatskappy;
  try {
    maatskappy = await kry_maatskappy();
  } catch (fout) {
    console.error("Staat-PDF: kon nie die instellings lees nie:", fout);
    // Die PDF val terug op sy eie verstek; 'n staat sonder adres is beter as
    // geen staat nie.
    maatskappy = {};
  }

  try {
    const grepe = await bou_staat_pdf(
      { van: invoer.van, tot: invoer.tot, blokke, slot, nota },
      maatskappy
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        naam: `staat-${invoer.van}-tot-${invoer.tot}.pdf`,
        pdf: Buffer.from(grepe).toString("base64"),
      }),
    };
  } catch (fout) {
    console.error("Staat-PDF: kon nie die PDF bou nie:", fout);
    return { statusCode: 500, body: "Kon nie die staat bou nie" };
  }
};
