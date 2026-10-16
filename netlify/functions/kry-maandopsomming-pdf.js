// netlify/functions/kry-maandopsomming-pdf.js
// Weergawe 1 (16 Oktober 2026).
//
// Lewer die maandopsomming van een boekjaar as 'n PDF. Rol: boekhouding.
//
// DIT ONTVANG DIE SYFERS; DIT BEREKEN HULLE NIE, net soos kry-staat-pdf.js.
// Die skerm het die rye reeds opgetel; hierdie Function teken hulle. Wie die
// boekhouding-rol het, kan reeds die syfers self verander, so 'n PDF gee geen
// ekstra vermoe nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_maatskappy } = require("./_instellings");
const { bou_maandopsomming_pdf } = require("./_maandopsomming-pdf");

const is_datum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const teks = (w, maks) => String(w == null ? "" : w).replace(/\s+/g, " ").trim().slice(0, maks || 120);
const sent = (w) => (w == null || w === "" ? null : (Number.isFinite(Number(w)) ? Math.round(Number(w)) : 0));

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try { invoer = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Ongeldige JSON" }; }
  if (!is_datum(invoer.van) || !is_datum(invoer.tot)) {
    return { statusCode: 400, body: "Verpligte velde: van en tot, as JJJJ-MM-DD" };
  }
  const rye = (Array.isArray(invoer.rye) ? invoer.rye : []).slice(0, 13).map((r) => ({
    maand: teks(r && r.maand, 30),
    gedek: Boolean(r && r.gedek),
    opening_sent: sent(r && r.opening_sent),
    in_sent: sent(r && r.in_sent) || 0,
    uit_sent: sent(r && r.uit_sent) || 0,
    sluit_sent: sent(r && r.sluit_sent),
    j_netto_sent: sent(r && r.j_netto_sent) || 0,
    verskil_sent: sent(r && r.verskil_sent),
    stand: teks(r && r.stand, 40),
  }));
  if (!rye.length) return { statusCode: 400, body: "Daar is niks om te druk nie" };
  const t = invoer.totale || {};

  let maatskappy = {};
  try { maatskappy = await kry_maatskappy(); } catch (f) { console.error("Maandopsomming-PDF: instellings:", f); }

  try {
    const grepe = await bou_maandopsomming_pdf({
      boekjaar: teks(invoer.boekjaar, 12),
      van: invoer.van, tot: invoer.tot, rye,
      totale: { in_sent: sent(t.in_sent) || 0, uit_sent: sent(t.uit_sent) || 0, j_netto_sent: sent(t.j_netto_sent) || 0 },
      nota: teks(invoer.nota, 600),
    }, maatskappy);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        naam: `maandopsomming-${String(invoer.boekjaar || "").replace("/", "-")}.pdf`,
        pdf: Buffer.from(grepe).toString("base64"),
      }),
    };
  } catch (fout) {
    console.error("Maandopsomming-PDF: kon nie bou nie:", fout);
    return { statusCode: 500, body: "Kon nie die PDF bou nie" };
  }
};
