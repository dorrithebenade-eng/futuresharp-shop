// public/js/faktuurpaneel-skrap-begunstigde.js
//
// Die Skrap-knoppie in die begunstigde-vorm.
//
// DIT IS 'N SPIEELBEELD VAN faktuurpaneel-skrap-klient.js, en dit is 'n
// bewuste keuse. Die twee vorms verskil in elke naam wat saak maak — die
// toestand (BG teenoor FK), die sleutelveld (begunstigde_id teenoor nommer),
// die Function en die herlaai. 'n Gedeelde weergawe sou van al vier 'n
// parameter maak, en dan lees 'n mens twee lêers om een knoppie te verstaan.
//
// Wat NIE gedupliseer word nie, is die reël oor wat geskrap mag word. Sy leef
// bedienerkant in skrap-begunstigde.js, en hierdie lêer doen geen eie toets
// nie — hy vra, en hy wys wat die bediener antwoord.

let SBG_KNOP = null;
let SBG_WAG = false;

function sbg_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function sbg_herstel() {
  SBG_WAG = false;
  if (!SBG_KNOP) return;
  SBG_KNOP.textContent = sbg_t("skl_skrap", "Skrap");
  SBG_KNOP.classList.remove("skl-bevestig");
  SBG_KNOP.disabled = false;
}

async function sbg_klik() {
  if (typeof BG === "undefined" || !BG || !BG.wysig) return;

  // Eerste klik vra; tweede klik doen.
  if (!SBG_WAG) {
    SBG_WAG = true;
    SBG_KNOP.textContent = sbg_t("skl_bevestig", "Skrap regtig?");
    SBG_KNOP.classList.add("skl-bevestig");
    return;
  }

  SBG_KNOP.disabled = true;
  SBG_KNOP.textContent = sbg_t("skl_besig", "Besig \u2026");

  try {
    const resp = await fetch("/.netlify/functions/skrap-begunstigde", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BG.sessie.access_token}`,
      },
      body: JSON.stringify({ begunstigde_id: BG.wysig }),
    });

    // Die bediener se woorde word woordeliks gewys. Hy weet WATTER faktuur in
    // die pad staan; 'n algemene boodskap hier sou daardie nommer weggooi.
    if (!resp.ok) {
      const teks = (await resp.text()) || sbg_t("sbg_fout", "Kon nie die begunstigde skrap nie.");
      if (typeof bg_wys_fout === "function") bg_wys_fout(teks);
      sbg_herstel();
      return;
    }

    if (typeof bg_maak_vorm_toe === "function") bg_maak_vorm_toe();
    if (typeof bg_laai === "function") await bg_laai();
    sbg_herstel();
  } catch (fout) {
    console.error("Kon nie die begunstigde skrap nie:", fout);
    if (typeof bg_wys_fout === "function") {
      bg_wys_fout(sbg_t("sbg_fout", "Kon nie die begunstigde skrap nie."));
    }
    sbg_herstel();
  }
}

function sbg_stel_knop() {
  const ry = document.querySelector("#bg-vorm .fk-knoppies");
  if (!ry) return;

  if (!SBG_KNOP) {
    SBG_KNOP = document.createElement("button");
    SBG_KNOP.type = "button";
    SBG_KNOP.id = "bg-skrap";
    SBG_KNOP.className = "kaart-aksie skl-skrap";
    SBG_KNOP.addEventListener("click", sbg_klik);
    // Heel links, weg van Stoor.
    ry.insertBefore(SBG_KNOP, ry.firstChild);
  }

  sbg_herstel();
  SBG_KNOP.style.display = typeof BG !== "undefined" && BG && BG.wysig ? "" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const vorm = document.getElementById("bg-vorm");
  if (!vorm) return;

  const waarnemer = new MutationObserver(() => {
    if (vorm.classList.contains("oop")) sbg_stel_knop();
  });
  waarnemer.observe(vorm, { attributes: true, attributeFilter: ["class"] });

  if (vorm.classList.contains("oop")) sbg_stel_knop();
});
