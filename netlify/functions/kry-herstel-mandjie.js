// netlify/functions/kry-herstel-mandjie.js
//
// Die skakel in die mandjie-herinnering (sien mandjie-herinnering.js) land
// op herstel-mandjie.html, wat hierdie Function vra wat in die mandjie moet
// kom. So werk die skakel ook op 'n ander toestel as die een waarop die
// koper begin het: die mandjie leef op die toestel, die bestelling nie.
//
// GEEN AANMELDING NIE. Die koper klik in sy e-pos; hy is dalk nie aangemeld
// nie. Die beskerming is die teken: 'n lukrake string wat net in die pos
// staan en saam met die bestelling gestoor is. Die bestelnommer alleen is
// nie genoeg nie (dit is net ses syfers).
//
// WAT TERUGKOM, IS NET WAT 'N MANDJIE NODIG HET: titels, formate en die
// HUIDIGE katalogusprys, plus die koepon wat die koper self ingetik het.
// Geen adres, e-pos of selfoonnommer nie.
//
// Antwoord: { stand: "ok" | "verval" | "betaal" | "ongeldig", ... }

const { kry_store } = require("./_blob-store");
const { kry_formaat_data } = require("./_harde-kopie-opsies");

function antwoord(liggaam) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(liggaam),
  };
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const bestelnommer = String(q.b || "").trim();
  const teken = String(q.t || "").trim();
  if (!bestelnommer || !teken || bestelnommer.length > 40 || teken.length > 80) {
    return antwoord({ stand: "ongeldig" });
  }

  const b = await kry_store("bestellings").get(bestelnommer, { type: "json" }).catch(() => null);
  const h = b && b.herinnering;
  if (!b || !h || !h.teken || h.teken !== teken) return antwoord({ stand: "ongeldig" });

  const taal = h.taal === "en" ? "en" : "af";
  if (b.status === "Nuut") return antwoord({ stand: "betaal", taal });

  const verval = new Date(h.verval_op).getTime();
  if (b.status !== "Wag vir betaling" || !Number.isFinite(verval) || Date.now() >= verval) {
    return antwoord({ stand: "verval", taal });
  }

  const katalogus = kry_store("katalogus");
  const hk_geskenk = !!(b.aflewering && b.aflewering.geskenk);
  const items = [];
  for (const i of b.items || []) {
    if (!i || !i.produk_slug || !i.formaat) continue;
    const produk = await katalogus.get(i.produk_slug, { type: "json" }).catch(() => null);
    if (!produk || !produk.aktief) continue;
    const fd = kry_formaat_data(produk, i.formaat, i.opsie);
    if (!fd || !fd.beskikbaar) continue;

    // Dieselfde vorm as koop.js en produk.js se mandjie-items.
    const item = {
      produk_slug: produk.slug,
      titel: produk.titel,
      formaat: i.formaat,
      prys_sent: Number(fd.prys_sent) || 0,
    };
    if (fd.opsie) {
      item.opsie = fd.opsie.sleutel;
      item.opsie_naam = fd.opsie.naam;
      if (fd.opsie.kaartjie === true) item.kaartjie = true;
    } else if (i.formaat === "harde_kopie" && produk.kaartjie_boodskap === true) {
      item.kaartjie = true;
    }
    if (i.geskenk === true || (hk_geskenk && i.formaat === "harde_kopie")) item.geskenk = true;
    items.push(item);
  }

  if (!items.length) return antwoord({ stand: "verval", taal });

  const koepon =
    (Array.isArray(b.koepons_toegepas) && b.koepons_toegepas[0] && b.koepons_toegepas[0].kode) ||
    (b.koepon_toegepas && b.koepon_toegepas.kode) ||
    null;

  return antwoord({ stand: "ok", taal, bestelnommer, items, koepon, verval_op: h.verval_op });
};
