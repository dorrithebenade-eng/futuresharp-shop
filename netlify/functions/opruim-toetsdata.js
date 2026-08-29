// netlify/functions/opruim-toetsdata.js
//
// MAAK 'N STORE HEELTEMAL LEEG. Rol: boekhouding.
//
// HIERDIE LEER IS TYDELIK. Hy bestaan om die boekhoustelsel EEN KEER skoon te
// maak voordat sy regtig begin, en hy word daarna uit die repo verwyder. Solank
// hy hier is, kan iemand met die boekhouding-rol elke faktuur in een oproep
// uitvee.
//
// VIER SLOTTE, EN 'N MENS MOET DEUR AL VIER:
//
//   1. TOETSFASE moet AAN wees. Is die stelsel in gebruik, is die veranderlike
//      af en hierdie Function doen niks -- ongeag wie hom roep.
//   2. Die boekhouding-rol.
//   3. 'n Bevestigingswoord in die liggaam. Nie "ja" nie: iets wat 'n mens nie
//      per ongeluk tik nie.
//   4. 'n WIT LYS van stores. `instellings` en `begunstigdes` staan nie daarop
//      nie en kan dus nie geraak word nie, hoe die oproep ook al lyk.
//
// WAAROM 'N WIT LYS EN NIE 'N SWART LYS NIE
//
// 'n Swart lys beskerm wat iemand onthou het om by te voeg. 'n Wit lys beskerm
// alles wat nog nie bestaan nie. Kom daar more 'n store by met werklike data,
// is hy veilig sonder dat iemand daaraan gedink het.
//
// DIE NOMMERREEKS BEGIN NIE OOR NIE.
//
// _fakture.js se BEGIN_NOMMER is 1961, en die volgende nommer is die HOOGSTE
// van BEGIN_NOMMER en die hoogste bestaande. Maak 'n mens die store leeg, val
// die tweede weg en die reeks begin by FS/01961 -- nie by 01957 nie. FS/01957
// tot FS/01960 is werklik uitgereik en daardie nommers word nooit hergebruik
// nie. Dieselfde vir die kwotasies.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");

const ROLLE = ["boekhouding"];
const BEVESTIG = "MAAK DIE TOETSDATA SKOON";

// Die wit lys. Wat nie hier staan nie, kan nie uitgevee word nie.
//
// `instellings`  wat in die kop van elke faktuur staan en die bankbesonderhede
// `begunstigdes` die mense en hul subrekeninge
// `bestellings`  die winkel s'n, nie boekhouding s'n nie
//
// Al drie ontbreek doelbewus.
const TOEGELAAT = [
  "fakture",
  "kwotasies",
  "joernaal",
  "fin-kategoriee",
  "fin-bank",
  "werk-items",
  "kliente",
];

function is_toetsfase() {
  return String(process.env.TOETSFASE || "").trim().toLowerCase() === "aan";
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  // Slot 1. Eerste, en voor die rolkontrole: is die stelsel in gebruik, hoef
  // niemand se rol eens gelees te word nie.
  if (!is_toetsfase()) {
    return {
      statusCode: 409,
      body: "TOETSFASE is af. Hierdie Function doen niks terwyl die stelsel in gebruik is nie.",
    };
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

  if (String(invoer.bevestig || "") !== BEVESTIG) {
    return { statusCode: 400, body: `Stuur bevestig: "${BEVESTIG}"` };
  }

  const gevra = Array.isArray(invoer.stores) ? invoer.stores : [];
  if (!gevra.length) {
    return { statusCode: 400, body: `Gee 'stores'. Toegelaat: ${TOEGELAAT.join(", ")}` };
  }

  const onbekend = gevra.filter((n) => !TOEGELAAT.includes(n));
  if (onbekend.length) {
    return {
      statusCode: 400,
      body: `Nie toegelaat nie: ${onbekend.join(", ")}. Toegelaat: ${TOEGELAAT.join(", ")}`,
    };
  }

  const uitslag = {};

  for (const naam of gevra) {
    try {
      const store = kry_store(naam);
      const { blobs } = await store.list();
      const sleutels = (blobs || []).map((b) => b.key);

      // EEN VIR EEN, en 'n mislukte skrap keer nie die res nie. Blobs se list()
      // is uiteindelik konsekwent; 'n sleutel wat reeds weg is, moet nie die
      // opruiming laat val nie.
      let weg = 0;
      for (const sleutel of sleutels) {
        try {
          await store.delete(sleutel);
          weg += 1;
        } catch (fout) {
          console.error(`Kon nie ${naam}/${sleutel} uitvee nie:`, fout);
        }
      }

      uitslag[naam] = { gevind: sleutels.length, uitgevee: weg };
      console.log(
        `Opruiming: ${naam} — ${weg} van ${sleutels.length} uitgevee deur ${
          (gebruiker && gebruiker.email) || "onbekend"
        }`
      );
    } catch (fout) {
      console.error(`Kon nie die store "${naam}" lees nie:`, fout);
      uitslag[naam] = { fout: "Kon nie die store lees nie" };
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uitslag }),
  };
};
