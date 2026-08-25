// public/js/faktuurpaneel-skrap-klient.js
//
// Die Skrap-knoppie in die kliëntvorm.
//
// 'N EIE LEER, EN HY WYSIG NIKS. faktuurpaneel-kliente.js werk; hierdie een
// haak 'n knoppie in sy knoppierij en gebruik sy FK-toestand en sy fk_laai().
//
// DIE KNOPPIE VERSKYN NET BY 'N BESTAANDE KLIENT. Maak 'n mens die vorm oop
// vir 'n NUWE kliënt, is daar niks om te skrap nie, en 'n knoppie wat dan
// daar staan, laat 'n mens wonder wat hy sou skrap.
//
// DIE WERKLIKE KEER SIT BEDIENERKANT. skrap-klient.js weier 'n kliënt met
// enige faktuur, ook 'n konsep, en hy sê watter een in die pad staan. Hierdie
// lêer doen geen toets nie — hy vra, en hy wys wat die bediener antwoord.
// 'n Toets hier sou 'n tweede weergawe van dieselfde reël wees, en dan
// verander 'n mens die een en nie die ander nie.
//
// KORAAL, want dit is onomkeerbaar. Die bevestiging staan in die knoppie self
// in plaas van in 'n window.confirm — dieselfde patroon as die faktuurlys se
// "Skrap?".

let SKL_KNOP = null;
let SKL_WAG = false;

function skl_t(sleutel, verstek) {
  const uit = window.t ? window.t(sleutel) : null;
  return uit && uit !== sleutel ? uit : verstek;
}

function skl_herstel() {
  SKL_WAG = false;
  if (!SKL_KNOP) return;
  SKL_KNOP.textContent = skl_t("skl_skrap", "Skrap");
  SKL_KNOP.classList.remove("skl-bevestig");
  SKL_KNOP.disabled = false;
}

function skl_wys_fout(teks) {
  const plek = document.getElementById("fk-vorm-fout");
  if (!plek) return;
  plek.textContent = teks;
  plek.style.display = "";
}

async function skl_klik() {
  if (typeof FK === "undefined" || !FK || !FK.wysig) return;

  // Eerste klik vra; tweede klik doen. 'n Mens moet twee keer besluit.
  if (!SKL_WAG) {
    SKL_WAG = true;
    SKL_KNOP.textContent = skl_t("skl_bevestig", "Skrap regtig?");
    SKL_KNOP.classList.add("skl-bevestig");
    return;
  }

  SKL_KNOP.disabled = true;
  SKL_KNOP.textContent = skl_t("skl_besig", "Besig …");

  try {
    const resp = await fetch("/.netlify/functions/skrap-klient", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FK.sessie.access_token}`,
      },
      body: JSON.stringify({ nommer: FK.wysig }),
    });

    // Die bediener se woorde word woordeliks gewys. Hy weet WATTER faktuur in
    // die pad staan; 'n algemene boodskap hier sou daardie nommer weggooi.
    if (!resp.ok) {
      skl_wys_fout((await resp.text()) || skl_t("skl_fout", "Kon nie die kliënt skrap nie."));
      skl_herstel();
      return;
    }

    if (typeof fk_maak_vorm_toe === "function") fk_maak_vorm_toe();
    if (typeof fk_laai === "function") await fk_laai();
    skl_herstel();
  } catch (fout) {
    console.error("Kon nie die kliënt skrap nie:", fout);
    skl_wys_fout(skl_t("skl_fout", "Kon nie die kliënt skrap nie."));
    skl_herstel();
  }
}

function skl_stel_knop() {
  const ry = document.querySelector("#fk-vorm .fk-knoppies");
  if (!ry) return;

  if (!SKL_KNOP) {
    SKL_KNOP = document.createElement("button");
    SKL_KNOP.type = "button";
    SKL_KNOP.id = "fk-skrap";
    SKL_KNOP.className = "kaart-aksie skl-skrap";
    SKL_KNOP.addEventListener("click", skl_klik);
    // Heel links, weg van Stoor. 'n Onomkeerbare knoppie hoort nie langs die
    // een wat 'n mens elke keer druk nie.
    ry.insertBefore(SKL_KNOP, ry.firstChild);
  }

  skl_herstel();
  const wysig = typeof FK !== "undefined" && FK && FK.wysig;
  SKL_KNOP.style.display = wysig ? "" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const vorm = document.getElementById("fk-vorm");
  if (!vorm) return;

  // fk_maak_vorm_oop() stel FK.wysig en sit dan "oop" op die oorlegsel. Ons
  // wag op DAARDIE klas in plaas van die knoppie by elke klik te herbou —
  // dieselfde waarnemer-patroon as elders in die paneel.
  const waarnemer = new MutationObserver(() => {
    if (vorm.classList.contains("oop")) skl_stel_knop();
  });
  waarnemer.observe(vorm, { attributes: true, attributeFilter: ["class"] });

  if (vorm.classList.contains("oop")) skl_stel_knop();
});
