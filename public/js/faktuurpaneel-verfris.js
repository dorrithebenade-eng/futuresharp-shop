// public/js/faktuurpaneel-verfris.js
//
// Hou Boekhouding se skerm vars sonder dat iemand F5 druk.
//
// 'N EIE LEER, EN HY WYSIG NIKS. faktuurpaneel.js en faktuurpaneel-staat.js
// werk albei; hierdie een roep net hul bestaande laaifunksies weer aan. Wat
// geteken word en hoe dit lyk, bly hulle werk.
//
// ─────────────────────────────────────────────────────────────────────────
// WAAROM DIE TWEE TEMPO'S VERSKIL
//
// Dit gaan nie oor hoe vinnig 'n syfer verouder nie, maar oor wat dit kos as
// iemand op ou data 'n besluit neem.
//
//   State, elke 15s — die uitbetaal-werklys is die enigste plek waar twee
//   mense oor dieselfde ry kan loop. Jy betaal Eugene sy R7 000 en merk die
//   ry af; iemand anders sit met dieselfde ry oop en betaal hom weer. Dit is
//   die een plek in die stelsel waar 'n verouderde skerm geld kos.
//
//   Fakture, elke 30s — hier verdwyn 'n konsep of verskyn 'n nommer.
//   Vervelig as 'n mens dit mis; nie duur nie.
//
// Die winkeltellers op die paneelbord kry niks. Daardie syfer verander deur
// besoekers, en niemand neem 'n besluit daarop nie.
// ─────────────────────────────────────────────────────────────────────────
//
// DIE VERFRISSING IS 'N GERIEF, NIE DIE BESKERMING NIE. Sy maak die venster
// waarin twee mense mekaar kan tref klein; sy maak hom nie nul nie. Die
// werklike slot is bedienerkant: teken-betaling-aan.js weier 'n faktuur wat
// reeds betaal is, en die afmerk moet dieselfde doen.

const VF_STAAT_MS = 15000;
const VF_FAKTURE_MS = 30000;

let VF_STAAT_TIK = null;
let VF_FAKTURE_TIK = null;

/* ═══ wat op die skerm is ═══ */

function vf_afdeling_wys(naam) {
  const el = document.querySelector(`.fp-afdeling[data-afdeling="${naam}"]`);
  return !!el && el.classList.contains("wys");
}

// 'N SKERM WAARIN IEMAND WERK, WORD NOOIT ONDER SY HANDE HERTEKEN NIE.
//
// st_teken_werklys() bou die hele lys van voor af op. Doen ons dit terwyl
// iemand rye gemerk het of 'n bankverwysing intik, verloor hy sy keuse en sy
// tikwerk — en hy weet nie hoekom nie. Dit is erger as data wat 'n halfminuut
// oud is.
function vf_staat_besig() {
  if (typeof ST !== "undefined" && ST) {
    if (ST.besig) return true;
    if (Object.keys(ST.gekies || {}).some((k) => ST.gekies[k])) return true;
  }
  const werk = document.getElementById("st-werk");
  const fokus = document.activeElement;
  if (werk && fokus && werk.contains(fokus) && fokus !== document.body) return true;
  return false;
}

// Die faktuurlys ken een gevaarlike oomblik: die "Skrap?"-bevestiging. Sy
// leef in die ry self, en 'n herteken vee haar weg — dan het 'n mens Ja
// gedruk op 'n knoppie wat intussen verdwyn het.
function vf_fakture_besig() {
  return !!document.querySelector(".fp-bevestig");
}

/* ═══ die twee verfrissings ═══ */

// Wanneer iemand besig is, word die verfrissing NIE oorgeslaan nie — sy word
// stilweg gehaal en vergelyk. Het niks verander, gebeur daar niks. Het iets
// verander, kom 'n reël bo-aan wat dit sê, en die persoon herlaai wanneer hy
// klaar is. Anders sit 'n mens met rye gemerk vir tien minute en sien nooit
// dat die grond onder hom verskuif het nie.
async function vf_staat() {
  if (!vf_afdeling_wys("state")) return;
  if (typeof st_laai !== "function") return;

  if (!vf_staat_besig()) {
    vf_verwyder_melding("st-werk");
    await st_laai();
    return;
  }

  if (typeof st_vra !== "function" || typeof ST === "undefined") return;
  try {
    const vars = await st_vra("kry-staat");
    if (JSON.stringify(vars) !== JSON.stringify(ST.data)) {
      vf_wys_melding("st-werk", () => {
        vf_verwyder_melding("st-werk");
        st_laai();
      });
    }
  } catch (fout) {
    console.error("Verfris: kon nie die staat nagaan nie:", fout);
  }
}

async function vf_fakture() {
  if (!vf_afdeling_wys("fakture")) return;
  if (typeof fp_laai_fakture !== "function") return;
  if (typeof FP_SESSIE === "undefined" || !FP_SESSIE) return;
  if (vf_fakture_besig()) return;
  try {
    await fp_laai_fakture(FP_SESSIE);
  } catch (fout) {
    console.error("Verfris: kon nie die fakture laai nie:", fout);
  }
}

/* ═══ die melding ═══ */

function vf_wys_melding(plek_id, by_klik) {
  const plek = document.getElementById(plek_id);
  if (!plek || document.getElementById("vf-melding-" + plek_id)) return;

  const balk = document.createElement("div");
  balk.id = "vf-melding-" + plek_id;
  balk.className = "vf-melding";
  balk.innerHTML = `<span>${
    window.t && t("vf_verander") !== "vf_verander"
      ? t("vf_verander")
      : "Hierdie lys het intussen verander."
  }</span>`;

  const knop = document.createElement("button");
  knop.type = "button";
  knop.className = "vf-melding-knop";
  knop.textContent =
    window.t && t("vf_herlaai") !== "vf_herlaai" ? t("vf_herlaai") : "Herlaai";
  knop.addEventListener("click", by_klik);
  balk.appendChild(knop);

  plek.parentNode.insertBefore(balk, plek);
}

function vf_verwyder_melding(plek_id) {
  const balk = document.getElementById("vf-melding-" + plek_id);
  if (balk) balk.remove();
}

/* ═══ die klok ═══ */

function vf_stop() {
  if (VF_STAAT_TIK) clearInterval(VF_STAAT_TIK);
  if (VF_FAKTURE_TIK) clearInterval(VF_FAKTURE_TIK);
  VF_STAAT_TIK = null;
  VF_FAKTURE_TIK = null;
}

function vf_begin() {
  vf_stop();
  VF_STAAT_TIK = setInterval(vf_staat, VF_STAAT_MS);
  VF_FAKTURE_TIK = setInterval(vf_fakture, VF_FAKTURE_MS);
}

// NA JOU EIE HANDELING WAG NIKS. Skrap jy 'n konsep of merk jy 'n uitbetaling
// af, is die skerm binne 'n oomblik reg. Die interval geld slegs vir wat by
// die ANDER persoon gebeur.
function verfris_boekhouding_nou() {
  vf_staat();
  vf_fakture();
}
window.verfris_boekhouding_nou = verfris_boekhouding_nou;

/* ═══ begin ═══ */

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("fp-kieslys")) return;

  // 'N VERSTEEKTE OORTJIE VRA NIKS. 'n Vergete oortjie oor 'n naweek sou
  // andersins duisende oproepe doen sonder dat iemand kyk. Kom die oortjie
  // terug, verfris ons dadelik — dit is presies die oomblik waarop 'n mens
  // vars data wil sien.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      vf_stop();
    } else {
      verfris_boekhouding_nou();
      vf_begin();
    }
  });

  // Wissel iemand van pil na pil, verfris die nuwe afdeling dadelik in plaas
  // van tot vyftien sekondes lank ou data te wys.
  document.querySelectorAll("#fp-kieslys .fp-pil").forEach((pil) => {
    pil.addEventListener("click", () => setTimeout(verfris_boekhouding_nou, 0));
  });

  if (!document.hidden) vf_begin();
});
