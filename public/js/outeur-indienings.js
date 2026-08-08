// public/js/outeur-indienings.js
//
// Die "My indienings"-afdeling van die outeurspaneelbord.
//
// EIE LÊER, soos outeur-titels.js en outeur-bestellings.js: outeur.js
// hanteer aanmelding en die raamwerk, en stuur die `outeur-gereed`-
// gebeurtenis sodra die outeur bevestig is. Hierdie lêer weet niks van
// aanmelding nie.
//
// DRIE GROEPE, in die volgorde waarin hulle sy aandag verg:
//   Ingedien vir prosessering  — wag by Future Sharp
//   Op die Winkelrak           — goedgekeur en te koop
//   In proses vóór indien      — sy konsepte
//
// `goedgekeur` HOORT BY DIE EERSTE GROEP. Die vorm is goedgekeur maar die
// boek is nog nie opgestel nie; die werk lê steeds by Future Sharp. Sonder
// hierdie reël val die stand deur na die laaste tak en dan lees 'n
// goedgekeurde boek as "In proses" in sy eie konsepte — asof die indiening
// ongedaan gemaak is.
//
// Die merkies op die kaarte is KORTER as die opskrifte — In proses,
// Ingedien, Goedgekeur, Wysiging hangend, Op die rak — want 'n merkie moet
// in een oogopslag lees waar 'n opskrif 'n groep mag beskryf.
//
// DIE WINKEL SE NAAM HOORT NIE HIER NIE. Die skerm gaan oor sy boek, nie
// oor Future Sharp nie.

function oi_vertaal(sleutel, terugval) {
  return window.t ? window.t(sleutel) : terugval;
}

// Die stand op die rekord, na wat op die kaart gewys word. Twee kolomme,
// want 'n rekord op die rak MET 'n hangende wysiging lees anders as een
// sonder.
function oi_merkie(indiening) {
  if (indiening.stand === "op_rak") {
    return indiening.het_hangende_wysiging
      ? { klas: "oi-hangend", teks: oi_vertaal("oi_merk_wysiging", "Wysiging hangend") }
      : { klas: "oi-rak", teks: oi_vertaal("oi_merk_rak", "Op die rak") };
  }
  if (indiening.stand === "wysiging") {
    return { klas: "oi-hangend", teks: oi_vertaal("oi_merk_wysiging", "Wysiging hangend") };
  }
  if (indiening.stand === "goedgekeur") {
    return { klas: "oi-ingedien", teks: oi_vertaal("oi_merk_goedgekeur", "Goedgekeur") };
  }
  if (indiening.stand === "ingedien") {
    return { klas: "oi-ingedien", teks: oi_vertaal("oi_merk_ingedien", "Ingedien") };
  }
  return { klas: "oi-konsep", teks: oi_vertaal("oi_merk_konsep", "In proses") };
}

function oi_datum(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("af-ZA", { day: "numeric", month: "short" });
}

// 'n Konsep sonder titel is nie 'n fout nie — hy het pas begin.
function oi_titel(indiening) {
  const titel = String(indiening.titel || "").trim();
  return titel || oi_vertaal("oi_geen_titel", "Sonder titel");
}

function oi_kaart(indiening) {
  const kaart = document.createElement("article");
  kaart.className = "oi-kaart";

  const kop = document.createElement("div");
  kop.className = "oi-kaart-kop";

  const links = document.createElement("div");
  const titel = document.createElement("p");
  titel.className = "oi-titel";
  titel.textContent = oi_titel(indiening);
  const nr = document.createElement("span");
  nr.className = "oi-nr";
  const wanneer = oi_datum(indiening.gewysig_op);
  nr.textContent = indiening.nommer + (wanneer ? " · " + wanneer : "");
  links.appendChild(titel);
  links.appendChild(nr);

  const merkie = oi_merkie(indiening);
  const pil = document.createElement("span");
  pil.className = "oi-merk " + merkie.klas;
  pil.textContent = merkie.teks;

  kop.appendChild(links);
  kop.appendChild(pil);
  kaart.appendChild(kop);

  // 'n Opmerking is die belangrikste ding op die kaart — dit is wat hy moet
  // doen. Dit staan dus bo die knoppies en nie in fynskrif nie.
  if (indiening.opmerking) {
    const nota = document.createElement("p");
    nota.className = "oi-opmerking";
    nota.textContent = indiening.opmerking;
    kaart.appendChild(nota);
  }

  const aksies = document.createElement("div");
  aksies.className = "oi-aksies";

  const oop = document.createElement("a");
  oop.className = "oi-knoppie oi-hoof";
  oop.href = "indien.html?nommer=" + encodeURIComponent(indiening.nommer);
  oop.textContent =
    indiening.stand === "konsep"
      ? oi_vertaal("oi_gaan_voort", "Gaan voort")
      : oi_vertaal("oi_bekyk", "Bekyk");
  aksies.appendChild(oop);

  kaart.appendChild(aksies);
  return kaart;
}

function oi_groep(houer, opskrif, lys, leeg_teks) {
  if (!lys.length) return;

  const kop = document.createElement("h2");
  kop.className = "outeur-sub-opskrif";
  kop.textContent = opskrif;
  houer.appendChild(kop);

  lys.forEach((indiening) => houer.appendChild(oi_kaart(indiening)));
}

function oi_teken(indienings) {
  const houer = document.getElementById("outeur-indienings-lys");
  if (!houer) return;
  houer.innerHTML = "";

  if (!indienings.length) {
    const leeg = document.createElement("p");
    leeg.className = "outeur-leeg";
    leeg.textContent = oi_vertaal(
      "oi_niks",
      "Nog geen boekvorm nie. Begin een sodra jy gereed is."
    );
    houer.appendChild(leeg);
    return;
  }

  const ingedien = indienings.filter(
    (i) => i.stand === "ingedien" || i.stand === "wysiging" ||
           i.stand === "goedgekeur" ||
           (i.stand === "op_rak" && i.het_hangende_wysiging)
  );
  const op_rak = indienings.filter((i) => i.stand === "op_rak" && !i.het_hangende_wysiging);
  const konsepte = indienings.filter((i) => i.stand === "konsep");

  oi_groep(houer, oi_vertaal("oi_kop_ingedien", "Ingedien vir prosessering"), ingedien);
  oi_groep(houer, oi_vertaal("oi_kop_rak", "Op die Winkelrak"), op_rak);
  oi_groep(houer, oi_vertaal("oi_kop_konsep", "In proses vóór indien"), konsepte);
}

async function oi_laai() {
  const status = document.getElementById("outeur-indienings-status");
  if (status) status.textContent = oi_vertaal("laai_tans", "Laai …");

  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) return;

  try {
    const resp = await fetch("/.netlify/functions/kry-my-indienings", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });

    if (!resp.ok) {
      if (status) {
        status.textContent = oi_vertaal(
          "fout_algemeen",
          "Iets het verkeerd geloop. Probeer asseblief weer."
        );
      }
      return;
    }

    const data = await resp.json();
    if (status) status.textContent = "";
    oi_teken(data.indienings || []);
  } catch (fout) {
    console.error("Kon nie die indienings laai nie:", fout);
    if (status) {
      status.textContent = oi_vertaal(
        "fout_netwerk",
        "Kon nie verbind nie. Kontroleer jou verbinding en probeer weer."
      );
    }
  }
}

document.addEventListener("outeur-gereed", oi_laai);
