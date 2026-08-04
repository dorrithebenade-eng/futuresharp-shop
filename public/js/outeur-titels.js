// public/js/outeur-titels.js
//
// Die "My boeke"-afdeling van die outeurspaneelbord, plus die vier syfers
// op die oorsig. Albei kom uit dieselfde Function, en die oproep gebeur
// een keer.
//
// EIE LÊER: outeur.js hanteer aanmelding en die raamwerk. Hierdie lêer weet
// niks van aanmelding nie — dit wag tot outeur.js sê die outeur is bevestig.
//
// Die kieslys leef hier omdat dit saam met die afdelings groei; elke
// volgende stap voeg 'n knoppie en 'n afdeling by, sonder om outeur.js aan
// te raak.

function outeur_titels_vertaal(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

function rand(sent) {
  const bedrag = (Number(sent) || 0) / 100;
  return "R" + bedrag.toLocaleString("af-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FORMAAT_ETIKETTE = {
  eboek: { sleutel: "formaat_eboek", terugval: "E-boek" },
  harde_kopie: { sleutel: "formaat_harde_kopie", terugval: "Harde kopie" },
  leen: { sleutel: "formaat_leen", terugval: "Leen" },
};

// --- Kieslys ---

function stel_kieslys_op() {
  document.querySelectorAll(".outeur-kieslys-item").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      document.querySelectorAll(".outeur-kieslys-item").forEach((k) => k.classList.remove("aktief"));
      knoppie.classList.add("aktief");

      const doel = knoppie.getAttribute("data-gaan");
      document.querySelectorAll(".outeur-afdeling").forEach((afdeling) => {
        afdeling.classList.toggle("wys", afdeling.getAttribute("data-afdeling") === doel);
      });
    });
  });
}

// --- Die vier syfers op die oorsig ---

function vul_syfers(opsomming) {
  const houer = document.getElementById("outeur-syfers");
  if (!houer) return;

  const waardes = [
    opsomming.titels_te_koop,
    opsomming.verkope_totaal,
    rand(opsomming.deel_totaal_sent),
    opsomming.bestellings_uitstaande,
  ];

  houer.querySelectorAll(".outeur-syfer-waarde").forEach((el, i) => {
    if (waardes[i] !== undefined && waardes[i] !== null) el.textContent = waardes[i];
  });
}

// --- Die lys titels ---

function bou_titel_ry(titel) {
  const ry = document.createElement("article");
  ry.className = "outeur-titel";

  const kop = document.createElement("div");
  kop.className = "outeur-titel-kop";

  const naam = document.createElement("h2");
  naam.className = "outeur-titel-naam";
  naam.textContent = titel.titel;
  kop.appendChild(naam);

  const merkie = document.createElement("span");
  const te_koop = titel.status === "te_koop";
  merkie.className = "outeur-merkie " + (te_koop ? "lewend" : "stil");
  merkie.textContent = te_koop
    ? outeur_titels_vertaal("outeur_status_te_koop", "Te koop")
    : outeur_titels_vertaal("outeur_status_nie_aktief", "Nie te koop nie");
  kop.appendChild(merkie);

  ry.appendChild(kop);

  if (titel.formate.length) {
    const formate = document.createElement("p");
    formate.className = "outeur-titel-formate";
    formate.textContent = titel.formate
      .map((f) => {
        const e = FORMAAT_ETIKETTE[f];
        return e ? outeur_titels_vertaal(e.sleutel, e.terugval) : f;
      })
      .join(" · ");
    ry.appendChild(formate);
  }

  const syfers = document.createElement("div");
  syfers.className = "outeur-titel-syfers";

  [
    { etiket: outeur_titels_vertaal("outeur_kolom_besigtigings", "Besigtigings"), waarde: titel.besigtigings },
    { etiket: outeur_titels_vertaal("outeur_kolom_verkope", "Verkope"), waarde: titel.my_verkope },
    { etiket: outeur_titels_vertaal("outeur_kolom_my_deel", "Jou deel"), waarde: rand(titel.my_deel_sent) },
  ].forEach((s) => {
    const blok = document.createElement("div");

    const waarde = document.createElement("span");
    waarde.className = "outeur-titel-syfer-waarde";
    waarde.textContent = s.waarde;

    const etiket = document.createElement("span");
    etiket.className = "outeur-titel-syfer-etiket";
    etiket.textContent = s.etiket;

    blok.appendChild(waarde);
    blok.appendChild(etiket);
    syfers.appendChild(blok);
  });

  ry.appendChild(syfers);
  return ry;
}

function teken_titels(titels) {
  const lys = document.getElementById("outeur-titels-lys");
  const status = document.getElementById("outeur-titels-status");
  if (!lys) return;

  lys.innerHTML = "";

  if (!titels.length) {
    if (status) {
      status.textContent = outeur_titels_vertaal(
        "outeur_geen_titels",
        "Jy het nog geen titels op Future Shop nie."
      );
    }
    return;
  }

  if (status) status.textContent = "";
  titels.forEach((titel) => lys.appendChild(bou_titel_ry(titel)));
}

// --- Laai ---

async function laai_my_titels() {
  const status = document.getElementById("outeur-titels-status");
  if (status) status.textContent = outeur_titels_vertaal("laai_tans", "Laai …");

  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) return;

  try {
    const resp = await fetch("/.netlify/functions/kry-my-titels", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });

    if (!resp.ok) {
      // Die oorsig het reeds gelaai, so die outeur bestaan. Kom hier tog
      // 'n fout, bly die syfers strepies en die lys sê wat gebeur het —
      // dit is beter as 'n lys wat leeg lyk asof daar niks is nie.
      if (status) {
        status.textContent = outeur_titels_vertaal(
          "fout_algemeen",
          "Iets het verkeerd geloop. Probeer asseblief weer."
        );
      }
      return;
    }

    const data = await resp.json();
    vul_syfers(data.opsomming || {});
    teken_titels(data.titels || []);
  } catch (fout) {
    console.error("Kon nie die titels laai nie:", fout);
    if (status) {
      status.textContent = outeur_titels_vertaal(
        "fout_netwerk",
        "Kon nie verbind nie. Kontroleer jou verbinding en probeer weer."
      );
    }
  }
}

// outeur.js stuur hierdie gebeurtenis sodra die outeur bevestig is.
document.addEventListener("outeur-gereed", () => {
  stel_kieslys_op();
  laai_my_titels();
});
