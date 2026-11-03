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
  let DATA = null;
  let KATEGORIEE = [];

  function bou_rye(produkte) {
    const { per_slug, afdelings_per_kode } = DATA;
    const groepe = new Map();
    for (const p of produkte) {
      const { kode, volgorde } = bk_kode(p, per_slug);
      if (!groepe.has(kode)) groepe.set(kode, []);
      groepe.get(kode).push({ p, volgorde });
    }
    const rye = [...groepe.entries()].map(([kode, boeke]) => {
      boeke.sort((a, b) => (a.volgorde || 999) - (b.volgorde || 999)
        || String(a.p.titel).localeCompare(String(b.p.titel), "af", { numeric: true }));
      const meta = afdelings_per_kode.get(kode);
      const en = bk_taal() === "en";
      return {
        kode,
        naam: kode ? bk_afdeling_naam(kode, afdelings_per_kode, boeke[0].p) : t("bk_ander_boeke"),
        beskrywing: meta ? (en ? (meta.beskrywing_en || meta.beskrywing_af) : (meta.beskrywing_af || meta.beskrywing_en)) : "",
        plek: kode ? ((meta && meta.plek) || 500) : 10000,
        boeke: boeke.map((b) => b.p),
      };
    });
    rye.sort((a, b) => a.plek - b.plek || b.boeke.length - a.boeke.length || a.naam.localeCompare(b.naam, "af"));
    return rye;
  }

  function teken() {
    const wrap = document.getElementById("boeke-rye");
    let produkte = bk_in_taal(DATA.produkte);
    if (AKTIEF.size) {
      produkte = produkte.filter((p) => (p.kategorie_ids || []).some((id) => AKTIEF.has(id)));
    }
    const rye = bou_rye(produkte);
    if (!rye.length) {
      wrap.innerHTML = `<p class="stelsel-boodskap">${t("katalogus_leeg")}</p>`;
      return;
    }
    wrap.innerHTML = rye.map((ry) => `
      <section class="bk-ry" id="afdeling-${bk_esc((ry.kode || "ander").toLowerCase())}">
        <div class="bk-ry-kop">
          <h2 class="bk-ry-titel">${bk_esc(ry.naam)}</h2>
          ${ry.beskrywing ? `<p class="bk-ry-beskrywing">${bk_esc(ry.beskrywing)}</p>` : ""}
        </div>
        <div class="bk-rooster">${ry.boeke.map((p) => bk_kaart(p, DATA)).join("")}</div>
      </section>`).join("");
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
      const gebruik = new Set(bk_in_taal(data.produkte).flatMap((p) => p.kategorie_ids || []));
      KATEGORIEE = (kat.kategoriee || []).filter((k) => gebruik.has(k.kategorie_id));
      teken_chips();
      teken();
    } catch (fout) {
      console.error("Kon nie die boeke laai nie:", fout);
      wrap.innerHTML = `<p class="stelsel-boodskap">${t("katalogus_leeg_beskrywing")}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", laai);
})();
