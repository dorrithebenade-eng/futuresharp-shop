// netlify/functions/kry-projekverslag-pdf.js
// Weergawe 1 (17 Oktober 2026).
//
// Lewer die projekverslag van een boekjaar as 'n PDF. Rol: boekhouding.
//
// DIT ONTVANG DIE SYFERS; DIT BEREKEN HULLE NIE, net soos kry-staat-pdf.js
// en kry-maandopsomming-pdf.js. Die skerm het die rye reeds opgetel.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_maatskappy } = require("./_instellings");
const { bou_projekverslag_pdf } = require("./_projekverslag-pdf");

const is_datum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const teks = (w, maks) => String(w == null ? "" : w).replace(/\s+/g, " ").trim().slice(0, maks || 120);
const sent = (w) => (Number.isFinite(Number(w)) ? Math.round(Number(w)) : 0);
const bedrae = (x) => ({
  ontvang_sent: sent(x && x.ontvang_sent),
  koste_sent: sent(x && x.koste_sent),
  oor_sent: sent(x && x.oor_sent),
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try { invoer = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Ongeldige JSON" }; }
  if (!is_datum(invoer.van) || !is_datum(invoer.tot)) {
    return { statusCode: 400, body: "Verpligte velde: van en tot, as JJJJ-MM-DD" };
  }
  const groepe = (Array.isArray(invoer.groepe) ? invoer.groepe : []).slice(0, 5).map((g) => ({
    titel: teks(g && g.titel, 60),
    rye: (Array.isArray(g && g.rye) ? g.rye : []).slice(0, 300).map((r) => ({
      nr: teks(r && r.nr, 20),
      naam: teks(r && r.naam, 120),
      besonder: teks(r && r.besonder, 120),
      instansie: teks(r && r.instansie, 40),
      ...bedrae(r),
      bydrae: teks(r && r.bydrae, 8),
      nog_bestee: Boolean(r && r.nog_bestee),
      uitstaande: teks(r && r.uitstaande, 160),
    })),
    sub: g && g.sub ? bedrae(g.sub) : null,
  })).filter((g) => g.rye.length);
  if (!groepe.length) return { statusCode: 400, body: "Daar is niks om te druk nie" };
  const tl = invoer.teels || {};

  let maatskappy = {};
  try { maatskappy = await kry_maatskappy(); } catch (f) { console.error("Projekverslag-PDF: instellings:", f); }

  try {
    const grepe = await bou_projekverslag_pdf({
      boekjaar: teks(invoer.boekjaar, 12),
      van: invoer.van, tot: invoer.tot,
      teels: {
        projekte: sent(tl.projekte), aktief: sent(tl.aktief),
        ontvang_sent: sent(tl.ontvang_sent), koste_sent: sent(tl.koste_sent),
        vergoeding_sent: sent(tl.vergoeding_sent), oor_sent: sent(tl.oor_sent),
      },
      groepe,
      totaal: bedrae(invoer.totaal),
    }, maatskappy);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        naam: `projekverslag-${String(invoer.boekjaar || "").replace("/", "-")}.pdf`,
        pdf: Buffer.from(grepe).toString("base64"),
      }),
    };
  } catch (fout) {
    console.error("Projekverslag-PDF: kon nie bou nie:", fout);
    return { statusCode: 500, body: "Kon nie die PDF bou nie" };
  }
};
