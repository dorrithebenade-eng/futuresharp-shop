// Personeel-beskermd — skakel 'n koepon se "aktief"-status aan/af. Skrap
// nie die rekord nie (soos produk-deaktivering) — 'n reeds-gebruikte
// geskiedenis moet behoue bly vir jou eie oorsig, selfs as die kode self
// nie meer bruikbaar is nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

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
