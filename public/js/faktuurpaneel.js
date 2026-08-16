// public/js/faktuurpaneel.js
//
// Boekhouding. Fase 1: die skelet — aanmeld-kontrole, die pil-kieslys, en 'n
// lys wat nog leeg is.
//
// DIE SKERM IS NIE DIE POORT NIE. kry-fakture.js dwing die boekhouding-rol
// af en gee 403 daarsonder, ook vir iemand wat die URL raai. Wat hier gebeur,
// is bloot dat 'n mens nie 'n leë skerm sonder verduideliking sien nie.
//
// Die sessie kom uit die PANEEL-sleutel, dieselfde as paneelbord.html — sien
// identiteit.js se PANEEL_BLADSYE. Een aanmelding vir albei panele.

// Die gelaaide lys en die sessie. Hulle leef in die SCRIPT-skoop, nie op
// window nie — 'n `let` op die boonste vlak van 'n klassieke skrip verskyn
// nooit op window nie, en `window.FP_SESSIE` sou vir ewig undefined wees.
let FP_FAKTURE = [];
let FP_SESSIE = null;

function fp_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  // t() gee die SLEUTEL terug wanneer hy hom nie ken nie — daar is geen
  // stille terugval nie. Die verstek hier geld net wanneer taal.js glad nie
  // gelaai het nie.
  return uit && uit !== sleutel ? uit : verstek;
}

function fp_wys_afdeling(naam) {
  document.querySelectorAll(".fp-afdeling").forEach((el) => {
    el.classList.toggle("wys", el.getAttribute("data-afdeling") === naam);
  });
  document.querySelectorAll("#fp-kieslys .fp-pil").forEach((pil) => {
    pil.classList.toggle("aktief", pil.getAttribute("data-gaan") === naam);
  });
}

// Die formateerder leef in taal.js — die desimaalteken is 'n taalsaak, en so
// is daar EEN weergawe vir die dokument, die skerm en die begroting.
// Hier geld die PLATFORM se taal: dit is jou skerm, nie die klient s'n nie.
function fp_rand(sent) {
  return window.t_rand
    ? t_rand(sent, kry_huidige_taal())
    : "R" + (Number(sent || 0) / 100).toFixed(2);
}

// Die maandafkortings kom uit fd_maande — een sleutel, twaalf afkortings, wat
// reeds vir die dokument bestaan. Mrt/Mar, Okt/Oct en Des/Dec verskil.
function fp_datum_kort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const maande = fp_t("fd_maande", "Jan,Feb,Mrt,Apr,Mei,Jun,Jul,Aug,Sep,Okt,Nov,Des").split(",");
  const uur = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${maande[d.getMonth()]} ${uur}:${min}`;
}

/* ═══════════════════════════════════════════════════════════════════════
   WAT GESKRAP MAG WORD

   'n Konsep ALTYD: hy het nog geen nommer, dus laat hy geen gaping in die
   reeks nie, en niemand het hom ooit gesien nie.

   Enigiets anders SLEGS met die toetsstempel, wat by die skepping gegee word
   terwyl TOETSFASE aan is en daarna nooit verander nie.

   DIT IS 'N HOFLIKHEID, NIE 'N SLOT NIE. skrap-faktuur.js toets presies
   dieselfde twee dinge en gee 409 daarsonder, ook vir iemand wat die Function
   direk roep.
   ═══════════════════════════════════════════════════════════════════════ */
function fp_mag_skrap(f) {
  return f.stand === "konsep" || f.toets === true;
}

// Waarheen 'n ry oopmaak. 'n Konsep het net sy sleutel; ná uitreiking is die
// NOMMER wat 'n mens in die hand het — dit staan op die dokument en in die
// bankverwysing. kry-faktuur.js aanvaar albei.
function fp_faktuur_url(f) {
  return f.nommer
    ? `faktuur.html?nommer=${encodeURIComponent(f.nommer)}`
    : `faktuur.html?sleutel=${encodeURIComponent(f.sleutel)}`;
}

// Alles wat uit 'n rekord kom, gaan hierdeur voordat dit in HTML beland. Die
// kliëntnaam is vrye teks wat iemand ingetik het.
function fp_ontsnap(waarde) {
  return String(waarde == null ? "" : waarde)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fp_teken_fakture(fakture) {
  const plek = document.getElementById("fp-fakture-lys");
  if (!plek) return;

  FP_FAKTURE = fakture;

  const tel = document.getElementById("fp-tel");
  if (tel) {
    tel.textContent = fakture.length
      ? `${fakture.length} ${fp_t(
          fakture.length === 1 ? "fp_faktuur_een" : "fp_faktuur_baie",
          fakture.length === 1 ? "faktuur" : "fakture"
        )}`
      : "";
  }

  if (!fakture.length) {
    // 'n Leë lys moet sê WAT ontbreek, nie net dat daar niks is nie.
    plek.innerHTML = `<p class="stelsel-boodskap">${fp_t(
      "fp_geen_fakture",
      "Daar is nog geen fakture nie."
    )}</p>`;
    return;
  }

  plek.innerHTML = fakture
    .map((f, ix) => {
      const titel = f.nommer || fp_t("fp_konsep_sonder_nommer", "Konsep");

      // 'N KONSEP WYS SY DATUM. Twee konsepte wat albei net "Konsep" heet, is
      // nie twee inskrywings nie — dit is een woord wat twee keer staan, en
      // 'n mens kan nie sê watter een watter is nie. 'n Uitgereikte faktuur
      // dra sy nommer en het dit nie nodig nie.
      const klient = fp_ontsnap(f.klient_naam);
      const onder = f.nommer
        ? klient || "—"
        : `<span class="fp-datum">${fp_datum_kort(f.geskep_op)}</span>` +
          (klient ? " · " + klient : "");

      const stempel = f.toets
        ? `<span class="fp-toets">${fp_t("fp_toetsdata", "Toetsdata")}</span>`
        : "";

      const stand = fp_t(`fp_stand_${f.stand}`, f.stand);

      // DIE RY IS 'N <button>, nie 'n <div> met 'n klik nie: dan werk Tab en
      // Enter vanself en 'n skermleser kondig hom as klikbaar aan.
      //
      // Die skrap-knoppie sit BUITE daardie knoppie. Binne-in sou 'n klik op
      // Skrap ook die faktuur oopmaak.
      return `<div class="fp-ry fp-ry-knop">
        <button type="button" class="fp-ry-oop" data-oop="${ix}">
          <span class="fp-ry-hoof">
            <span class="fp-nommer">${fp_ontsnap(titel)}</span>
            <span class="fp-klient">${onder}</span>
          </span>
          <span class="fp-ry-syfers">
            ${stempel}
            <span class="fp-stand fp-stand-${f.stand}">${stand}</span>
            <span class="fp-bedrag">${fp_rand(f.totaal_sent)}</span>
          </span>
        </button>
        <span class="fp-ry-rand" data-rand="${ix}">
          <button type="button" class="fp-skrap" data-skrap="${ix}"${
            fp_mag_skrap(f) ? "" : " disabled"
          }>${fp_t("fp_skrap", "Skrap")}</button>
        </span>
      </div>`;
    })
    .join("");

  plek.querySelectorAll("[data-oop]").forEach((knop) => {
    knop.addEventListener("click", () => {
      window.location.href = fp_faktuur_url(FP_FAKTURE[Number(knop.dataset.oop)]);
    });
  });

  plek.querySelectorAll("[data-skrap]").forEach((knop) => {
    knop.addEventListener("click", () => fp_vra_bevestiging(Number(knop.dataset.skrap)));
  });
}

/* Die bevestiging VERVANG die knoppie in sy eie ry. Nie 'n confirm() nie: dié
   blokkeer die bladsy, word weggeklik sonder om gelees te word, en sê nie
   WATTER faktuur nie. Hier staan die ry self langs die vraag. */
function fp_vra_bevestiging(ix) {
  const plek = document.querySelector(`[data-rand="${ix}"]`);
  if (!plek) return;

  plek.innerHTML = `<span class="fp-bevestig">${fp_t("fp_skrap_vra", "Skrap?")}
    <button type="button" class="fp-bevestig-ja">${fp_t("fp_ja", "Ja")}</button>
    <button type="button" class="fp-bevestig-nee">${fp_t("fp_nee", "Nee")}</button></span>`;

  plek.querySelector(".fp-bevestig-nee").addEventListener("click", () => {
    fp_teken_fakture(FP_FAKTURE);
  });

  plek.querySelector(".fp-bevestig-ja").addEventListener("click", () => {
    fp_skrap(ix, plek);
  });
}

async function fp_skrap(ix, plek) {
  const f = FP_FAKTURE[ix];
  if (!f || !FP_SESSIE) return;

  plek.innerHTML = `<span class="fp-bevestig">${fp_t("fp_laai", "Word gelaai …")}</span>`;

  try {
    const resp = await fetch("/.netlify/functions/skrap-faktuur", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FP_SESSIE.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sleutel: f.sleutel }),
    });
    if (!resp.ok) throw new Error(await resp.text());

    // PLAASLIK uit die lys, nie weer gevra nie. Blobs se list() loop sowat
    // vier sekondes agter en die geskrapte faktuur sou weer verskyn — dan lyk
    // dit of die skrap misluk het terwyl hy geslaag het.
    fp_teken_fakture(FP_FAKTURE.filter((x) => x.sleutel !== f.sleutel));
  } catch (fout) {
    console.error("Kon nie die faktuur skrap nie:", fout);
    fp_teken_fakture(FP_FAKTURE);
    const lys = document.getElementById("fp-fakture-lys");
    if (lys) {
      const boodskap = document.createElement("p");
      boodskap.className = "stelsel-boodskap";
      // Die Function se eie boodskap, want sy sê WAAROM — 'n uitgereikte
      // faktuur sonder die stempel word gekanselleer, nie geskrap nie.
      boodskap.textContent =
        String(fout.message || "").trim() || fp_t("fp_skrap_fout", "Kon nie die faktuur skrap nie.");
      lys.prepend(boodskap);
    }
  }
}

async function fp_laai_fakture(sessie) {
  const plek = document.getElementById("fp-fakture-lys");
  try {
    const resp = await fetch("/.netlify/functions/kry-fakture", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });

    // 403 hier beteken die token dra nie die rol nie. Dit gebeur wanneer die
    // rol pas bygesit is en die persoon nog nie weer aangemeld het nie — die
    // rol leef IN die token.
    if (resp.status === 403) {
      fp_geen_toegang(
        fp_t(
          "fp_geen_rol",
          "Hierdie rekening het nie toegang tot Boekhouding nie. Is die rol pas bygesit, meld een keer af en weer aan."
        )
      );
      return;
    }

    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const data = await resp.json();
    fp_teken_fakture(data.fakture || []);
  } catch (fout) {
    console.error("Kon nie die fakture laai nie:", fout);
    if (plek) {
      plek.innerHTML = `<p class="stelsel-boodskap">${fp_t(
        "fp_laai_fout",
        "Kon nie die fakture laai nie. Probeer weer."
      )}</p>`;
    }
  }
}

function fp_geen_toegang(teks) {
  const blok = document.getElementById("fp-geen-toegang");
  const paneel = document.getElementById("fp-paneel");
  const teks_el = document.getElementById("fp-geen-toegang-teks");
  if (teks && teks_el) teks_el.textContent = teks;
  if (blok) blok.style.display = "";
  if (paneel) paneel.style.display = "none";
}

document.addEventListener("DOMContentLoaded", async () => {
  const hoof = document.getElementById("fp-hoof");

  // Die bladsy begin onsigbaar sodat 'n mens nie eers die paneel sien en dan
  // die weiering nie. Dieselfde patroon as paneelbord.html.
  const wys = () => {
    if (hoof) hoof.style.visibility = "visible";
  };

  document.querySelectorAll("#fp-kieslys .fp-pil").forEach((pil) => {
    pil.addEventListener("click", () => fp_wys_afdeling(pil.getAttribute("data-gaan")));
  });

  let sessie = null;
  try {
    sessie = await identiteit_kry_huidige_sessie();
  } catch {
    sessie = null;
  }

  if (!sessie) {
    fp_geen_toegang(null);
    wys();
    return;
  }

  const epos = document.getElementById("paneel-gebruiker-epos");
  if (epos && sessie.gebruiker) epos.textContent = sessie.gebruiker.email;

  // Die kliëntkant-kontrole is 'n hoflikheid, nie 'n slot. Dra die token nie
  // die rol nie, gee kry-fakture in elk geval 403 en die boodskap hierbo wys.
  if (!identiteit_het_rol(sessie.gebruiker, "boekhouding")) {
    fp_geen_toegang(
      fp_t(
        "fp_geen_rol",
        "Hierdie rekening het nie toegang tot Boekhouding nie. Is die rol pas bygesit, meld een keer af en weer aan."
      )
    );
    wys();
    return;
  }

  const paneel = document.getElementById("fp-paneel");
  if (paneel) paneel.style.display = "";
  wys();

  FP_SESSIE = sessie;

  const nuut = document.getElementById("fp-nuwe-faktuur");
  if (nuut) {
    // Geen parameter: 'n vars konsep. Die nommer word by STUUR toegeken,
    // nie hier nie.
    nuut.addEventListener("click", () => {
      window.location.href = "faktuur.html";
    });
  }

  await fp_laai_fakture(sessie);
});
