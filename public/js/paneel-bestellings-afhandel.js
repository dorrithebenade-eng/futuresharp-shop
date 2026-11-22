// paneel-bestellings-afhandel.js
//
// STAP 1 VAN "BESTELLINGS AFHANDEL" (November 2026). Slegs die skerm; geen
// data word geskryf nie.
//
// WAT DIT DOEN
//   1. Oortjies bo die bestellings: Om af te handel, Laat, Afgehandel, Alles.
//      Die bladsy maak oop op "Om af te handel".
//   2. Elke betaalde bestelling kry 'n merkie: Afgehandel, Oop (met dae) of
//      Laat (met dae).
//   3. By 'n afgehandelde harde kopie: wanneer dit gestuur is, hoe, deur wie
//      gemerk, en die spoornommer.
//   4. 'n Waarskuwing bo-aan wanneer bestellings laat is.
//
// WANNEER IS IETS AFGEHANDEL
//   - Net 'n betaalde bestelling (status "Nuut") kan afgehandel of oop wees.
//     "Wag vir betaling" en "Verval" is nie bestellings om te hanteer nie; hulle
//     verskyn net onder Alles.
//   - Sonder harde kopie: outomaties afgehandel by betaling (e-boek, leen).
//   - Met harde kopie: afgehandel sodra bestelling.versending.gestuur waar is.
//     Die outeur skryf dit vanuit sy outeurspaneel (merk-bestelling-gestuur.js).
//   - Laat: oop en meer as BH_LAAT_NA_DAE dae sedert die bestelling.
//
// HOE DIT INHAAK
//   paneel-bestellings.js bly onaangeraak. Hierdie lêer vervang die globale
//   pas_bestellings_filter_toe() met 'n omhulsel: dit beperk ALLE_BESTELLINGS
//   tydelik tot die gekose oortjie, roep die oorspronklike, en sit die volle lys
//   SINCHROON terug. Die oorspronklike se eie filters (soek, status, drukwerk)
//   werk dus binne die oortjie. Die DOMContentLoaded-luisteraars in
//   paneel-bestellings.js lees die naam eers wanneer hulle koppel, en kry dan
//   reeds die omhulsel. MOET DUS NA paneel-bestellings.js GELAAI WORD, en voor
//   DOMContentLoaded (dit is 'n gewone <script> onderaan die bladsy).

const BH_LAAT_NA_DAE = 10;
const BH_DAG_MS = 24 * 60 * 60 * 1000;

let BH_AANSIG = "oop";
let BH_OUTEUR_NAME = null; // outeur_id -> naam, een keer gelaai

function bh_t(sleutel, terugval) {
  return typeof t === "function" ? t(sleutel) : terugval;
}

function bh_ontsnap(x) {
  return String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// JJJJ-MM-DD of 'n volle ISO-tydstip na JJJJ/MM/DD.
function bh_datum(waarde) {
  if (!waarde) return "";
  const s = String(waarde);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "/");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function bh_dae(b) {
  const begin = new Date(b.geskep_op).getTime();
  if (!Number.isFinite(begin)) return 0;
  return Math.max(0, Math.floor((Date.now() - begin) / BH_DAG_MS));
}

function bh_dae_teks(n) {
  return n === 1 ? bh_t("bh_een_dag", "1 dag") : `${n} ${bh_t("bh_dae", "dae")}`;
}

// "onbetaal" | "outo" | "afgehandel" | "oop" | "laat"
function bh_stand(b) {
  if (!b || b.status !== "Nuut") return "onbetaal";
  if (!b.bevat_harde_kopie) return "outo";
  if (b.versending && b.versending.gestuur === true) return "afgehandel";
  return bh_dae(b) > BH_LAAT_NA_DAE ? "laat" : "oop";
}

function bh_in_aansig(b, aansig) {
  const s = bh_stand(b);
  if (aansig === "oop") return s === "oop" || s === "laat";
  if (aansig === "laat") return s === "laat";
  if (aansig === "klaar") return s === "afgehandel" || s === "outo";
  return true;
}

function bh_tel(lys) {
  const tel = { oop: 0, laat: 0, klaar: 0, alles: lys.length };
  lys.forEach((b) => {
    const s = bh_stand(b);
    if (s === "oop" || s === "laat") tel.oop++;
    if (s === "laat") tel.laat++;
    if (s === "afgehandel" || s === "outo") tel.klaar++;
  });
  return tel;
}

// --- Bo die lys: oortjies en waarskuwing ---

function bh_houer() {
  let houer = document.getElementById("bh-bo");
  if (houer) return houer;
  const filters = document.querySelector('[data-afdeling-inhoud="bestellings"] .paneel-bestellings-filters');
  if (!filters) return null;
  houer = document.createElement("div");
  houer.id = "bh-bo";
  filters.parentNode.insertBefore(houer, filters);

  houer.addEventListener("click", (e) => {
    const knoppie = e.target.closest("button[data-bh-aansig]");
    if (!knoppie) return;
    BH_AANSIG = knoppie.dataset.bhAansig;
    pas_bestellings_filter_toe();
  });
  return houer;
}

function bh_teken_bo(lys) {
  const houer = bh_houer();
  if (!houer) return;
  const tel = bh_tel(lys);

  const oortjies = [
    ["oop", bh_t("bh_oortjie_oop", "Om af te handel"), tel.oop],
    ["laat", bh_t("bh_oortjie_laat", "Laat"), tel.laat],
    ["klaar", bh_t("bh_oortjie_klaar", "Afgehandel"), tel.klaar],
    ["alles", bh_t("bh_oortjie_alles", "Alles"), tel.alles],
  ]
    .map(([sleutel, teks, n]) => {
      const klasse = ["bh-oortjie"];
      if (sleutel === BH_AANSIG) klasse.push("bh-oortjie--aktief");
      if (sleutel === "laat" && n) klasse.push("bh-oortjie--laat");
      return `<button type="button" class="${klasse.join(" ")}" data-bh-aansig="${sleutel}">${bh_ontsnap(teks)} <span class="bh-tel">${n}</span></button>`;
    })
    .join("");

  const waarskuwing = tel.laat
    ? `<div class="bh-waarskuwing">
         <span>⚠️ ${bh_ontsnap(
           (tel.laat === 1 ? bh_t("bh_waarsku_een", "1 bestelling is langer as {d} dae nie afgehandel nie.") : bh_t("bh_waarsku_meer", "{n} bestellings is langer as {d} dae nie afgehandel nie."))
             .replace("{n}", tel.laat)
             .replace("{d}", BH_LAAT_NA_DAE)
         )}</span>
         ${BH_AANSIG === "laat" ? "" : `<button type="button" class="bh-waarskuwing-knoppie" data-bh-aansig="laat">${bh_ontsnap(bh_t("bh_wys_hulle", "Wys hulle"))}</button>`}
       </div>`
    : "";

  houer.innerHTML = `${waarskuwing}<div class="bh-oortjies">${oortjies}</div>`;
}

// --- Op elke kaart ---

function bh_outeur_naam(outeur_id) {
  if (!outeur_id) return "";
  return (BH_OUTEUR_NAME && BH_OUTEUR_NAME[outeur_id]) || "";
}

function bh_strook_afgehandel(b) {
  const v = b.versending || {};
  const stukke = [];
  stukke.push(`${bh_t("bh_gestuur_op", "Gestuur op")} <strong>${bh_ontsnap(bh_datum(v.gestuur_op))}</strong>`);

  if (v.wyse === "verskaffer") {
    let deur = `${bh_t("bh_deur_verskaffer", "deur")} ${bh_ontsnap(v.verskaffer || bh_t("bh_verskaffer", "'n drukker of verspreider"))}`;
    if (v.verskaffer_verwysing) deur += ` (${bh_ontsnap(v.verskaffer_verwysing)})`;
    stukke.push(deur);
  } else {
    stukke.push(bh_ontsnap(bh_t("bh_self_gepos", "self gepos")));
  }

  if (v.spoornommer) {
    stukke.push(`${bh_t("bh_spoornommer", "Spoornommer")} <strong>${bh_ontsnap(v.spoornommer)}</strong>`);
  }

  const naam = bh_outeur_naam(v.laas_gewysig_deur);
  const gemerk = v.laas_gewysig_op
    ? `<span class="bh-strook-sub">${bh_ontsnap(bh_t("bh_gemerk_deur", "Gemerk deur"))} ${bh_ontsnap(naam || bh_t("bh_die_outeur", "die outeur"))} ${bh_ontsnap(bh_t("bh_op", "op"))} ${bh_ontsnap(bh_datum(v.laas_gewysig_op))}</span>`
    : "";

  return `<div class="bh-strook bh-strook--klaar">✅ ${stukke.join(" · ")}${gemerk}</div>`;
}

function bh_merkie(b) {
  const s = bh_stand(b);
  if (s === "onbetaal") return "";
  if (s === "outo") {
    return `<span class="bh-merkie bh-merkie--klaar" title="${bh_ontsnap(bh_t("bh_outo_titel", "Sonder harde kopie: afgehandel by betaling"))}">${bh_ontsnap(bh_t("bh_merkie_klaar", "Afgehandel"))}</span>`;
  }
  if (s === "afgehandel") {
    return `<span class="bh-merkie bh-merkie--klaar">${bh_ontsnap(bh_t("bh_merkie_klaar", "Afgehandel"))}</span>`;
  }
  const dae = bh_dae_teks(bh_dae(b));
  return s === "laat"
    ? `<span class="bh-merkie bh-merkie--laat">${bh_ontsnap(bh_t("bh_merkie_laat", "Laat"))} · ${bh_ontsnap(dae)}</span>`
    : `<span class="bh-merkie bh-merkie--oop">${bh_ontsnap(bh_t("bh_merkie_oop", "Oop"))} · ${bh_ontsnap(dae)}</span>`;
}

function bh_verryk_kaarte(lys) {
  const wrap = document.getElementById("paneel-bestellings-lys");
  if (!wrap) return;
  const per_nommer = new Map(lys.map((b) => [b.bestelnommer, b]));

  wrap.querySelectorAll(".paneel-bestelling-kaart").forEach((kaart) => {
    const skrap = kaart.querySelector(".paneel-bestelling-skrap-knoppie");
    const b = skrap && per_nommer.get(skrap.dataset.bestelnommer);
    if (!b) return;

    const s = bh_stand(b);
    if (s === "laat") kaart.classList.add("bh-kaart--laat");

    const merk_html = bh_merkie(b);
    const status = kaart.querySelector(".paneel-bestelling-kop .paneel-status-merker");
    if (merk_html && status) status.insertAdjacentHTML("afterend", merk_html);

    if (s === "afgehandel") kaart.insertAdjacentHTML("beforeend", bh_strook_afgehandel(b));
  });

  // Leë oortjie: 'n boodskap wat by die oortjie pas, eerder as die algemene een.
  if (!wrap.querySelector(".paneel-bestelling-kaart")) {
    const leeg = {
      oop: bh_t("bh_leeg_oop", "Niks om af te handel nie."),
      laat: bh_t("bh_leeg_laat", "Niks is laat nie."),
    }[BH_AANSIG];
    const boodskap = wrap.querySelector(".stelsel-boodskap");
    if (leeg && boodskap) boodskap.textContent = leeg;
  }
}

// --- Outeursname vir "Gemerk deur" (een keer) ---

async function bh_laai_outeur_name() {
  if (BH_OUTEUR_NAME) return;
  BH_OUTEUR_NAME = {};
  try {
    const resp = await fetch("/.netlify/functions/kry-outeurs", { headers: kry_outorisasie_kop() });
    if (!resp.ok) return;
    const data = await resp.json();
    (data.outeurs || []).forEach((o) => {
      if (o && o.outeur_id) BH_OUTEUR_NAME[o.outeur_id] = o.naam || "";
    });
    pas_bestellings_filter_toe();
  } catch (fout) {
    // Nie-krities: sonder die name staan "die outeur".
    console.warn("Bestellings afhandel: kon nie outeursname laai nie:", fout);
  }
}

// --- Die omhulsel ---

(function bh_haak_in() {
  if (typeof pas_bestellings_filter_toe !== "function") {
    console.error("paneel-bestellings-afhandel.js moet NA paneel-bestellings.js gelaai word.");
    return;
  }
  const oorspronklik = pas_bestellings_filter_toe;

  pas_bestellings_filter_toe = function () {
    const alles = ALLE_BESTELLINGS;
    bh_teken_bo(alles);

    let deel = alles.filter((b) => bh_in_aansig(b, BH_AANSIG));
    // Wat nog hanteer moet word: oudste eerste, want dié wag die langste.
    if (BH_AANSIG === "oop" || BH_AANSIG === "laat") {
      deel = deel.slice().sort((a, b) => new Date(a.geskep_op) - new Date(b.geskep_op));
    }

    ALLE_BESTELLINGS = deel;
    try {
      oorspronklik();
    } finally {
      ALLE_BESTELLINGS = alles;
    }

    bh_verryk_kaarte(alles);
    if (!BH_OUTEUR_NAME && alles.some((b) => b.versending && b.versending.gestuur)) bh_laai_outeur_name();
  };

  // Het die bestellings reeds gelaai voordat hierdie lêer ingehaak het, teken
  // dan nou oor sodat die oortjies en merkies verskyn.
  if (Array.isArray(ALLE_BESTELLINGS) && ALLE_BESTELLINGS.length) pas_bestellings_filter_toe();
})();
