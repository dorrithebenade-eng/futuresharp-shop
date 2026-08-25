// netlify/functions/vee-fakture-uit.js
//
// ─────────────────────────────────────────────────────────────────────────
// TYDELIK. HIERDIE LEER MOET VERWYDER WORD SODRA DIE SKOONMAAK GEDOEN IS.
//
// Hy vee die HELE faktuurstore uit — elke konsep, elke uitgereikte faktuur,
// elke betaling en elke uitbetaalrekord. Daar is geen pad terug nie en geen
// afskrif nie.
//
// Hy bestaan vir presies een oomblik: die einde van die toetsfase, voordat
// die eerste egte faktuur uitgereik word. Daarna is hy die gevaarlikste ding
// in die repo en hoort hy nie daar nie.
// ─────────────────────────────────────────────────────────────────────────
//
// DRIE SLOTTE, want een is te min vir iets wat nie teruggedraai kan word nie:
//
//   1. Die rol boekhouding, soos elke ander Function hier.
//   2. Die omgewingsveranderlike TOELAAT_FAKTURE_UITVEE moet op "ja" staan.
//      Staan sy nie so nie, doen hierdie Function niks — ook nie as iemand
//      hom per ongeluk aanroep nie. Sy word in Netlify aangeskakel, die
//      skoonmaak word gedoen, en sy word weer afgeskakel.
//   3. Die sin hieronder moet WOORDELIKS ingetik word. 'n Knoppie wat 'n
//      mens net kan druk, is 'n knoppie wat 'n mens per ongeluk druk.
//
// DIE NOMMER STEL HOMSELF TERUG. skep_nommer() lees die hoogste bestaande
// sleutel; is daar geen sleutels nie, begin die reeks weer by BEGIN_NOMMER.
// Daar is dus geen aparte teller om reg te stel nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store, BEGIN_NOMMER } = require("./_fakture");

const BEVESTIGING = "VEE ALLE FAKTURE UIT";

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  if (String(process.env.TOELAAT_FAKTURE_UITVEE || "").trim().toLowerCase() !== "ja") {
    return {
      statusCode: 403,
      body:
        "Uitvee is toegesluit. Stel TOELAAT_FAKTURE_UITVEE op 'ja' in Netlify, " +
        "doen die skoonmaak, en skakel dit weer af.",
    };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  if (String(invoer.bevestiging || "").trim() !== BEVESTIGING) {
    return {
      statusCode: 400,
      body: `Tik hierdie sin presies so in: ${BEVESTIGING}`,
    };
  }

  const store = kry_fakture_store();

  let sleutels;
  try {
    const lys = await store.list();
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die fakture lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die fakture lys nie" };
  }

  let uit = 0;
  const misluk = [];
  for (const sleutel of sleutels) {
    try {
      await store.delete(sleutel);
      uit += 1;
    } catch (fout) {
      console.error(`Kon nie ${sleutel} uitvee nie:`, fout);
      misluk.push(sleutel);
    }
  }

  // DIT WORD AANGETEKEN, want dit is die enigste spoor wat oorbly. Die
  // rekords self is weg; hierdie reël in Netlify se log is al wat vertel
  // wie dit gedoen het en wanneer.
  console.warn(
    `FAKTUURSTORE UITGEVEE deur ${(gebruiker && gebruiker.email) || ""} — ` +
      `${uit} van ${sleutels.length} sleutels. Die reeks begin weer by ${BEGIN_NOMMER}.`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uitgevee: uit,
      gevind: sleutels.length,
      misluk,
      volgende_nommer: BEGIN_NOMMER,
    }),
  };
};
