// PUBLIEK — tel een "besigtiging" (belangstelling-punt) vir 'n spesifieke
// produk, elke keer die produk-bladsy vir daardie boek gelaai word. Geen
// persoonlike inligting gestoor nie — net 'n lopende totaal per boek,
// direk op die produk se eie rekord (`besigtigings`-veld) sodat dit
// outomaties saam met die res van die produk-data deur kry-katalogus.js
// en die paneelbord se produklys beskikbaar is, sonder 'n aparte store.
//
// SEDERT AUG 2026 ook `besigtigings_maand`: dieselfde telling, per maand.
// Die outeur se staat vra "hoeveel in Julie?", en die lopende totaal kan
// dit nie beantwoord nie. Die veld begin leeg en vul homself — alles voor
// die dag waarop dit gebou is, bestaan nie, en `besigtigings` bly die
// enigste volledige syfer.

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

  // Die lopende totaal BLY presies soos hy is — kry-my-titels.js,
  // kry-verslag.js en die paneelbord lees hom, en niks daarvan verander.
  //
  // Die maandvakkie kom LANGS hom, want een lopende getal kan nooit sê
  // hoeveel dit in Julie was nie: daardie inligting is nêrens gestoor en
  // kan nie agterna afgelei word nie. Sleutel is "2026-08" — die maand in
  // UTC, dieselfde tydsone as elke ander datum in die stelsel, sodat 'n
  // besigtiging om 01:00 nie in twee verskillende maande kan val
  // afhangende van wie die som doen nie.
  const maand = new Date().toISOString().slice(0, 7);
  const per_maand = { ...(produk.besigtigings_maand || {}) };
  per_maand[maand] = (per_maand[maand] || 0) + 1;

  const bygewerk = {
    ...produk,
    besigtigings: (produk.besigtigings || 0) + 1,
    besigtigings_maand: per_maand,
  };

  await store.setJSON(slug, bygewerk);

  return { statusCode: 204, body: "" };
};
