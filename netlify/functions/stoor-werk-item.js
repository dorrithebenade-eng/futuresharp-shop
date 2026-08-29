// netlify/functions/stoor-werk-item.js
//
// Skep of wysig 'n item in die register van werk en uitgawes.
// Rol: boekhouding.
//
// DIE ID WORD BY DIE SKEPPING VASGESTEL EN VERANDER NOOIT. 'n Faktuur se
// begrote ry verwys na daardie slug; verander hy saam met die naam, wys elke
// ou ry na niks. Dieselfde reël as die begunstigde se begunstigde_id.
//
// Wysig 'n mens dus die naam, bly die ID staan. Dit beteken die sleutel kan
// mettertyd van die naam verskil — `reiskoste` vir 'n item wat nou "Reis en
// vervoer" heet — en dit is korrek. Die sleutel is 'n identiteit, nie 'n
// etiket nie.
//
// DAAR IS GEEN SKRAP NIE, net `aktief: false`. 'n Item wat verdwyn, laat elke
// ou faktuur wat daarna verwys halfleeg — dieselfde rede waarom 'n kliënt met
// fakture nie uitgevee kan word nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_werk_items_store,
  maak_slug,
  nuwe_item,
  SOORTE,
  voeg_geskiedenis_by,
} = require("./_werk-items");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const naam = String(invoer.naam || "").trim();
  if (!naam) {
    return { statusCode: 400, body: "Die naam is verplig" };
  }

  const soort = SOORTE.includes(invoer.soort) ? invoer.soort : "uitgawe";
  const beskrywing = String(invoer.beskrywing || "").trim();
  const store = kry_werk_items_store();
  const wie = (gebruiker && gebruiker.email) || "";

  // 'n Bestaande ID beteken wysig; geen ID beteken skep.
  const id_in = String(invoer.item_id || "").trim();

  if (id_in) {
    let rekord;
    try {
      rekord = await store.get(id_in, { type: "json" });
    } catch (fout) {
      console.error(`Kon nie item ${id_in} lees nie:`, fout);
      return { statusCode: 500, body: "Kon nie die item laai nie" };
    }
    if (!rekord) return { statusCode: 404, body: "Item nie gevind nie" };

    rekord.soort = soort;
    rekord.naam = naam;
    rekord.beskrywing = beskrywing;
    rekord.aktief = invoer.aktief !== false;
    // Geen kontrole dat die kategorie bestaan nie: die keuselys bied slegs
    // bestaandes aan, en skrap-fin-kategorie.js weier om een uit te vee wat
    // gebruik word. Dieselfde redenasie as by stoor-joernaal.js.
    rekord.kategorie_id = String(invoer.kategorie_id || "").trim().slice(0, 120);
    rekord.bygewerk_op = new Date().toISOString();

    voeg_geskiedenis_by(rekord, rekord.aktief ? "gewysig" : "afgeskakel", wie, "");

    try {
      await store.setJSON(id_in, rekord);
    } catch (fout) {
      console.error("Kon nie die item stoor nie:", fout);
      return { statusCode: 500, body: "Kon nie die item stoor nie" };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: id_in, nuut: false }),
    };
  }

  const item_id = maak_slug(naam);
  if (!item_id) {
    return { statusCode: 400, body: "Die naam moet minstens een letter of syfer bevat" };
  }

  // DIE NAAM MOET UNIEK WEES, want die slug is die sleutel. Twee items wat
  // "Reiskoste" heet, sou dieselfde rekord wees en die tweede sou die eerste
  // stilweg oorskryf.
  let bestaande;
  try {
    bestaande = await store.get(item_id, { type: "json" });
  } catch {
    bestaande = null;
  }
  if (bestaande) {
    return { statusCode: 409, body: "Daar is reeds 'n item met hierdie naam" };
  }

  const rekord = nuwe_item(soort, naam, beskrywing);
  // Ook op die SKEP-pad. nuwe_item() gee 'n leë kategorie; sonder hierdie reel
  // sou 'n mens 'n item skep, die kategorie kies, en dan is sy weg.
  rekord.kategorie_id = String(invoer.kategorie_id || "").trim().slice(0, 120);
  voeg_geskiedenis_by(rekord, "geskep", wie, "");

  try {
    await store.setJSON(item_id, rekord);
  } catch (fout) {
    console.error("Kon nie die item skep nie:", fout);
    return { statusCode: 500, body: "Kon nie die item stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id, nuut: true }),
  };
};
