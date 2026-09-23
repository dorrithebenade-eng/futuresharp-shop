// fst-gedeel.js — hulpfunksies vir die FST-blad en die talk-bladsy.
// Laai na taal.js en fst-taal.js.

const FST_KATALOGUS = "/.netlify/functions/kry-fst-katalogus";

// Dieselfde kleure as die omslag (talk-omslag.js), vir die gloed agter
// 'n talk op sy eie bladsy.
const FST_KLEURE = {
  navorsing: "#3FB6A4",
  besigheid: "#F1BD43",
  medisyne: "#EC5832",
  praktyk: "#479F91",
};

function fst_esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fst_kategorie_naam(kategoriee, id) {
  const k = (kategoriee || []).find((x) => x.id === id);
  if (!k) return "";
  return kry_huidige_taal() === "en" ? k.naam_en : k.naam_af;
}

function fst_duur(sekondes) {
  if (!sekondes) return "";
  return `${Math.max(1, Math.round(sekondes / 60))} ${t("fst_min")}`;
}

function fst_prys(sent) {
  return t_rand(sent, kry_huidige_taal());
}

function fst_datum(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(kry_huidige_taal() === "en" ? "en-ZA" : "af-ZA", { day: "numeric", month: "long", year: "numeric" });
}

// Die klein woordmerk vir die kop: FutureSharp, die vyf blokkies op die
// goue lyn, en die kamera op die K.
function fst_woordmerk_klein() {
  return `<span class="fst-wm fst-wm-klein" aria-label="FutureSharp Talks">
    <span class="fst-wm-naam">FutureSharp</span>
    <span class="fst-wm-blokwrap">
      <span class="fst-wm-blokke">${fst_kamera()}<b class="fst-b-t">T</b><b class="fst-b-g">A</b><b class="fst-b-k">L</b><b class="fst-b-t">K</b><b class="fst-b-g">S</b></span>
      <span class="fst-wm-vloer"></span>
    </span>
  </span>`;
}

function fst_kamera() {
  return `<svg class="fst-wm-kamera" viewBox="0 0 64 44" aria-hidden="true"><g fill="#fff" stroke="#171717" stroke-width="2.4" stroke-linejoin="round"><circle cx="16" cy="11" r="9"/><circle cx="36" cy="11" r="9"/><rect x="6" y="20" width="40" height="20" rx="2"/><path d="M46 25 L60 19 V41 L46 35 Z"/></g><g fill="#171717"><circle cx="16" cy="11" r="2.4"/><circle cx="36" cy="11" r="2.4"/><rect x="11" y="26" width="14" height="3" rx="1"/></g></svg>`;
}

function fst_klapbord() {
  return `<svg class="fst-wm-klap" viewBox="0 0 48 44" aria-hidden="true"><g stroke="#171717" stroke-width="2.4" stroke-linejoin="round"><rect x="4" y="16" width="40" height="26" rx="2" fill="#fff"/><path d="M4 16 L42 6 L44 14 L6 24 Z" fill="#fff" transform="rotate(-12 4 16)"/></g><g fill="#171717"><path d="M12 13.5 l6-1.6 5 6 -6 1.6z" transform="rotate(-12 4 16)"/><path d="M26 9.8 l6-1.6 5 6 -6 1.6z" transform="rotate(-12 4 16)"/><rect x="10" y="30" width="28" height="3" rx="1"/></g></svg>`;
}

function fst_kop(met_terug_na_alle) {
  const terug = met_terug_na_alle
    ? `<a class="fst-terug" href="/talks">‹ ${fst_esc(t("fst_alle_talks"))}</a>`
    : `<a class="fst-terug" href="/">‹ ${fst_esc(t("fst_terug"))}</a>`;
  return `<header class="fst-kop"><div class="fst-kop-in">
    ${terug}
    <a class="fst-kop-merk" href="/talks">${fst_woordmerk_klein()}</a>
    <a class="fst-kop-teater${window.location.pathname.startsWith("/teater") ? " fst-kop-teater-aan" : ""}" href="/teater">${fst_esc(t("fst_my_teater"))}</a>
    <div class="taal-wisselaar fst-taal" role="group" aria-label="Taal / Language">
      <button type="button" class="taal-knoppie" data-taal="af">AF</button>
      <button type="button" class="taal-knoppie" data-taal="en">EN</button>
    </div>
  </div></header>`;
}
