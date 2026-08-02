// public/js/katalogus-sorteer.js
//
// Voeg 'n sorteerkeuse by die winkel se katalogus, langs die kategorie-
// skyfies.
//
// WAAROM 'N APARTE LÊER: katalogus.js se wys_produkte() en pas_filter_toe()
// werk reeds. Hierdie lêer omhul wys_produkte eerder as om dit te wysig —
// die kategorie-filter besluit WATTER boeke, ons besluit net in WATTER
// VOLGORDE. Die twee raak mekaar nie.
//
// WAT DIE NAVORSING SÊ, EN WAAROM ONS NOG NIE DAAR IS NIE:
// Groot platforms se verstek is 'n saamgestelde volgorde ("Featured") wat
// die winkel self beheer, nie "nuutste" nie. Baymard beveel dit aan; die
// meeste winkelbouers stel dit as verstek vir 'n nuwe winkel. Dieselfde
// geld vir "Bestsellers", wat in toetse goed vaar.
//
// Albei is vir Future Shop nog verkeerd, om een rede: die katalogus het 'n
// handjievol boeke. 'n Koper sien alles in een oogopslag, en 'n
// bestsellerlys waar één verkoop die volgorde omkeer, is ruis eerder as
// inligting. "Nuutste eerste" is die eerlike keuse solank die lys klein is.
//
// HOE OM DIT LATER TE VERANDER:
//   1. Nuwe verstek → verander KS_VERSTEK hieronder. Dis al.
//   2. Eie volgorde → voeg 'n `volgorde`-veld (getal) by die produkskema
//      in skep-produk.js/wysig-produk.js, sit 'n sorteerder by
//      KS_SORTEERDERS, en 'n opsie by KS_OPSIES. Niks anders verander nie.
//   3. Bestsellers → die tellers bestaan reeds op elke produk
//      (aankope_eboek, aankope_leen, ens.); dis 'n sorteerder wat hulle
//      optel. Noem dit "Gewildste", nie "Gewild" nie — toetsgebruikers lees
//      "gewild" as "topverkoper" en word mislei wanneer dit iets anders is.

const KS_VERSTEK = "nuutste";
const KS_BERGING_SLEUTEL = "future_shop_katalogus_sorteer";

// Volgorde hier bepaal die volgorde in die aflysie.
const KS_OPSIES = ["nuutste", "titel", "outeur", "prys_op", "prys_af"];

function ks_vergelyk(a, b) {
  return String(a || "").localeCompare(String(b || ""), "af", { sensitivity: "base" });
}

// Laagste beskikbare prys oor die drie formate. 'n Boek sonder prys gaan
// heel onder in plaas van heel bo.
function ks_laagste_prys(produk) {
  const formate = produk.formate || {};
  const pryse = ["eboek", "harde_kopie", "leen"]
    .map((sleutel) => formate[sleutel])
    .filter((fmt) => fmt && fmt.beskikbaar && fmt.prys_sent > 0)
    .map((fmt) => fmt.prys_sent);
  return pryse.length ? Math.min(...pryse) : Number.MAX_SAFE_INTEGER;
}

// Elke sorteerder val op titel terug, sodat twee boeke met dieselfde datum
// of prys nie by elke bladsylaai van plek ruil nie.
const KS_SORTEERDERS = {
  nuutste: (a, b) =>
    String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")) || ks_vergelyk(a.titel, b.titel),
  titel: (a, b) => ks_vergelyk(a.titel, b.titel),
  outeur: (a, b) => ks_vergelyk(a.outeur, b.outeur) || ks_vergelyk(a.titel, b.titel),
  prys_op: (a, b) => ks_laagste_prys(a) - ks_laagste_prys(b) || ks_vergelyk(a.titel, b.titel),
  prys_af: (a, b) => ks_laagste_prys(b) - ks_laagste_prys(a) || ks_vergelyk(a.titel, b.titel),
};

function ks_kry_gekose() {
  try {
    const gestoor = localStorage.getItem(KS_BERGING_SLEUTEL);
    if (gestoor && KS_SORTEERDERS[gestoor]) return gestoor;
  } catch (fout) {
    // Privaat blaaimodus kan localStorage weier — val net terug op die
    // verstek in plaas van om die katalogus te laat omval.
  }
  return KS_VERSTEK;
}

function ks_stoor_gekose(waarde) {
  try {
    localStorage.setItem(KS_BERGING_SLEUTEL, waarde);
  } catch (fout) {
    // Sien hierbo — 'n mislukte stoor is nie 'n fout wat die koper raak nie.
  }
}

// Die kategorie-skyfies en die sorteerkeuse deel een ry. katalogus.js
// oorskryf slegs #katalogus-filter se innerHTML, nooit sy posisie nie, dus
// is dit veilig om dit binne 'n omhulsel te skuif.
function ks_bou_kontrole() {
  const filter = document.getElementById("katalogus-filter");
  if (!filter || document.getElementById("katalogus-sorteer")) return;

  const balk = document.createElement("div");
  balk.className = "katalogus-balk";
  filter.parentNode.insertBefore(balk, filter);
  balk.appendChild(filter);

  const gekose = ks_kry_gekose();
  const blok = document.createElement("div");
  blok.className = "katalogus-sorteer";
  blok.innerHTML = `
    <label class="katalogus-sorteer-etiket" for="katalogus-sorteer">${t("sorteer_etiket")}</label>
    <select id="katalogus-sorteer">
      ${KS_OPSIES.map(
        (sleutel) =>
          `<option value="${sleutel}"${sleutel === gekose ? " selected" : ""}>${t("sorteer_" + sleutel)}</option>`
      ).join("")}
    </select>
  `;
  balk.appendChild(blok);

  document.getElementById("katalogus-sorteer").addEventListener("change", (ev) => {
    ks_stoor_gekose(ev.target.value);
    if (typeof pas_filter_toe === "function") pas_filter_toe();
  });
}

// Omhul wys_produkte. Die tweede argument (besit_stel ens.) gaan
// onveranderd deur — ons raak net die volgorde van die eerste aan.
function ks_koppel() {
  if (typeof window.wys_produkte !== "function" || window.ks_oorspronklik) return;

  window.ks_oorspronklik = window.wys_produkte;

  window.wys_produkte = function (produkte, opsies) {
    if (Array.isArray(produkte) && produkte.length) ks_bou_kontrole();
    const sorteerder = KS_SORTEERDERS[ks_kry_gekose()] || KS_SORTEERDERS[KS_VERSTEK];
    const gesorteer = Array.isArray(produkte) ? [...produkte].sort(sorteerder) : produkte;
    return window.ks_oorspronklik(gesorteer, opsies);
  };
}

// taal.js herlaai die bladsy by 'n taalwissel, dus is die etikette altyd
// vars — geen herbou-logika nodig nie.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ks_koppel);
} else {
  ks_koppel();
}
