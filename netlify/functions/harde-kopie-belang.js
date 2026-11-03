// netlify/functions/harde-kopie-belang.js
//
// PUBLIEK: 'n besoeker druk "Laat weet my" by 'n boek se harde kopie.
// Sien _harde-kopie-belang.js vir die hele storie.
//
// POST { slug, epos, taal, pot }
//
// Is die besoeker aangemeld (Bearer-token), gebruik ons sy profiel se
// e-posadres en ignoreer die veld. Anders moet "epos" 'n geldige adres wees.
// "pot" is 'n versteekte veld wat 'n mens nooit invul nie; 'n robot wel. Is
// dit gevul, sê ons dankie en stoor niks.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { teken_aan, skoon_epos, skoon_slug } = require("./_harde-kopie-belang");

function antwoord(kode, data) {
  return {
    statusCode: kode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(data),
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return antwoord(400, { fout: "Ongeldige versoek" });
  }

  if (invoer.pot) return antwoord(200, { ok: true });

  const slug = skoon_slug(invoer.slug);
  if (!slug) return antwoord(400, { fout: "Onbekende boek" });

  let epos = "";
  const het_token = !!(event.headers && (event.headers.authorization || event.headers.Authorization));
  if (het_token) {
    const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
    if (gebruiker && gebruiker.email) epos = skoon_epos(gebruiker.email);
  }
  if (!epos) epos = skoon_epos(invoer.epos);
  if (!epos) return antwoord(400, { fout: "epos" });

  try {
    const produk = await kry_store("katalogus").get(slug, { type: "json" });
    if (!produk || !produk.aktief || produk.vra_harde_kopie !== true) {
      return antwoord(404, { fout: "Onbekende boek" });
    }
    const hk = produk.formate && produk.formate.harde_kopie;
    if (hk && hk.beskikbaar) return antwoord(200, { ok: true, reeds_beskikbaar: true });

    await teken_aan(slug, epos, invoer.taal);
    return antwoord(200, { ok: true });
  } catch (fout) {
    console.error("harde-kopie-belang:", fout);
    return antwoord(500, { fout: "Kon nie stoor nie" });
  }
};
