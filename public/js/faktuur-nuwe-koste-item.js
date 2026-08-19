// public/js/faktuur-nuwe-koste-item.js
//
// Voeg 'n nuwe koste-item by die register SONDER om die faktuur te verlaat.
//
// DIT IS NIE 'N PANEEL SOOS BY DIE KLIENT NIE, en die rede is dat die
// register hier reeds omseilbaar is. faktuur-koste-items.js koppel 'n
// <datalist> aan die Beskrywing-veld: 'n mens tik "Reis" en kry "Reiskoste"
// aangebied, maar wie iets nuuts tik, tik dit eenvoudig. Die faktuur werk
// heeltemal reg met 'n beskrywing wat nêrens in die register staan nie.
//
// Wat ontbreek het, is die STAP TERUG: die nuwe woord kom nooit by die
// register uit nie, en dan is die volgende faktuur se spelling weer anders.
// Dit is presies wat 'n register moet keer — 'n mens wil later kan tel wat
// aan reis bestee is, en "Reiskoste", "Reis koste" en "reis" is dan drie
// dinge.
//
// DIE STROOK LEEF BUITE bt-lys. bo_teken_begroting() herbou daardie lys by
// elke wysiging; enigiets binne 'n ry is weg sodra die ry herteken word.
// Dieselfde les as die <datalist>, wat om dieselfde rede teen die einde van
// die bladsy woon.
//
// EEN STROOK, NIE EEN PER RY NIE. Drie kostereëls sou drie strokies gee wat
// om aandag meeding; die strook wys die LAASTE onbekende beskrywing wat
// aangeraak is. 'n Mens werk in elk geval een ry op 'n slag.
//
// DIT KEER NIKS. Ignoreer 'n mens die strook, gebeur niks — die faktuur is
// klaar reg. Sy is 'n aanbod, nie 'n stap nie.

(function () {
  "use strict";

  var STROOK = null;
  var HUIDIG = "";
  var BESIG = false;

  function nki_t(sleutel, verstek) {
    var uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }

  function nki_ontsnap(teks) {
    return String(teks == null ? "" : teks)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Die vergelyking is kleinletter en sonder wit spasie aan die punte. "Reiskoste"
  // en "reiskoste " is dieselfde item; 'n strook wat vir 'n hoofletter opkom,
  // word 'n strook wat 'n mens leer ignoreer.
  function ken_ons_hom(naam) {
    if (typeof KI === "undefined" || !KI.items) return true;
    var soek = naam.trim().toLowerCase();
    for (var i = 0; i < KI.items.length; i++) {
      if (String(KI.items[i].naam || "").trim().toLowerCase() === soek) return true;
    }
    return false;
  }

  function bou_strook() {
    var lys = document.getElementById("bt-lys");
    if (!lys || !lys.parentNode) return null;

    var d = document.createElement("div");
    d.className = "nki-strook";
    d.id = "nki-strook";
    d.hidden = true;
    // Ná bt-lys, maar VOOR die "+ Voeg koste by"-knoppie: die strook hoort by
    // die rye waaruit hy kom, nie onderaan die kaart nie.
    lys.parentNode.insertBefore(d, lys.nextSibling);
    return d;
  }

  function wys(naam) {
    if (!STROOK) return;
    HUIDIG = naam;
    STROOK.innerHTML =
      '<span class="nki-teks">' +
      "&#8220;" + nki_ontsnap(naam) + "&#8221; " +
      nki_t("nki_onbekend", "is nog nie in die register nie.") +
      "</span>" +
      '<button type="button" class="nki-knop" data-soort="werk">' +
      nki_t("nki_voeg_werk", "+ Werk") + "</button>" +
      '<button type="button" class="nki-knop" data-soort="uitgawe">' +
      nki_t("nki_voeg_uitgawe", "+ Uitgawe") + "</button>";
    STROOK.hidden = false;
  }

  function versteek() {
    if (!STROOK) return;
    STROOK.hidden = true;
    HUIDIG = "";
  }

  function boodskap(teks, is_fout) {
    if (!STROOK) return;
    STROOK.innerHTML = '<span class="nki-teks' + (is_fout ? " fout" : "") + '">' +
      nki_ontsnap(teks) + "</span>";
    STROOK.hidden = false;
    if (!is_fout) setTimeout(versteek, 2500);
  }

  async function voeg_by(soort) {
    if (BESIG || !HUIDIG) return;
    BESIG = true;
    var naam = HUIDIG;

    var sessie = null;
    try {
      sessie = await identiteit_kry_huidige_sessie();
    } catch (f) {
      sessie = null;
    }
    if (!sessie) {
      BESIG = false;
      boodskap(nki_t("nki_fout", "Kon nie byvoeg nie."), true);
      return;
    }

    try {
      var resp = await fetch("/.netlify/functions/stoor-werk-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessie.access_token,
        },
        body: JSON.stringify({ naam: naam, soort: soort }),
      });

      // 409 beteken iemand anders het hom intussen bygevoeg — of hierdie
      // selfde mens in 'n ander oortjie. Die uitkoms is presies wat ons wou
      // hê, dus is dit geen fout nie.
      if (resp.status === 409) {
        boodskap(nki_t("nki_bestaan", "Staan reeds in die register."), false);
      } else if (!resp.ok) {
        throw new Error("Status " + resp.status);
      } else {
        // DIE LYS WORD PLAASLIK BYGEWERK. Blobs se list() loop sowat vier
        // sekondes agter; 'n herlaai sou die splinternuwe item NIE terugbring
        // nie en die strook sou dadelik weer opkom.
        if (typeof KI !== "undefined" && KI.items) {
          KI.items.push({ naam: naam, soort: soort, aktief: true });
          if (typeof ki_teken === "function") ki_teken();
        }
        boodskap(nki_t("nki_bygevoeg", "By die register gevoeg."), false);
      }
    } catch (f) {
      console.error("Kon nie die koste-item byvoeg nie:", f);
      boodskap(nki_t("nki_fout", "Kon nie byvoeg nie."), true);
    } finally {
      BESIG = false;
    }
  }

  function haak_aan() {
    STROOK = bou_strook();
    if (!STROOK) return;

    // AFGEVAARDIGDE LUISTERAARS. bo_teken_begroting() vervang die rye se DOM;
    // 'n luisteraar op die veld self sou by die eerste hertekening dood wees.
    document.addEventListener(
      "blur",
      function (e) {
        var veld = e.target;
        if (!veld || !veld.matches || !veld.matches('input[data-veld="beskrywing"]')) return;
        var naam = String(veld.value || "").trim();
        if (!naam || ken_ons_hom(naam)) {
          versteek();
          return;
        }
        wys(naam);
      },
      true
    );

    STROOK.addEventListener("click", function (e) {
      var knop = e.target.closest ? e.target.closest(".nki-knop") : null;
      if (!knop) return;
      voeg_by(knop.dataset.soort);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("bt-lys")) return;
    if (typeof KI === "undefined") {
      console.warn("faktuur-nuwe-koste-item.js: die itemregister is nie bereikbaar nie.");
      return;
    }
    haak_aan();
  });
})();
