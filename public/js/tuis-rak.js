// public/js/tuis-rak.js — die boeke op die tuisblad (November 2026).
//
// Die tuisblad wys AL die rye van die Boeke-bladsy, in die volgorde wat in
// die paneel ("Boeke-bladsy en tuisblad") gekies is. Bo-aan staan die ry
// "Nuut op die rak" (die vier nuutste boeke) net as dit in die paneel
// aangeskakel is; by verstek is dit af.

(function () {
  function ry_html(titel, skakel, boeke, data, vier) {
    return `
      <section class="bk-ry">
        <div class="bk-ry-kop bk-ry-kop--met-skakel">
          <h2 class="bk-ry-titel">${bk_esc(titel)}</h2>
          <a class="bk-sien-alles" href="${skakel}">${t("bk_sien_alles")} →</a>
        </div>
        <div class="bk-rooster${vier ? " bk-rooster--vier" : ""}">${boeke.map((p) => bk_kaart(p, data)).join("")}</div>
      </section>`;
  }

  async function laai() {
    const plek = document.getElementById("tuis-rye");
    if (!plek) return;
    try {
      const [data, afd] = await Promise.all([
        bk_laai_alles(),
        fetch("/.netlify/functions/kry-afdelings").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      ]);
      const in_taal = bk_in_taal(data.produkte);
      let html = "";
      if (afd.band && afd.band.nuut_op_rak === true) {
        const nuutste = in_taal.slice()
          .sort((a, b) => String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")))
          .slice(0, 4);
        if (nuutste.length) html += ry_html(t("bk_nuut_op_rak"), "boeke.html", nuutste, data, true);
      }
      html += bk_bou_rye(in_taal, data)
        .map((ry) => ry_html(ry.naam, `boeke.html#afdeling-${bk_anker(ry.kode)}`, ry.boeke, data, false))
        .join("");
      plek.innerHTML = html;
    } catch (fout) {
      console.warn("Kon nie die boeke op die tuisblad laai nie:", fout);
      plek.innerHTML = `<p class="stelsel-boodskap">${t("katalogus_leeg_beskrywing")}</p>`;
    }
  }
  document.addEventListener("DOMContentLoaded", laai);
})();
