// Gedeelde mandjie-module. Mandjie word in localStorage gestoor (net
// klant-kant, tydelik) — die bestelling word eers 'n permanente rekord
// sodra betaling voltooi en Paystack-betaling geverifieer is (Fase 3).
//
// Mandjie-item-vorm:
// { produk_slug, titel, formaat: "eboek" | "harde_kopie", prys_sent }
//
// LET WEL: die Identity-token-herleiding (na paneelbord.html) leef NIE
// hier nie — dit moet as 'n inline skrip heel eerste in elke bladsy se
// <head> loop, VOOR die Identity-widget se eie skrip, want die widget
// verwerk 'n token in die URL outomaties sodra sy eie skrip laai. As
// die herleiding hier in 'n eksterne lêer onderaan die bladsy sou sit,
// het die widget die token klaar "opgeëet" teen die tyd dat dit loop.

const MANDJIE_SLEUTEL = "future_shop_mandjie";

function kry_mandjie() {
  try {
    const ruwe = localStorage.getItem(MANDJIE_SLEUTEL);
    return ruwe ? JSON.parse(ruwe) : [];
  } catch {
    return [];
  }
}

function stoor_mandjie(items) {
  localStorage.setItem(MANDJIE_SLEUTEL, JSON.stringify(items));
  wys_mandjie_teller();
}

function voeg_by_mandjie(item) {
  const items = kry_mandjie();

  // Verhoed duplikate: dieselfde produk + formaat kombinasie kan nie
  // twee keer bygevoeg word nie (elke boek word as 'n enkele eksemplaar
  // per formaat verkoop, nie hoeveelheid-gebaseerd nie).
  const bestaan_reeds = items.some(
    (i) => i.produk_slug === item.produk_slug && i.formaat === item.formaat
  );
  if (bestaan_reeds) return { reeds_in_mandjie: true };

  items.push(item);
  stoor_mandjie(items);
  return { reeds_in_mandjie: false };
}

function verwyder_uit_mandjie(produk_slug, formaat) {
  const items = kry_mandjie().filter(
    (i) => !(i.produk_slug === produk_slug && i.formaat === formaat)
  );
  stoor_mandjie(items);
}

function kry_mandjie_totaal_sent() {
  return kry_mandjie().reduce((som, item) => som + item.prys_sent, 0);
}

function mandjie_bevat_harde_kopie() {
  return kry_mandjie().some((i) => i.formaat === "harde_kopie");
}

function wys_mandjie_teller() {
  const teller = document.getElementById("mandjie-teller");
  if (!teller) return;
  const aantal = kry_mandjie().length;
  teller.textContent = aantal > 0 ? aantal : "";
  teller.style.display = aantal > 0 ? "inline-flex" : "none";
}

function is_voorbestelling(formaat_data) {
  if (!formaat_data || !formaat_data.vrystelling_datum) return false;
  const vrystelling = new Date(formaat_data.vrystelling_datum);
  if (Number.isNaN(vrystelling.getTime())) return false;
  const vandag = new Date();
  vandag.setHours(0, 0, 0, 0);
  return vrystelling > vandag;
}

function formateer_datum_af(datum_string) {
  const datum = new Date(datum_string);
  if (Number.isNaN(datum.getTime())) return "";
  return datum.toLocaleDateString("af-ZA", { day: "numeric", month: "long", year: "numeric" });
}

// Identity-widget-afhanklikheid is heeltemal verwyder (sien
// public/js/identiteit.js) — dit het herhaaldelik gebreek wanneer
// algemene blaaier-uitbreidings (bv. Adobe Acrobat, Google Docs Offline)
// op dieselfde bladsy inspuit. Ons eie identiteit.js praat direk met
// Netlify se onderliggende Identity-API, sonder enige derdeparty-skrip
// wat kan inmeng.

document.addEventListener("DOMContentLoaded", wys_mandjie_teller);
