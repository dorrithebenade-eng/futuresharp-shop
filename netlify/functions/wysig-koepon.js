// Personeel-beskermd — wysig 'n koepon. Twee soorte versoeke:
//
//   { kode, aktief }        skakel net die "aktief"-status aan/af (die
//                           Aktiveer/Deaktiveer-knoppie in die lys).
//   { kode, wysig: true, … } stoor die koeponvorm se velde (die Wysig-
//                           knoppie). Die reëls is dieselfde as by die
//                           skep (_koepon-velde.js).
//
// By 'n wysiging bly die kode, die gebruike en hul geskiedenis, aktief en
// koper_id_beperking soos hulle is. Die maksimum aantal gebruike kan nie
// laer gestel word as die gebruike tot dusver nie.
//
// Skrap nooit die rekord nie (soos produk-deaktivering) — 'n reeds-gebruikte
// geskiedenis moet behoue bly vir jou eie oorsig, selfs as die kode self
// nie meer bruikbaar is nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { bou_koepon_velde } = require("./_koepon-velde");

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

  if (invoer.wysig === true) return wysig_velde(invoer, gebruiker);

  const { kode, aktief } = invoer;
  if (!kode || typeof aktief !== "boolean") {
    return { statusCode: 400, body: JSON.stringify({ fout: "Verpligte velde: kode, aktief" }) };
  }

  try {
    const store = kry_store("koepons");
    const koepon = await store.get(kode, { type: "json" });
    if (!koepon) {
      return { statusCode: 404, body: JSON.stringify({ fout: `Geen koepon met kode "${kode}" nie` }) };
    }

    koepon.aktief = aktief;
    await store.setJSON(kode, koepon);

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (fout) {
    console.error("wysig-koepon fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie koepon wysig nie" }) };
  }
};

async function wysig_velde(invoer, gebruiker) {
  const kode = String(invoer.kode || "").trim().toUpperCase();
  if (!kode) return { statusCode: 400, body: JSON.stringify({ fout: "Verpligte veld: kode" }) };

  const gebou = bou_koepon_velde(invoer);
  if (gebou.fout) return { statusCode: 400, body: JSON.stringify({ fout: gebou.fout }) };
  const { velde } = gebou;

  try {
    const store = kry_store("koepons");
    const koepon = await store.get(kode, { type: "json" });
    if (!koepon) {
      return { statusCode: 404, body: JSON.stringify({ fout: `Geen koepon met kode "${kode}" nie` }) };
    }
    const gebruik = koepon.gebruike_tot_dusver || 0;
    if (velde.maks_gebruike < gebruik) {
      return {
        statusCode: 400,
        body: JSON.stringify({ fout: `Hierdie kode is reeds ${gebruik} keer gebruik; die maksimum kan nie laer as ${gebruik} wees nie` }),
      };
    }

    const bygewerk = {
      ...koepon,
      ...velde,
      gewysig_deur: gebruiker.email,
      gewysig_op: new Date().toISOString(),
    };
    await store.setJSON(kode, bygewerk);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ koepon: bygewerk }) };
  } catch (fout) {
    console.error("wysig-koepon fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie koepon wysig nie" }) };
  }
}
