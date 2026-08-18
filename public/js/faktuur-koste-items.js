// public/js/faktuur-koste-items.js
//
// Koppel die register van werk en uitgawes aan die begroting se
// Beskrywing-veld.
//
// 'N DATALIST, NIE 'N KEUSELYS NIE.
//
// 'n <select> sou die register afdwing, en dit klink netjieser as wat dit is:
// jy is halfpad deur 'n faktuur, die item bestaan nog nie, en 'n keuselys wat
// jou vasdruk, dwing jou om die faktuur te verlaat. Dieselfde redenasie as
// waarom 'n kliënt met net 'n naam gestoor kan word. 'n Register wat 'n mens
// tussendeur omseil, word 'n register wat nie bygehou word nie.
//
// Met 'n datalist tik 'n mens "Reis" en kry "Reiskoste" aangebied. Wie iets
// nuuts tik, tik dit; die item kom later by die register by. Die effek is
// dieselfde waar dit tel — dieselfde woord elke keer, sodat 'n mens later kan
// tel wat aan reis bestee is.
//
// 'N NUWE LÊER, NIE 'N WYSIGING NIE. faktuur-backoffice.js kry één attribuut
// by (list="bo-items") en bly andersins onaangeraak. Hy dra die begroting,
// die verdeling en die tekortoplosser; 'n verandering daar is duur.
//
// DIE DATALIST WORD EEN KEER GEBOU. bo_teken_begroting() herteken die rye
// gereeld — by elke ontvangerwisseling — maar die <datalist> leef BUITE
// daardie lys, teen die einde van die bladsy. Sou hy binne 'n ry sit, was hy
// weg sodra die ry herbou is.

const KI = {
  items: [],
};

function ki_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function ki_ontsnap(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Die etiket wys as sekondêre teks langs die naam in Chrome en Edge. Waar 'n
// blaaier hom ignoreer, bly die naam alleen sigbaar en niks breek nie.
function ki_teken() {
  let lys = document.getElementById("bo-items");
  if (!lys) {
    lys = document.createElement("datalist");
    lys.id = "bo-items";
    document.body.appendChild(lys);
  }

  // Werk eerste, want dit is wat die prys opmaak; uitgawes kom terug.
  const orde = { werk: 0, uitgawe: 1 };
  const gesorteer = KI.items
    .filter((i) => i.aktief !== false)
    .sort((a, b) =>
      (orde[a.soort] - orde[b.soort]) || (a.naam || "").localeCompare(b.naam || "", "af-ZA"));

  lys.innerHTML = gesorteer
    .map((i) => {
      const etiket = i.soort === "werk"
        ? ki_t("wi_soort_werk", "Werk")
        : ki_t("wi_soort_uitgawe", "Uitgawe");
      return `<option value="${ki_ontsnap(i.naam)}" label="${ki_ontsnap(etiket)}"></option>`;
    })
    .join("");
}

async function ki_laai() {
  let sessie = null;
  try {
    sessie = await identiteit_kry_huidige_sessie();
  } catch {
    sessie = null;
  }
  if (!sessie || !identiteit_het_rol(sessie.gebruiker, "boekhouding")) return;

  try {
    const resp = await fetch("/.netlify/functions/kry-werk-items", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) throw new Error(String(resp.status));
    const data = await resp.json();
    KI.items = data.items || [];
    ki_teken();
  } catch (fout) {
    // 'N LEË DATALIST IS GEEN FOUT NIE. Die veld bly 'n gewone teksveld en die
    // faktuur werk presies soos vantevore. Hierdie koppeling is gerief, nie 'n
    // vereiste vir 'n faktuur nie, en sy mag nooit 'n faktuur keer nie.
    console.error("Kon nie die werk-items laai nie:", fout);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("bt-lys")) return;
  ki_laai();
});
