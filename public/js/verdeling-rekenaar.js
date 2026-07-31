// public/js/verdeling-rekenaar.js
//
// Interne beplanningshulpmiddel (personeel-alleen, leef binne die
// paneelbord se "Verdeling-rekenaar"-afdeling). Wys hoeveel 'n boek moet
// kos, en wat elke party ontvang, gegewe 'n outeur-persentasie, die
// outeur se beoogde wins (T), hul eie druk-/afleweringskoste (K, net vir
// Harde kopie), en Future Sharp se eie koste-lyne (Paystack, Hosting,
// Admin, Ontwerp). Twee scenario's langs mekaar (A/B) sodat personeel
// dadelik 'n vergelyking kan wys tydens 'n gesprek — bv. 68% teenoor 70%.
//
// Suiwer front-end-berekening, raak geen Blobs-store of Function aan nie.

const VR_FORMATE = {
  eboek: { etiket: "E-boek", verstek_k: 0, k_wysigbaar: false },
  leen: { etiket: "Leen", verstek_k: 0, k_wysigbaar: false },
  hardekopie: { etiket: "Harde kopie", verstek_k: 140, k_wysigbaar: true },
};

function vr_formateer_rand(bedrag) {
  if (!Number.isFinite(bedrag)) return "R0.00";
  return `R${bedrag.toFixed(2)}`;
}

function vr_bereken({ outeurPct, T, K, paystackPct, paystackVaste, hostingPct, adminPct, ontwerpPct }) {
  const P = outeurPct > 0 ? (T + K) / (outeurPct / 100) : 0;

  const outeurRand = (outeurPct / 100) * P;
  const paystackRand = (paystackPct / 100) * P + paystackVaste;
  const hostingRand = (hostingPct / 100) * P;
  const adminRand = (adminPct / 100) * P;
  const ontwerpRand = (ontwerpPct / 100) * P;
  const direkteursRand = P - outeurRand - paystackRand - hostingRand - adminRand - ontwerpRand;
  const direkteursPct = P > 0 ? (direkteursRand / P) * 100 : 0;

  return { P, outeurRand, paystackRand, hostingRand, adminRand, ontwerpRand, direkteursRand, direkteursPct };
}

function vr_kry_gedeelde_waardes() {
  return {
    T: Number(document.getElementById("vr-t").value) || 0,
    K: Number(document.getElementById("vr-k").value) || 0,
    paystackPct: Number(document.getElementById("vr-paystack-pct").value) || 0,
    paystackVaste: Number(document.getElementById("vr-paystack-vaste").value) || 0,
    hostingPct: Number(document.getElementById("vr-hosting-pct").value) || 0,
    adminPct: Number(document.getElementById("vr-admin-pct").value) || 0,
    ontwerpPct: Number(document.getElementById("vr-ontwerp-pct").value) || 0,
  };
}

function vr_ry_html(etiket, rand, persentasie, kleur_klas, vet, waarskuwing) {
  return `
    <div class="vr-ry ${vet ? "vr-ry-vet" : ""}">
      <div class="vr-ry-etiket">
        ${kleur_klas ? `<span class="vr-kolletjie vr-kolletjie--${kleur_klas}"></span>` : ""}
        <span>${etiket}</span>
      </div>
      <div class="vr-ry-waarde">
        <span class="${waarskuwing ? "vr-waarskuwing-teks" : ""}">${vr_formateer_rand(rand)}</span>
        <span class="vr-ry-pct">(${persentasie.toFixed(1)}%)</span>
      </div>
    </div>
  `;
}

function vr_wys_scenario(scenario_letter, outeurPct) {
  const gedeeld = vr_kry_gedeelde_waardes();
  const resultaat = vr_bereken({ outeurPct, ...gedeeld });
  const negatief = resultaat.direkteursRand < 0;
  const paystack_pct_wys = resultaat.P > 0 ? (resultaat.paystackRand / resultaat.P) * 100 : 0;

  const liggaam = document.getElementById(`vr-scenario-${scenario_letter}-liggaam`);
  liggaam.innerHTML = `
    <div class="vr-prys-blok">
      <div class="vr-prys-etiket">Verkoopprys (P)</div>
      <div class="vr-prys-waarde">${vr_formateer_rand(resultaat.P)}</div>
    </div>
    ${vr_ry_html("Outeur ontvang", resultaat.outeurRand, outeurPct, "outeur", true, false)}
    ${vr_ry_html("Paystack", resultaat.paystackRand, paystack_pct_wys, null, false, false)}
    ${vr_ry_html("Hosting", resultaat.hostingRand, gedeeld.hostingPct, "koste", false, false)}
    ${vr_ry_html("Admin", resultaat.adminRand, gedeeld.adminPct, "koste", false, false)}
    ${vr_ry_html("Ontwerp", resultaat.ontwerpRand, gedeeld.ontwerpPct, "koste", false, false)}
    ${vr_ry_html("Direkteursfooie (oorblywend)", resultaat.direkteursRand, resultaat.direkteursPct, "direkteurs", true, negatief)}
    ${negatief ? `<div class="vr-waarskuwing-blok">⚠ Direkteursfooie is negatief — Paystack + Hosting + Admin + Ontwerp saam is meer as Future Sharp se hele aandeel by hierdie persentasie.</div>` : ""}
  `;

  return resultaat;
}

function vr_herbereken_alles() {
  const outeurA = Number(document.getElementById("vr-outeur-a").value) || 0;
  const outeurB = Number(document.getElementById("vr-outeur-b").value) || 0;

  const resA = vr_wys_scenario("a", outeurA);
  const resB = vr_wys_scenario("b", outeurB);

  const prysVerskil = resB.P - resA.P;
  const direkteursVerskil = resB.direkteursRand - resA.direkteursRand;

  const prysEl = document.getElementById("vr-prys-verskil");
  const prysAbs = vr_formateer_rand(Math.abs(prysVerskil));
  prysEl.textContent = prysVerskil === 0 ? "Geen verskil" : `${prysAbs} ${prysVerskil > 0 ? "hoër" : "laer"}`;

  const direkteursEl = document.getElementById("vr-direkteurs-verskil");
  const direkteursAbs = vr_formateer_rand(Math.abs(direkteursVerskil));
  direkteursEl.textContent = direkteursVerskil === 0 ? "Geen verskil" : `${direkteursAbs} ${direkteursVerskil > 0 ? "meer" : "minder"}`;
  direkteursEl.classList.toggle("vr-vergelyking-waarde--laer", direkteursVerskil < 0);
}

function vr_kies_formaat(sleutel) {
  document.querySelectorAll(".vr-formaat-knoppie").forEach((knoppie) => {
    knoppie.classList.toggle("vr-formaat-aktief", knoppie.dataset.formaat === sleutel);
  });

  const info = VR_FORMATE[sleutel];
  const k_veld = document.getElementById("vr-k");
  k_veld.value = info.verstek_k;
  k_veld.disabled = !info.k_wysigbaar;

  const nota = document.getElementById("vr-k-nota");
  nota.style.display = info.k_wysigbaar ? "none" : "block";
  nota.textContent = `K is R0 vir ${info.etiket} — geen fisiese druk-/afleweringskoste nie.`;

  vr_herbereken_alles();
}

function vr_koppel_gebeurtenisse() {
  const wrap = document.getElementById("vr-formaat-kieser");
  if (!wrap) return; // afdeling nie op hierdie bladsy nie

  wrap.querySelectorAll(".vr-formaat-knoppie").forEach((knoppie) => {
    knoppie.addEventListener("click", () => vr_kies_formaat(knoppie.dataset.formaat));
  });

  const invoer_ids = [
    "vr-t", "vr-k", "vr-paystack-pct", "vr-paystack-vaste",
    "vr-hosting-pct", "vr-admin-pct", "vr-ontwerp-pct",
    "vr-outeur-a", "vr-outeur-b",
  ];
  invoer_ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return; // veiligheidsnet — moenie die hele koppeling laat omval as een veld ontbreek nie
    el.addEventListener("input", vr_herbereken_alles);
    el.addEventListener("change", vr_herbereken_alles); // rugsteun vir blaaiers/toestelle waar 'input' nie altyd konsekwent op number-velde afvuur nie
  });

  vr_herbereken_alles();
}

// As hierdie skrip om een of ander rede eers ná DOMContentLoaded laai
// (bv. 'n stadige netwerk-vertraging), sou 'n gewone addEventListener
// nooit afvuur nie — kyk eers self of die dokument reeds klaar is.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", vr_koppel_gebeurtenisse);
} else {
  vr_koppel_gebeurtenisse();
}
