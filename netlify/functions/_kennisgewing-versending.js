// netlify/functions/_kennisgewing-versending.js
//
// Laat die KOPER weet sy harde kopie is gestuur.
//
// WAAROM DIT BESTAAN
//
// merk-bestelling-gestuur.js het van die begin af die datum, die wyse, die
// verskaffer, die verwysing en die spoornommer noukeurig in die rekord gestoor
// -- en dan gestop. Die koper het betaal vir 'n boek wat per pos kom en daarna
// niks meer gehoor nie. Die spoornommer het in die Blob gelê waar niemand hom
// kon sien nie.
//
// "My Boeke" wys dit nou, maar 'n bladsy waarheen 'n mens self moet gaan kyk,
// is nie 'n kennisgewing nie. 'n Koper weet nie dat daar iets is om te gaan
// kyk nie.
//
// DIT GOOI NOOIT NIE. Die versending is reeds in die rekord geskryf teen die
// tyd dat hierdie funksie loop. 'n Pos wat misluk, mag nie 'n geslaagde merk
// ongedaan maak nie -- die aanroeper hou dit in 'n try/catch, en stuur_epos()
// gee self { ok, fout } terug in plaas van te gooi.
//
// EEN POS PER BESTELLING, NIE PER BOEK NIE. 'n Bestelling met drie harde
// kopieë van dieselfde outeur word EEN keer gemerk en kry EEN pos met al drie
// titels daarin. Drie afsonderlike boodskappe oor een pakkie is drie keer die
// vraag "is daar nog iets op pad?".

const { stuur_epos, ontsnap } = require("./_stuur-epos");

// Die eie domein, nie process.env.URL nie — 'n wildcard-DNS-rekord op
// futuresharp.co.za laat interne terugroepe by die verkeerde bediener land.
// Sien dieselfde nota in _kennisgewing-outeur.js.
const WERF_URL = "https://futureshop.futuresharp.co.za";

// Die rekord dra JJJJ-MM-DD. "26 Augustus 2026" lees in 'n pos beter as
// "2026-08-26", en 'n koper wat 'n navraag doen, haal die datum hieruit.
function datum_lank(iso) {
  const d = new Date(String(iso || "").slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return String(iso || "");
  return d.toLocaleDateString("af-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function stuur_versending_kennisgewing(bestelling) {
  const aan = String(
    (bestelling.koper && bestelling.koper.epos) ||
      (bestelling.kontak_inligting && bestelling.kontak_inligting.epos) ||
      ""
  ).trim();

  // Sonder 'n adres is daar niks om te doen nie. Dit is nie 'n fout wat die
  // merk moet keer nie — die versending het gebeur, ons kan net nie daaroor
  // skryf nie.
  if (!aan) return { ok: false, fout: "Geen koper-e-pos" };

  const versending = bestelling.versending || {};
  if (versending.gestuur !== true) {
    return { ok: false, fout: "Nie as gestuur gemerk nie" };
  }

  const titels = (bestelling.items || [])
    .filter((i) => i && i.formaat === "harde_kopie")
    .map((i) => String(i.titel || "").trim())
    .filter(Boolean);

  if (!titels.length) return { ok: false, fout: "Geen harde kopie" };

  const bestelnommer = String(bestelling.bestelnommer || "").trim();
  const meervoud = titels.length > 1;

  const reels = [
    meervoud
      ? "Jou boeke is gestuur."
      : `<b>${ontsnap(titels[0])}</b> is gestuur.`,
  ];

  // By meer as een titel staan hulle in 'n lys; by een staan hy reeds in die
  // sin hierbo en 'n lys van een is 'n lys wat na 'n fout lyk.
  if (meervoud) {
    reels.push(titels.map((t) => `<b>${ontsnap(t)}</b>`).join("<br>"));
  }

  const besonderhede = [`Bestelnommer: <b>${ontsnap(bestelnommer)}</b>`];
  if (versending.gestuur_op) {
    besonderhede.push(`Gestuur op: ${ontsnap(datum_lank(versending.gestuur_op))}`);
  }

  // DIE SPOORNOMMER IS DIE PUNT VAN DIE POS. Sonder hom is dit 'n mededeling;
  // met hom is dit iets waarmee 'n mens iets kan doen. Hy staan LAASTE in die
  // blok, waar die oog by die einde van 'n lys uitkom.
  if (versending.spoornommer) {
    besonderhede.push(`Spoornommer: <b>${ontsnap(versending.spoornommer)}</b>`);
  }
  reels.push(besonderhede.join("<br>"));

  // GEEN GERAAMDE AANKOMSDATUM NIE. Ons weet nie hoe lank die pos gaan vat
  // nie, en 'n raaiskoot wat mis, laat 'n mens dink die pakkie is weg.
  reels.push(
    versending.spoornommer
      ? "Gebruik die spoornommer hierbo om die pakkie na te spoor."
      : "Ons het nie 'n spoornommer vir hierdie versending nie."
  );

  const uitslag = await stuur_epos({
    aan,
    onderwerp: meervoud
      ? `Jou boeke is gestuur — ${bestelnommer}`
      : `${titels[0]} is gestuur — ${bestelnommer}`,
    opskrif: meervoud ? "Jou boeke is op pad" : "Jou boek is op pad",
    reels,
    knoppie: { teks: "Sien dit in My Boeke", url: `${WERF_URL}/my-boeke.html` },
  });

  if (!uitslag.ok) {
    console.error(
      `Versending-kennisgewing vir ${bestelnommer} het misluk:`,
      uitslag.fout
    );
  }

  return uitslag;
}

module.exports = { stuur_versending_kennisgewing };
