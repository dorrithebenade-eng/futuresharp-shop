// public/js/formaat-info.js
//
// Gedeelde opspring-venster wat verduidelik hoe elke formaat (E-boek,
// Harde kopie, Leen) werk — geaktiveer deur op 'n "Beskikbaar as"-skyfie
// te klik (op die katalogus-kaart óf die produkbladsy). Een module, sodat
// die venster op albei plekke identies lyk en werk.
//
// Gebruik: die skyfies self (in katalogus.js/produk.js) moet 'n
// <button class="beskikbaar-merker" data-formaat="eboek|harde_kopie|leen"
// data-tydperk="30"> wees — hierdie module luister vir kliks op enige
// sodanige knoppie deur die hele dokument (event delegation), sodat dit
// ook werk vir kaarte wat later dinamies bygevoeg word.

function bou_formaat_info_inhoud(formaat, tydperk_dae) {
  if (formaat === "harde_kopie") {
    return {
      opskrif: t("formaat_info_hardekopie_opskrif"),
      teks: t("formaat_info_hardekopie_teks"),
      ikoon: "📦",
      klas: "formaat-info-venster--hardekopie",
    };
  }

  if (formaat === "leen") {
    const tydperk_teks = t("leen_verduideliking").replace("%tydperk%", tydperk_dae || 30);
    return {
      opskrif: t("formaat_info_leen_opskrif"),
      teks: `${t("formaat_lees_teks")} ${tydperk_teks}`,
      ikoon: "⏳",
      klas: "formaat-info-venster--leen",
    };
  }

  // eboek (verstek)
  return {
    opskrif: t("formaat_info_eboek_opskrif"),
    teks: t("formaat_lees_teks"),
    ikoon: "📖",
    klas: "formaat-info-venster--eboek",
  };
}

function verberg_formaat_info() {
  const bestaande = document.getElementById("formaat-info-oorlegsel");
  if (bestaande) bestaande.remove();
  document.removeEventListener("keydown", hanteer_formaat_info_esc);
}

function hanteer_formaat_info_esc(e) {
  if (e.key === "Escape") verberg_formaat_info();
}

function wys_formaat_info(formaat, tydperk_dae) {
  verberg_formaat_info(); // verwyder enige reeds-oop venster eers

  const { opskrif, teks, ikoon, klas } = bou_formaat_info_inhoud(formaat, tydperk_dae);

  const oorlegsel = document.createElement("div");
  oorlegsel.id = "formaat-info-oorlegsel";
  oorlegsel.className = "formaat-info-oorlegsel";
  oorlegsel.innerHTML = `
    <div class="formaat-info-venster ${klas}" role="dialog" aria-modal="true" aria-labelledby="formaat-info-opskrif">
      <div class="formaat-info-kop">
        <button type="button" class="formaat-info-toe-knoppie" aria-label="${t("formaat_info_maak_toe")}">✕</button>
        <span class="formaat-info-ikoon" aria-hidden="true">${ikoon}</span>
        <h3 id="formaat-info-opskrif" class="formaat-info-opskrif">${opskrif}</h3>
      </div>
      <div class="formaat-info-liggaam">
        <p class="formaat-info-teks">${teks}</p>
      </div>
    </div>
  `;

  document.body.appendChild(oorlegsel);

  // Klik op die donker agtergrond (nie die venster self nie) maak toe
  oorlegsel.addEventListener("click", (e) => {
    if (e.target === oorlegsel) verberg_formaat_info();
  });
  oorlegsel.querySelector(".formaat-info-toe-knoppie").addEventListener("click", verberg_formaat_info);
  document.addEventListener("keydown", hanteer_formaat_info_esc);

  oorlegsel.querySelector(".formaat-info-toe-knoppie").focus();
}

document.addEventListener("click", (e) => {
  const knoppie = e.target.closest(".beskikbaar-merker");
  if (!knoppie) return;
  wys_formaat_info(knoppie.dataset.formaat, Number(knoppie.dataset.tydperk) || null);
});
