// public/js/paneel-katalogus-soek.js
//
// Voeg 'n soekveld en 'n sorteerkeuse bo die paneelbord se katalogus-lys.
//
// WAAROM 'N APARTE LÊER: paneelbord.js se wys_produkte_lys() werk reeds en
// word deur laai_produkte() aangeroep. Hierdie lêer omhul daardie funksie
// eerder as om dit te wysig — die oorspronklike bly onaangeraak en teken
// steeds presies dieselfde ry-HTML. Ons besluit net wátter produkte, en in
// watter volgorde, deurgegee word.
//
// EEN SOEKVELD, NIE TWEE NIE: dit soek gelyk oor titel, outeur en slug. 'n
// Aparte "soek op outeur" sou beteken jy moet eers besluit waarna jy soek
// voordat jy kan soek. Slug is ingesluit omdat dit die veld is wat in
// Blobs-sleutels en in opdragte verskyn.
//
// SORTEER OP OUTEUR gebruik die `outeur`-string (die leesbare "A, B en
// C"-vorm), nie outeur_ids nie. 'n Boek met twee outeurs sorteer dus op die
// volle string. Om dit per individuele outeur te laat werk sou outeur_ids
// verg, en ou produkte van voor daardie skuif het dit nie almal nie.

let pks_alle_produkte = [];
let pks_teken_oorspronklik = null;

const PKS_SORTEERDERS = {
  nuutste: (a, b) => String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")),
  titel: (a, b) => pks_vergelyk(a.titel, b.titel),
  outeur: (a, b) => pks_vergelyk(a.outeur, b.outeur) || pks_vergelyk(a.titel, b.titel),
  "prys-op": (a, b) => pks_laagste_prys(a) - pks_laagste_prys(b),
  "prys-af": (a, b) => pks_laagste_prys(b) - pks_laagste_prys(a),
  onaktief: (a, b) =>
    a.aktief === b.aktief ? pks_vergelyk(a.titel, b.titel) : a.aktief ? 1 : -1,
};

function pks_vergelyk(a, b) {
  return String(a || "").localeCompare(String(b || ""), "af", { sensitivity: "base" });
}

// Laagste beskikbare prys oor die drie formate. 'n Boek sonder enige prys
// gaan heel onder in plaas van heel bo.
function pks_laagste_prys(produk) {
  const f = produk.formate || {};
  const pryse = ["eboek", "harde_kopie", "leen"]
    .map((sleutel) => f[sleutel])
    .filter((fmt) => fmt && fmt.beskikbaar && fmt.prys_sent > 0)
    .map((fmt) => fmt.prys_sent);
  return pryse.length ? Math.min(...pryse) : Number.MAX_SAFE_INTEGER;
}

// Kleinletters plus aksente weggestroop, sodat "dorrithe" ook "Dorrithé"
// vind en "gous" ook "Gous".
function pks_normaliseer(teks) {
  return String(teks || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pks_pas_by(produk, term) {
  if (!term) return true;
  const t = pks_normaliseer(term);
  return (
    pks_normaliseer(produk.titel).includes(t) ||
    pks_normaliseer(produk.outeur).includes(t) ||
    pks_normaliseer(produk.slug).includes(t)
  );
}

function pks_bou_balk() {
  const lys = document.getElementById("paneel-produkte-lys");
  if (!lys || document.getElementById("pks-soek")) return;

  const balk = document.createElement("div");
  balk.innerHTML = `
    <div class="pks-balk">
      <label class="pks-soekveld">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input type="text" id="pks-soek" placeholder="Soek op titel, outeur of slug …" autocomplete="off">
        <button type="button" class="pks-wis" id="pks-wis" style="display:none" aria-label="Wis soektog">✕</button>
      </label>
      <select class="pks-sorteer" id="pks-sorteer">
        <option value="nuutste">Nuutste eerste</option>
        <option value="titel">Titel A–Z</option>
        <option value="outeur">Outeur A–Z</option>
        <option value="prys-op">Prys — laagste eerste</option>
        <option value="prys-af">Prys — hoogste eerste</option>
        <option value="onaktief">Onaktiewe eerste</option>
      </select>
    </div>
    <p class="pks-telling" id="pks-telling"></p>
  `;
  lys.parentNode.insertBefore(balk, lys);

  document.getElementById("pks-soek").addEventListener("input", pks_teken);
  document.getElementById("pks-sorteer").addEventListener("change", pks_teken);
  document.getElementById("pks-wis").addEventListener("click", () => {
    document.getElementById("pks-soek").value = "";
    pks_teken();
  });
}

function pks_teken() {
  if (!pks_teken_oorspronklik) return;

  const soekveld = document.getElementById("pks-soek");
  const sorteerveld = document.getElementById("pks-sorteer");
  const term = soekveld ? soekveld.value.trim() : "";
  const sort = sorteerveld ? sorteerveld.value : "nuutste";

  const wis = document.getElementById("pks-wis");
  if (wis) wis.style.display = term ? "block" : "none";

  const gefilter = pks_alle_produkte.filter((p) => pks_pas_by(p, term));
  const gesorteer = [...gefilter].sort(PKS_SORTEERDERS[sort] || PKS_SORTEERDERS.nuutste);

  const telling = document.getElementById("pks-telling");
  if (telling) {
    const onaktief = pks_alle_produkte.filter((p) => !p.aktief).length;
    telling.textContent = term
      ? `${gesorteer.length} van ${pks_alle_produkte.length} boeke`
      : `${pks_alle_produkte.length} ${pks_alle_produkte.length === 1 ? "boek" : "boeke"}${onaktief ? ` · ${onaktief} onaktief` : ""}`;
  }

  // Leë resultaat: die oorspronklike funksie sou "nog geen produkte" wys,
  // wat hier misleidend is — daar ís boeke, net nie een wat pas nie.
  if (term && !gesorteer.length) {
    document.getElementById("paneel-produkte-lys").innerHTML =
      `<p class="stelsel-boodskap">Geen boek pas by “${term}” nie.</p>`;
    return;
  }

  pks_teken_oorspronklik(gesorteer);
}

// Omhul wys_produkte_lys. laai_produkte() gee die VOLLE lys deur; ons hou
// dit, bou die balk indien nodig, en teken dan gefilter. Ons eie oproepe
// hierbo gaan direk na die oorspronklike funksie, nie deur hierdie omhulsel
// nie — anders sou 'n filter die volle lys oorskryf.
function pks_koppel() {
  if (typeof window.wys_produkte_lys !== "function" || pks_teken_oorspronklik) return;

  pks_teken_oorspronklik = window.wys_produkte_lys;

  window.wys_produkte_lys = function (produkte) {
    pks_alle_produkte = Array.isArray(produkte) ? produkte : [];
    if (pks_alle_produkte.length) pks_bou_balk();
    pks_teken();
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", pks_koppel);
} else {
  pks_koppel();
}
