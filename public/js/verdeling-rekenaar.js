// public/js/verdeling-rekenaar.js
//
// Interne beplanningshulpmiddel (personeel-alleen, leef binne die
// paneelbord se "Verdeling-rekenaar"-afdeling).
//
// WAT DIT DOEN: die outeur se 70% is 'n vaste gegewe — dit is die anker wat
// die prys bepaal, nie iets om oor te besluit nie. Voer die outeur se
// beoogde wins (T) in, plus sy eie druk-/afleweringskoste (K, net vir Harde
// kopie), en die prys volg. Alles wat die rekenaar dan wys, is hoe die
// oorblywende 30% INTERN verdeel: Paystack, Hosting, Admin, Ontwerp, en die
// direkteursfooie as die oorblyfsel.
//
// WAAROM DAAR NIE MEER TWEE SCENARIO'S IS NIE (Augustus 2026): A en B het
// bestaan om persentasies te vergelyk — 68% teenoor 70%. Future Sharp werk
// nou uitsluitlik op 70/30, dus sou twee scenario's presies dieselfde
// antwoord gegee het. Die persentasie-invoer is saam verwyder.
//
// WAAROM DAAR 'N BTW-VELD BYGEKOM HET: Paystack se fooi dra BTW. Die ou
// berekening (2,9% + R1) het R3,90 op R100 gegee, maar 'n werklike
// transaksie op 2 Augustus 2026 is teen R4,49 gehef —
// (2,9% + R1) × 1,15 = R4,485. Sonder die BTW-lyn is die direkteursfooie
// omtrent 60c per R100 te optimisties.
//
// Suiwer front-end-berekening, raak geen Blobs-store of Function aan nie.

const VR_OUTEUR_PCT = 70;

const VR_FORMATE = {
  eboek: { etiket: "E-boek", verstek_k: 0, k_wysigbaar: false },
  leen: { etiket: "Leen", verstek_k: 0, k_wysigbaar: false },
  hardekopie: { etiket: "Harde kopie", verstek_k: 140, k_wysigbaar: true },
};

function vr_formateer_rand(bedrag) {
  if (!Number.isFinite(bedrag)) return "R0.00";
  return `R${bedrag.toFixed(2)}`;
}

function vr_getal(id) {
  const el = document.getElementById(id);
  return el ? Number(el.value) || 0 : 0;
}

function vr_bereken() {
  const T = vr_getal("vr-t");
  const K = vr_getal("vr-k");
  const paystackPct = vr_getal("vr-paystack-pct");
  const paystackVaste = vr_getal("vr-paystack-vaste");
  const btwPct = vr_getal("vr-btw-pct");
  const hostingPct = vr_getal("vr-hosting-pct");
  const adminPct = vr_getal("vr-admin-pct");
  const ontwerpPct = vr_getal("vr-ontwerp-pct");

  // Die prys word terugwaarts uit die outeur se wins bereken.
  const P = (T + K) / (VR_OUTEUR_PCT / 100);

  const outeurRand = (VR_OUTEUR_PCT / 100) * P;
  const paystackRand = ((paystackPct / 100) * P + paystackVaste) * (1 + btwPct / 100);
  const hostingRand = (hostingPct / 100) * P;
  const adminRand = (adminPct / 100) * P;
  const ontwerpRand = (ontwerpPct / 100) * P;

  const futureSharpRand = P - outeurRand;
  const direkteursRand = futureSharpRand - paystackRand - hostingRand - adminRand - ontwerpRand;

  const pct = (rand) => (P > 0 ? (rand / P) * 100 : 0);

  return {
    P, outeurRand, paystackRand, hostingRand, adminRand, ontwerpRand,
    futureSharpRand, direkteursRand, pct,
    hostingPct, adminPct, ontwerpPct,
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

function vr_herbereken_alles() {
  const uitslag = document.getElementById("vr-uitslag");
  if (!uitslag) return;

  const r = vr_bereken();
  const negatief = r.direkteursRand < 0;

  uitslag.innerHTML = `
    <div class="vr-prys-blok">
      <div class="vr-prys-etiket">Verkoopprys (P)</div>
      <div class="vr-prys-waarde">${vr_formateer_rand(r.P)}</div>
    </div>

    <div class="vr-afdeling-kop">Gaan uit</div>
    ${vr_ry_html("Outeur ontvang", r.outeurRand, VR_OUTEUR_PCT, "outeur", true, false)}

    <div class="vr-afdeling-kop">Bly by Future Sharp — ${vr_formateer_rand(r.futureSharpRand)}</div>
    ${vr_ry_html("Paystack (met BTW)", r.paystackRand, r.pct(r.paystackRand), null, false, false)}
    ${vr_ry_html("Hosting", r.hostingRand, r.hostingPct, "koste", false, false)}
    ${vr_ry_html("Admin", r.adminRand, r.adminPct, "koste", false, false)}
    ${vr_ry_html("Ontwerp", r.ontwerpRand, r.ontwerpPct, "koste", false, false)}
    ${vr_ry_html("Direkteursfooie (oorblywend)", r.direkteursRand, r.pct(r.direkteursRand), "direkteurs", true, negatief)}

    ${negatief ? `<div class="vr-waarskuwing-blok">⚠ Direkteursfooie is negatief — Paystack + Hosting + Admin + Ontwerp saam is meer as die 30% wat by Future Sharp bly. Verhoog T, of verlaag een van die koste-lyne.</div>` : ""}
  `;
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
    "vr-t", "vr-k", "vr-paystack-pct", "vr-paystack-vaste", "vr-btw-pct",
    "vr-hosting-pct", "vr-admin-pct", "vr-ontwerp-pct",
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
