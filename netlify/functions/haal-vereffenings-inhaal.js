// netlify/functions/haal-vereffenings-inhaal.js
//
// Haal Paystack se vereffenings vir 'n GEKOSE bereik. Rol: boekhouding.
//
// WAAROM DIT 'N TWEEDE LEER IS EN NIE 'N PARAMETER OP haal-vereffenings.js NIE.
//
// 'n Geskeduleerde funksie is by Netlify nie oor HTTP bereikbaar nie -- 'n mens
// kan hom nie aanroep nie, ook nie met 'n geldige token nie. Die inhaal moet
// dus sy eie ingang he. Die WERK is gedeel; net die ingang verskil.
//
// GEBRUIK: een keer, vir die geskiedenis wat voor die skedule le. Die
// uitbetalings begin 15 Julie 2026.
//
//   fetch("/.netlify/functions/haal-vereffenings-inhaal", {
//     method: "POST",
//     headers: { "Content-Type": "application/json",
//       ...(await identiteit_kop()) },
//     body: JSON.stringify({ van: "2026-07-01", tot: "2026-09-19" }),
//   }).then(r => r.json()).then(console.log);
//
// Dit is veilig om twee keer te loop. Die sleutel is deterministies: dieselfde
// vereffening is dieselfde rekord, en 'n tweede loop oorskryf hom.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { haal_vereffenings, vandag } = require("./_vereffening-haal");

const ROLLE = ["boekhouding"];

// Dieselfde dop as by die transaksies. Dit is nie 'n tikfout-vanger nie, maar
// dit keer dat 'n bereik van jare per ongeluk begin word.
const MAKS_DAE = 800;

function is_datum(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
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

  const van = String(invoer.van || "").trim();
  const tot = String(invoer.tot || "").trim() || vandag();

  if (!is_datum(van) || !is_datum(tot)) {
    return { statusCode: 400, body: "Verpligte velde: van en tot, as JJJJ-MM-DD" };
  }
  if (van > tot) {
    return { statusCode: 400, body: "Die begindatum le na die einddatum" };
  }

  const dae = Math.round((new Date(tot) - new Date(van)) / 86400000);
  if (dae > MAKS_DAE) {
    return { statusCode: 400, body: `Die bereik is ${dae} dae; die maksimum is ${MAKS_DAE}` };
  }

  // 'N GEKOSE ONTVANGERLYS, vir 'n diagnose. Word dit weggelaat, loop die
  // inhaal oor die hoofrekening en elke begunstigde met 'n subrekening, soos
  // die skedule doen. 'n Kode van "" beteken: vra Paystack sonder die
  // subrekening-filter.
  //
  //   body: { van, tot, ontvangers: [{ kode: "", naam: "alles" }] }
  const ontvangers = Array.isArray(invoer.ontvangers)
    ? invoer.ontvangers
        .filter((o) => o && typeof o === "object")
        .map((o) => ({ kode: String(o.kode == null ? "" : o.kode), naam: String(o.naam || o.kode || "alles") }))
    : null;

  try {
    const uitslag = await haal_vereffenings(van, tot, ontvangers);
    console.log(
      `Vereffening-inhaal ${van} tot ${tot} deur ${gebruiker.email || ""}: ` +
        `${uitslag.gehaal} gehaal, ${uitslag.geskryf} geskryf.`
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ van, tot, ...uitslag }),
    };
  } catch (fout) {
    console.error("Vereffening-inhaal het misluk:", fout);
    return { statusCode: 500, body: "Die inhaal het misluk" };
  }
};
