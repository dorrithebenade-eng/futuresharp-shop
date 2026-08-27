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
//
// ── 27 AUGUSTUS 2026: DIE STROOK HET DUPLIKATE UITGENOOI ────────────────────
//
// Die register het "Studievaardigheid" en "Studievaardigheid Sessie" gedra.
// Iemand tik "Studievaardig", en die strook sê: is nog nie in die register
// nie, + Werk, + Uitgawe. Twee klikke later staan daar 'n DERDE byna-duplikaat
// en die register is stukkender as voorheen — presies wat hy moes keer.
//
// Twee dinge was verkeerd, en die eerste is elders:
//
//   1. faktuur-vorm.js se dokumentreel het GEEN list="bo-items" gedra nie. Die
//      voorstellys het net op die begroting gewerk. Dit is nou reg.
//
//   2. Die strook het net twee toestande geken: presies bekend, of onbekend.
//      Daar is 'n derde, en dit is die algemeenste: NABY. Die strook vra nou
//      eers "Bedoel jy Studievaardigheid?" met die passende items as knoppies,
//      en bied eers aan om iets nuuts te skep wanneer NIKS pas nie.
//
// DIE VERGELYKING IGNOREER HOOFLETTERS EN WIT SPASIE, deurgaans. "Reiskoste",
// "reiskoste " en "REISKOSTE" is een woord — in die bekend-toets, in die
// naby-toets en in die register self. Die GESTOORDE naam behou wel sy
// hoofletters; net die vergelyking ignoreer hulle.

(function () {
  "use strict";

  var STROOK = null;
  var HUIDIG = "";
  var BESIG = false;
  // Die veld waaruit die strook opgekom het. Nodig sodat 'n klik op 'n
  // voorstel die woord WERKLIK in die veld sit. Sien kies().
  var LAASTE_VELD = null;

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
  function normaliseer(waarde) {
    return String(waarde == null ? "" : waarde).trim().toLowerCase();
  }

  function ken_ons_hom(naam) {
    if (typeof KI === "undefined" || !KI.items) return true;
    var soek = normaliseer(naam);
    for (var i = 0; i < KI.items.length; i++) {
      if (normaliseer(KI.items[i].naam) === soek) return true;
    }
    return false;
  }

  // WAT "NABY" BETEKEN: die een is 'n substring van die ander.
  //
  // Geen Levenshtein nie, en dit is 'n keuse. Wat 'n mens hier werklik doen,
  // is halfpad tik en wegklik — "Studievaardig" vir "Studievaardigheid",
  // "Reis" vir "Reiskoste". Dit is 'n PREFIKS, nie 'n spelfout nie. 'n
  // Afstandmaat sou boonop "Toets" en "Boets" as naby aanbied, en 'n voorstel
  // wat verkeerd is, is erger as geen voorstel: 'n mens klik hom.
  //
  // ALBEI RIGTINGS. Tik jy "Studievaardigheid Sessie" terwyl die register net
  // "Studievaardigheid" dra, is dit ook naby — dalk is dit werklik 'n nuwe
  // item, maar jy moet dit sien voordat jy besluit.
  //
  // DRIE OP DIE MEESTE. Sewe knoppies is nie 'n voorstel nie, dit is 'n
  // tweede register. Die kortstes eerste: hulle is die waarskynlikste stam.
  function naby_items(naam) {
    if (typeof KI === "undefined" || !KI.items) return [];
    var soek = normaliseer(naam);
    if (soek.length < 3) return [];   // twee letters pas op te veel
    var pas = [];
    for (var i = 0; i < KI.items.length; i++) {
      var item = KI.items[i];
      if (item && item.aktief === false) continue;
      var teen = normaliseer(item.naam);
      if (!teen || teen === soek) continue;
      if (teen.indexOf(soek) !== -1 || soek.indexOf(teen) !== -1) pas.push(item);
    }
    pas.sort(function (a, b) {
      return String(a.naam || "").length - String(b.naam || "").length;
    });
    return pas.slice(0, 3);
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

    var naby = naby_items(naam);
    var html;

    if (naby.length) {
      // DIE VRAAG KOM EERSTE, en die byvoeg-knoppies bly staan. Wie werklik
      // iets nuuts skep, moet dit steeds kan doen sonder om die faktuur te
      // verlaat — die vraag is 'n aanbod, nie 'n hek nie.
      html =
        '<span class="nki-teks">' +
        nki_t("nki_bedoel_jy", "Bedoel jy") +
        "</span>";
      for (var i = 0; i < naby.length; i++) {
        html +=
          '<button type="button" class="nki-knop nki-kies" data-kies="' +
          nki_ontsnap(naby[i].naam) + '">' + nki_ontsnap(naby[i].naam) + "</button>";
      }
      html +=
        '<span class="nki-teks nki-of">' + nki_t("nki_of_nuut", "of skep") + "</span>" +
        '<button type="button" class="nki-knop" data-soort="werk">' +
        nki_t("nki_voeg_werk", "+ Werk") + "</button>" +
        '<button type="button" class="nki-knop" data-soort="uitgawe">' +
        nki_t("nki_voeg_uitgawe", "+ Uitgawe") + "</button>";
    } else {
      html =
        '<span class="nki-teks">' +
        "&#8220;" + nki_ontsnap(naam) + "&#8221; " +
        nki_t("nki_onbekend", "is nog nie in die register nie.") +
        "</span>" +
        '<button type="button" class="nki-knop" data-soort="werk">' +
        nki_t("nki_voeg_werk", "+ Werk") + "</button>" +
        '<button type="button" class="nki-knop" data-soort="uitgawe">' +
        nki_t("nki_voeg_uitgawe", "+ Uitgawe") + "</button>";
    }

    STROOK.innerHTML = html;
    STROOK.hidden = false;
  }

  /* DIE VELD WORD REGGESTEL, NIE NET GEWYS NIE.

     Klik 'n mens "Studievaardigheid", moet die veld daardie woord dra — 'n
     voorstel wat 'n mens self moet oortik, is 'n voorstel wat 'n mens ignoreer.

     WATTER VELD: die laaste een wat aangeraak is. Die strook wys reeds die
     LAASTE onbekende beskrywing; hierdie is dieselfde ry. Ons hou 'n verwysing
     na die element self, want fv_teken_reels() en bo_teken_begroting() vervang
     die DOM — maar tussen die blur en die klik gebeur geen hertekening nie.

     'n `input`-gebeurtenis word afgevuur sodat faktuur-vorm.js se luisteraar
     die nuwe waarde in V.reels stoor. Sonder dit staan die woord op die skerm
     en nie in die rekord nie. */
  function kies(naam) {
    if (LAASTE_VELD && document.body.contains(LAASTE_VELD)) {
      LAASTE_VELD.value = naam;
      LAASTE_VELD.dispatchEvent(new Event("input", { bubbles: true }));
      LAASTE_VELD.dispatchEvent(new Event("change", { bubbles: true }));
    }
    versteek();
  }

  function versteek() {
    if (!STROOK) return;
    STROOK.hidden = true;
    HUIDIG = "";
    LAASTE_VELD = null;
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
        LAASTE_VELD = veld;
        wys(naam);
      },
      true
    );

    STROOK.addEventListener("click", function (e) {
      var knop = e.target.closest ? e.target.closest(".nki-knop") : null;
      if (!knop) return;
      // 'n Voorstel stel die veld reg; 'n soort-knoppie skep 'n nuwe item.
      if (knop.dataset.kies) {
        kies(knop.dataset.kies);
        return;
      }
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
