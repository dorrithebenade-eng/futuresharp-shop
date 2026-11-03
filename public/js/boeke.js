// public/js/boeke.js — die Boeke-bladsy (November 2026).
//
// Rye per afdeling (reeks), in die plek wat in die paneel onder
// "Afdelings (Boeke-bladsy)" gestel is. Binne 'n ry volg die boeke hul
// volgorde in die reeks. Boeke sonder 'n reeks staan in "Ander boeke"
// onderaan. Die kategorie-knoppies in die band filter die boeke; 'n ry wat
// leeg raak, verdwyn.
//
// Net boeke in die gekose taal wys (plus boeke wat net in die ander taal
// bestaan). Die kaart sê "Ook in Engels" waar daar 'n eweknie is.

(function () {
  const AKTIEF = new Set();
  // Taalkeuse (November 2026): standaard die winkel se taal, maar 'n
  // besoeker kan ook die ander taal of albei kies, sodat iemand op die
  // Afrikaanse kant ook die Engelse boeke kan sien.
  let TAAL = typeof kry_huidige_taal === "function" ? kry_huidige_taal() : "af";
  let DATA = null;
  let KATEGORIEE = [];

  function teken() {
    const wrap = document.getElementById("boeke-rye");
    let produkte = bk_in_taal(DATA.produkte, TAAL);
    if (AKTIEF.size) {
      produkte = produkte.filter((p) => (p.kategorie_ids || []).some((id) => AKTIEF.has(id)));
    }
    const rye = bk_bou_rye(produkte, DATA);
    if (!rye.length) {
      wrap.innerHTML = `<p class="stelsel-boodskap">${t("katalogus_leeg")}</p>`;
      return;
    }
    wrap.innerHTML = rye.map((ry) => `
      <section class="bk-ry" id="afdeling-${bk_anker(ry.kode)}">
        <div class="bk-ry-kop">
          <h2 class="bk-ry-titel">${bk_esc(ry.naam)}</h2>
          ${ry.beskrywing ? `<p class="bk-ry-beskrywing">${bk_esc(ry.beskrywing)}</p>` : ""}
        </div>
        <div class="bk-rooster">${ry.boeke.map((p) => bk_kaart(p, DATA)).join("")}</div>
      </section>`).join("");
  }

  function teken_taal() {
    const wrap = document.getElementById("boeke-taal");
    if (!wrap) return;
    const opsies = [["af", "Afrikaans"], ["en", "English"], ["albei", t("bk_albei_tale")]];
    wrap.innerHTML = `<span class="bk-taal-etiket">${bk_esc(t("bk_boeke_in"))}</span>`
      + opsies.map(([k, n]) => `<button type="button" class="bk-chip bk-chip--klein${TAAL === k ? " bk-chip--aan" : ""}" data-taal-keuse="${k}">${bk_esc(n)}</button>`).join("");
    wrap.querySelectorAll("[data-taal-keuse]").forEach((c) => c.addEventListener("click", () => {
      TAAL = c.dataset.taalKeuse;
      teken_taal();
      teken();
    }));
  }

  function teken_chips() {
    const wrap = document.getElementById("boeke-chips");
    if (!KATEGORIEE.length) { wrap.innerHTML = ""; return; }
    const en = bk_taal() === "en";
    const chip = (id, naam, aan) => `<button type="button" class="bk-chip${aan ? " bk-chip--aan" : ""}" data-kategorie="${bk_esc(id)}">${bk_esc(naam)}</button>`;
    wrap.innerHTML = chip("", t("filter_alle"), AKTIEF.size === 0)
      + KATEGORIEE.map((k) => chip(k.kategorie_id, en ? (k.naam_en || k.naam_af) : (k.naam_af || k.naam_en), AKTIEF.has(k.kategorie_id))).join("");
    wrap.querySelectorAll(".bk-chip").forEach((c) => c.addEventListener("click", () => {
      const id = c.dataset.kategorie;
      if (!id) AKTIEF.clear();
      else if (AKTIEF.has(id)) AKTIEF.delete(id);
      else AKTIEF.add(id);
      teken_chips();
      teken();
    }));
  }

  async function laai() {
    const wrap = document.getElementById("boeke-rye");
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("katalogus_laai")}</p>`;
    try {
      const [data, kat] = await Promise.all([
        bk_laai_alles(),
        fetch("/.netlify/functions/kry-kategoriee").then((r) => (r.ok ? r.json() : { kategoriee: [] })).catch(() => ({ kategoriee: [] })),
      ]);
      DATA = data;
      // Net kategorieë wat by 'n boek in hierdie taal gebruik word.
      const gebruik = new Set(data.produkte.flatMap((p) => p.kategorie_ids || []));
      KATEGORIEE = (kat.kategoriee || []).filter((k) => gebruik.has(k.kategorie_id));
      teken_chips();
      teken_taal();
      teken();
    } catch (fout) {
      console.error("Kon nie die boeke laai nie:", fout);
      wrap.innerHTML = `<p class="stelsel-boodskap">${t("katalogus_leeg_beskrywing")}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", laai);
})();
