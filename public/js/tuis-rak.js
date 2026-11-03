// public/js/tuis-rak.js — "Nuut op die rak" op die tuisblad (November 2026).
//
// Die vier nuutste boeke in die gekose taal, met die nuwe boekkaart. Die
// volledige rak, in afdelings, is op boeke.html.

(function () {
  async function laai() {
    const plek = document.getElementById("tuis-rak");
    if (!plek) return;
    try {
      const data = await bk_laai_alles();
      const nuutste = bk_in_taal(data.produkte)
        .slice()
        .sort((a, b) => String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")))
        .slice(0, 4);
      plek.innerHTML = nuutste.map((p) => bk_kaart(p, data)).join("");
    } catch (fout) {
      console.warn("Kon nie Nuut op die rak laai nie:", fout);
      plek.innerHTML = `<p class="stelsel-boodskap">${t("katalogus_leeg_beskrywing")}</p>`;
    }
  }
  document.addEventListener("DOMContentLoaded", laai);
})();
