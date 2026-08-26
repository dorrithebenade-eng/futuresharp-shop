// netlify/functions/kry-staat.js
//
// Die staat. Rol: boekhouding.
//
// 'N SUIWER BEREKENING, ELKE KEER HERBEREKEN EN NOOIT GESTOOR NIE — dieselfde
// beginsel as _outeur-aandeel.js. Gestoorde totale en herberekende totale dryf
// uiteindelik uiteen, en dan wys die skerm 'n syfer wat nie meer waar is nie.
//
// DRIE DINGE APART, want hulle is drie verskillende soorte geld:
//
//   1. REEDS UITBETAAL — deur Paystack by vereffening, of met die hand
//      afgemerk. Weg uit die hoofrekening, en niemand skuld niks meer nie.
//
//   2. MOET NOG UITBETAAL WORD — die kliënt het betaal, die geld lê in die
//      hoofrekening, maar die ontvanger het geen subrekening en Paystack kon
//      hom nie betaal nie. Dit is 'n AANSPREEKLIKHEID: Future Sharp se geld
//      is dit nie, dit hou dit net vas.
//
//   3. VERWAGTE INKOMSTE — uitgereik en nog onbetaal. Dit is NIEMAND se geld
//      nie, ook nie die ontvanger s'n nie, en die bewoording moet dit so stel.
//
// DIE WERKLYS GROEPEER PER BEGUNSTIGDE, NIE PER FAKTUUR NIE. 'n Mens betaal 'n
// persoon: het Eugene drie uitstaande rye oor drie fakture, is dit één
// oorbetaling met één verwysing. Groepeer dit per faktuur, tik 'n mens
// dieselfde verwysing drie keer in en die syfers klop nie met die bankstaat
// nie.
//
// DIE BEDRAE KOM UIT DIE GEVRIESDE VERDELING en word nooit herbereken nie. 'n
// Bedrag wat ná uitreiking verander, is nie 'n rekord nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fakture_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
} = require("./_fakture");

// Die drie stande wat 'n uitbetaalry kan dra. `direk_uitbetaal` en
// `betaal_met_hand` beteken albei "hy het sy geld"; hulle bly APART omdat die
// een vanself gebeur het en die ander iemand se werk was. Twee betekenisse in
// een veld beteken 'n mens kan later nie sê wat werklik gebeur het nie.
const KLAAR = ["direk_uitbetaal", "betaal_met_hand"];

function sleutel_van(begunstigde_id, naam) {
  // Die ID is die betroubare sleutel — hy verander nie met die naam nie. 'n
  // Ou rekord sonder ID val terug op die naam, wat destyds die enigste ding
  // was wat gevries is.
  return begunstigde_id ? "id:" + begunstigde_id : "naam:" + String(naam || "").trim();
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

  let sleutels = [];
  try {
    const lys = await store.list();
    sleutels = (lys.blobs || []).map((b) => b.key).filter((s) => !is_konsep_sleutel(s));
  } catch (fout) {
    console.error("Kon nie die fakture lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die staat bereken nie" };
  }

  const rekords = [];
  for (const sleutel of sleutels) {
    try {
      const r = await store.get(sleutel, { type: "json" });
      if (r) rekords.push({ sleutel, r });
    } catch (fout) {
      console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    }
  }

  let direk_sent = 0;      // deur Paystack
  let hand_klaar_sent = 0; // met die hand afgemerk
  let uitstaande_sent = 0;
  let verwag_sent = 0;

  const wag = new Map();   // per begunstigde: wat nog uitbetaal moet word
  const klaar = [];        // elke ry wat sy geld gekry het
  const verwag = [];       // uitgereik, nog onbetaal

  rekords.forEach(({ sleutel, r }) => {
    const nommer = r.nommer || sleutel_na_nommer(sleutel) || sleutel;
    const klient = (r.klient && r.klient.naam) || "";

    // 'n GEKANSELLEERDE FAKTUUR TEL NÊRENS NIE. Hy is nie verwagte inkomste
    // nie, en niemand skuld iets daarop nie. Is hy tog betaal voordat hy
    // gekanselleer is, dra hy uitbetalings en dié tel wel — die geld is
    // werklik ontvang en iemand moet dit steeds kry.
    if (r.stand === "gestuur") {
      verwag_sent += Number(r.totaal_sent) || 0;
      verwag.push({
        sleutel,
        nommer,
        klient,
        bedrag_sent: Number(r.totaal_sent) || 0,
        uitgereik_op: r.uitgereik_op || null,
        betaalbaar_teen: r.betaalbaar_teen || null,
      });
      return;
    }

    const rye = Array.isArray(r.uitbetalings) ? r.uitbetalings : [];
    rye.forEach((ry, indeks) => {
      const sent = Number(ry.bedrag_sent) || 0;
      if (sent <= 0) return;

      if (KLAAR.includes(ry.stand)) {
        if (ry.stand === "direk_uitbetaal") direk_sent += sent;
        else hand_klaar_sent += sent;

        klaar.push({
          naam: ry.ontvanger || "",
          nommer,
          bedrag_sent: sent,
          waarvoor: Array.isArray(ry.waarvoor) ? ry.waarvoor : [],
          stand: ry.stand,
          betaal_op: ry.betaal_op || null,
          verwysing: ry.verwysing || "",
        });
        return;
      }

      // Wat oorbly is `uitstaande`.
      uitstaande_sent += sent;

      const k = sleutel_van(ry.begunstigde_id, ry.ontvanger);
      if (!wag.has(k)) {
        wag.set(k, {
          sleutel: k,
          begunstigde_id: ry.begunstigde_id || null,
          naam: ry.ontvanger || "",
          totaal_sent: 0,
          rye: [],
        });
      }
      const groep = wag.get(k);
      groep.totaal_sent += sent;
      // Die faktuur se sleutel EN die indeks van die ry, want dit is presies
      // wat merk-uitbetaal.js nodig het om die regte ry af te merk. 'n Naam
      // sou nie deug nie: twee rye vir dieselfde persoon op een faktuur is
      // moontlik, al vou stuur-faktuur.js hulle gewoonlik saam.
      groep.rye.push({
        faktuur_sleutel: sleutel,
        indeks,
        nommer,
        klient,
        bedrag_sent: sent,
        // WAARVOOR die persoon betaal word, een inskrywing per faktuurreel.
        // Een persoon kan uit drie reels van dieselfde faktuur betaal word --
        // 'n aanbieding, 'n vraelys en 'n verslag -- en stuur-faktuur.js vou
        // hulle vir Paystack saam tot een ry. Sonder hierdie veld sien 'n mens
        // net die totaal en kan niemand vra waarvoor dit is nie.
        waarvoor: Array.isArray(ry.waarvoor) ? ry.waarvoor : [],
      });
    });
  });

  const groepe = [...wag.values()].sort((a, b) =>
    (a.naam || "").localeCompare(b.naam || "", "af-ZA"));

  klaar.sort((a, b) => String(b.betaal_op || "").localeCompare(String(a.betaal_op || "")));
  verwag.sort((a, b) => String(a.uitgereik_op || "").localeCompare(String(b.uitgereik_op || "")));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      opsomming: {
        // Wat werklik uit is: albei soorte saam. Die skerm hou hulle apart
        // deur die merkie per ry, nie deur twee syfers nie.
        uitbetaal_sent: direk_sent + hand_klaar_sent,
        direk_sent,
        hand_klaar_sent,
        uitstaande_sent,
        verwag_sent,
      },
      groepe,
      klaar,
      verwag,
    }),
  };
};
