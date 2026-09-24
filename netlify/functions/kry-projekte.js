// netlify/functions/kry-projekte.js
//
// Boekhouding-beskermd -- lys die projekte, met elke befondser se naam.
//
// DIE NAAM WORD HIER OPGESOEK, NIE GESTOOR NIE. Die projek dra net die
// kliëntnommer. Hernoem 'n mens die kliënt, lees die projek die nuwe naam.
//
// 'N BEFONDSER WAT NIE MEER BESTAAN NIE, BLY SIGBAAR. skrap-klient.js weier
// 'n kliënt wat 'n befondser is, maar 'n rekord kan op 'n ander manier weg
// wees. Die nommer bly dan staan met `weg: true`, eerder as om stilweg uit
// die lys te val.
//
// DIE REKORD GAAN VOLLEDIG DEUR, nie veld vir veld nie -- dieselfde les as
// kry-fin-kategoriee.js.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_kliente_store } = require("./_kliente");
const { kry_projekte_store, lees_almal } = require("./_projekte");

const ROLLE = ["boekhouding"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let almal = [];
  try {
    almal = await lees_almal(kry_projekte_store());
  } catch (fout) {
    console.error("Kon nie die projekte lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die projekte laai nie" };
  }

  // Net die kliënte wat werklik befonds, word gelees.
  const nommers = new Set();
  almal.forEach((p) => (p.befondsers || []).forEach((n) => nommers.add(n)));

  const kliente = new Map();
  if (nommers.size) {
    const kstore = kry_kliente_store();
    await Promise.all([...nommers].map(async (n) => {
      try {
        const k = await kstore.get(n, { type: "json" });
        if (k) kliente.set(n, k);
      } catch (fout) {
        console.error(`Kon nie kliënt ${n} lees nie:`, fout);
      }
    }));
  }

  const projekte = almal.map((p) => ({
    ...p,
    aktief: p.aktief !== false,
    befondsers: (p.befondsers || []).map((n) => {
      const k = kliente.get(n);
      return k
        ? { nommer: n, naam: k.naam || "", soort: k.soort || "instansie", weg: false }
        : { nommer: n, naam: "", soort: "", weg: true };
    }),
  }));

  // Aktief bo, dan alfabeties. 'n Gedeaktiveerde projek is geskiedenis.
  projekte.sort((a, b) => {
    if (a.aktief !== b.aktief) return a.aktief ? -1 : 1;
    return String(a.naam).localeCompare(String(b.naam), "af-ZA");
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projekte }),
  };
};
