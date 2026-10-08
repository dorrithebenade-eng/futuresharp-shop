// Personeel-beskermd — skep 'n nuwe koepon-rekord in die "koepons"-store.
//
// Twee tipes koepon (sien "tipe"-veld):
//   - "gratis": geen Paystack-transaksie by verlossing nie — die koper kry
//     die boek direk, die outeur kry niks vir daardie eksemplaar nie.
//   - "afslag": 'n regte, verminderde Paystack-transaksie — outeur-verdeling
//     werk normaal op die kleiner bedrag.
//
// Hierdie Function skep net die rekord — verlossing (die koper-kant, waar
// die kode werklik teen 'n bestelling toegepas word) is 'n aparte stap wat
// nog gebou moet word.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { bou_koepon_velde } = require("./_koepon-velde");

function maak_koepon_kode() {
  // Leesbaar-genoeg vir 'n mens om oor die telefoon deur te gee, maar
  // steeds moeilik om per ongeluk te raai. Sluit dubbelsinnige karakters
  // (0/O, 1/I/L) uit.
  const karakters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let kode = "";
  for (let i = 0; i < 8; i++) {
    kode += karakters[Math.floor(Math.random() * karakters.length)];
  }
  return kode;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: JSON.stringify({ fout: "Geen toegang nie — personeel-rol vereis" }) };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ongeldige JSON" }) };
  }

  // Die vormvelde se reëls leef in _koepon-velde.js (gedeel met
  // wysig-koepon.js).
  const gebou = bou_koepon_velde(invoer);
  if (gebou.fout) {
    return { statusCode: 400, body: JSON.stringify({ fout: gebou.fout }) };
  }
  const { velde } = gebou;

  // Bind hierdie kode aan net EEN spesifieke koper (gebruik vir outomaties-
  // gegenereerde leen-na-koop-opgradering-koepons). Leeg/null = enigeen mag
  // dit verlos (die normale geval vir personeel-geskepte koepons).
  const koper_id_beperking = invoer.koper_id_beperking
    ? String(invoer.koper_id_beperking).trim()
    : null;

  const store = kry_store("koepons");

  // Kode: personeel se eie voorkeur, of outomaties gegenereer as leeg
  // gelaat. Probeer 'n paar keer indien daar toevallig reeds 'n botsing is
  // (uiters onwaarskynlik, maar goedkoop om te waarborg).
  let kode = invoer.kode ? String(invoer.kode).trim().toUpperCase() : "";
  if (!kode) {
    let pogings = 0;
    do {
      kode = maak_koepon_kode();
      pogings++;
    } while ((await store.get(kode, { type: "json" })) && pogings < 5);
  }

  if (!/^[A-Z0-9-]{3,24}$/.test(kode)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ fout: "Kode moet 3-24 karakters wees (letters, syfers, koppeltekens)" }),
    };
  }

  const bestaande = await store.get(kode, { type: "json" });
  if (bestaande) {
    return { statusCode: 409, body: JSON.stringify({ fout: `Koepon-kode "${kode}" bestaan reeds` }) };
  }

  const koepon = {
    kode,
    tipe: velde.tipe,
    afslag_tipe: velde.afslag_tipe,
    afslag_waarde: velde.afslag_waarde,
    produk_slug: velde.produk_slug,
    formaat_beperking: velde.formaat_beperking,
    koper_id_beperking,
    maks_gebruike: velde.maks_gebruike,
    gebruike_tot_dusver: 0,
    // Onthou WIE reeds hierdie kode teen WATTER boek gebruik het, sodat ons
    // "een keer per boek per persoon" kan afdwing selfs by 'n
    // veelvuldig-herbruikbare kode.
    gebruike_geskiedenis: [],
    verval_op: velde.verval_op,
    aktief: true,
    outeur_id: velde.outeur_id,
    spreker_id: velde.spreker_id,
    nota: velde.nota,
    geskep_deur: gebruiker.email,
    geskep_op: new Date().toISOString(),
  };

  try {
    await store.setJSON(kode, koepon);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ koepon }) };
  } catch (fout) {
    console.error("skep-koepon fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie koepon skep nie, probeer later weer" }) };
  }
};
