// netlify/functions/aktiveer-fin-kategorie.js
//
// Heraktiveer een gedeaktiveerde finansiele kategorie. Rol: boekhouding.
//
// DIE TEENHANGER VAN skrap-fin-kategorie.js SE TWEEDE UITKOMS. Daardie leer
// sit `aktief: false` op 'n kategorie wat reeds inskrywings dra; hierdie een
// sit die veld terug op true.
//
// WAAROM 'N EIE LEER EN NIE 'N VELD OP DIE VORM NIE.
//
// Sou stoor-fin-kategorie.js 'n `aktief` uit die vorm aanvaar, sou elke
// gewone wysiging aan 'n gedeaktiveerde kategorie dit stilweg heraktiveer --
// die vorm stuur al die velde, en 'n ontbrekende een lees as false. Die
// heraktivering is 'n eie handeling met 'n eie knoppie, en skryf net die een
// veld.
//
// DIE VASTE TWEE KOM NIE HIER NIE. Hulle word nooit gedeaktiveer nie, want
// skrap-fin-kategorie.js weier hulle voor die tel. Die kontrole staan
// nietemin hier: 'n leer wat na 'n store skryf, aanvaar nie dat 'n ander leer
// die poort was nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fin_kategoriee_store, VAS } = require("./_fin-kategoriee");

const ROLLE = ["boekhouding"];

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

  const id = String(invoer.id || "").trim();
  if (!id) return { statusCode: 400, body: "Verpligte veld: id" };

  const store = kry_fin_kategoriee_store();

  let kategorie = null;
  try {
    kategorie = await store.get(id, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie kategorie "${id}" lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kategorie laai nie" };
  }

  // 'n VASTE KATEGORIE WAT NOG NOOIT GESTOOR IS, STAAN NIE IN DIE STORE NIE en
  // is per definisie aktief. Daar is niks om te doen nie.
  if (!kategorie) {
    if (VAS[id]) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, aktief: true }),
      };
    }
    return { statusCode: 404, body: "Kategorie nie gevind nie" };
  }

  // DIE HOOFKATEGORIE MOET AKTIEF WEES. 'n Aktiewe subkategorie onder 'n
  // gedeaktiveerde hoofkategorie staan in die keuselys sonder 'n leesbare pad,
  // en die staat sou dit onder 'n kop tel wat nie meer aangebied word nie.
  if (kategorie.onder) {
    let ouer = null;
    try {
      ouer = await store.get(kategorie.onder, { type: "json" });
    } catch (fout) {
      console.error(`Kon nie die hoofkategorie "${kategorie.onder}" lees nie:`, fout);
      return { statusCode: 500, body: "Kon nie die hoofkategorie laai nie" };
    }
    if (ouer && ouer.aktief === false) {
      return {
        statusCode: 409,
        body: `Die hoofkategorie "${ouer.naam}" is gedeaktiveer. Aktiveer eers daardie kategorie.`,
      };
    }
  }

  const rekord = {
    ...kategorie,
    aktief: true,
    bygewerk_op: new Date().toISOString(),
  };

  try {
    await store.setJSON(id, rekord);
  } catch (fout) {
    console.error(`Kon nie kategorie "${id}" aktiveer nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kategorie aktiveer nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kategorie: rekord }),
  };
};
