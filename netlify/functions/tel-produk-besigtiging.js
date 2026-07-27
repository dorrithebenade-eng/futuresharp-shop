// PUBLIEK — tel een "besigtiging" (belangstelling-punt) vir 'n spesifieke
// produk, elke keer die produk-bladsy vir daardie boek gelaai word. Geen
// persoonlike inligting gestoor nie — net 'n lopende totaal per boek,
// direk op die produk se eie rekord (`besigtigings`-veld) sodat dit
// outomaties saam met die res van die produk-data deur kry-katalogus.js
// en die paneelbord se produklys beskikbaar is, sonder 'n aparte store.

const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const slug = (invoer.slug || "").trim();
  if (!slug) {
    return { statusCode: 400, body: "Verpligte veld: slug" };
  }

  const store = kry_store("katalogus");
  const produk = await store.get(slug, { type: "json" });
  if (!produk) {
    // Stil faal — 'n verkeerde/verouderde slug moet nie 'n fout op die
    // koper se skerm veroorsaak nie, dis 'n agtergrond-telling.
    return { statusCode: 204, body: "" };
  }

  const bygewerk = {
    ...produk,
    besigtigings: (produk.besigtigings || 0) + 1,
  };

  await store.setJSON(slug, bygewerk);

  return { statusCode: 204, body: "" };
};
