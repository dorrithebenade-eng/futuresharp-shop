// public/js/faktuurpaneel-toetse.js
//
// "Skrap alle toetse" onderaan die Kliënte- en die Projekte-register.
//
// DIESELFDE PATROON AS DIE STUDIEVAARDIGHEIDSPANEEL: 'n toets is 'n naam wat
// met TOETS begin, die blok verskyn net wanneer daar toetse is, en die knoppie
// word met getikte woorde oopgesluit. Een handeling ruim albei registers op,
// want 'n toetskliënt hang gewoonlik aan 'n toetsprojek.
//
// 'N NUWE LEER. faktuurpaneel-kliente.js bly onaangeraak; ná die skrap word sy
// fk_laai() geroep as dit bestaan, en faktuurpaneel-projekte.js se pj_laai().

(function () {
  "use strict";

  const WOORDE = "SKRAP TOETSE";
  const IS_TOETS = /^\s*TOETS\b/;
  const STAAT = { projekte: 0, kliente: 0, befondsers: 0, soorte: 0 };

  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }

  async function vra(naam, opsies) {
    const resp = await fetch("/.netlify/functions/" + naam, {
      ...(opsies || {}),
      headers: { ...((opsies && opsies.headers) || {}), ...(await identiteit_kop()) },
    });
    if (!resp.ok) {
      const teks = await resp.text().catch(() => "");
      throw new Error(teks || String(resp.status));
    }
    return resp.json();
  }

  function bou_blok(plek_id, blok_id) {
    const lys = document.getElementById(plek_id);
    if (!lys || document.getElementById(blok_id)) return;
    const d = document.createElement("div");
    d.className = "ts-blok";
    d.id = blok_id;
    d.hidden = true;
    d.innerHTML =
      '<b>' + t("ts_titel", "Skrap alle toetse") + "</b>" +
      '<p class="ts-hulp"></p>' +
      '<div class="ts-ry">' +
      '<input type="text" class="veld-invoer ts-woorde" autocomplete="off" autocapitalize="characters" placeholder="' +
      t("ts_tik", "Tik:") + " " + WOORDE + '">' +
      '<button type="button" class="kaart-aksie ts-knop" disabled>' + t("ts_knop", "Skrap alle toetse") + "</button>" +
      "</div>" +
      '<p class="ts-uitslag" hidden></p>';
    lys.insertAdjacentElement("afterend", d);

    const inp = d.querySelector(".ts-woorde");
    const knop = d.querySelector(".ts-knop");
    inp.addEventListener("input", () => { knop.disabled = inp.value.trim() !== WOORDE; });
    knop.addEventListener("click", () => skrap(inp, knop));
  }

  function teken() {
    const tel = STAAT.projekte + STAAT.kliente + STAAT.befondsers + STAAT.soorte;
    const hulp = t("ts_hulp2",
      "Alles waarvan die naam met TOETS begin: {p} projek(te), {k} kliënt(e), {b} befondser(s) of skenker(s), " +
      "{s} befondsingsoort(e). 'n Toetskliënt met 'n faktuur of kwotasie, of op 'n regte projek, bly staan. Tik {w} om te bevestig.")
      .replace("{p}", STAAT.projekte).replace("{k}", STAAT.kliente)
      .replace("{b}", STAAT.befondsers).replace("{s}", STAAT.soorte).replace("{w}", WOORDE);
    document.querySelectorAll(".ts-blok").forEach((d) => {
      d.hidden = tel === 0 && d.querySelector(".ts-uitslag").hidden;
      d.querySelector(".ts-hulp").textContent = hulp;
    });
  }

  async function tel_kliente() {
    try {
      const data = await vra("kry-kliente");
      STAAT.kliente = (data.kliente || []).filter((k) => IS_TOETS.test(k.naam || "")).length;
    } catch (fout) {
      console.error("Kon nie die kliënte tel nie:", fout);
    }
  }

  async function tel_projekte() {
    try {
      const data = await vra("kry-projekte");
      STAAT.projekte = (data.projekte || []).filter((p) => IS_TOETS.test(p.naam || "")).length;
    } catch (fout) {
      console.error("Kon nie die projekte tel nie:", fout);
    }
  }

  async function skrap(inp, knop) {
    if (inp.value.trim() !== WOORDE) return;
    knop.disabled = true;
    const uitslag = knop.closest(".ts-blok").querySelector(".ts-uitslag");
    try {
      const uit = await vra("skrap-toetse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ woorde: WOORDE }),
      });
      let teks = t("ts_klaar2", "Uitgevee: {p} projek(te), {k} kliënt(e), {b} befondser(s) of skenker(s), {s} befondsingsoort(e).")
        .replace("{p}", uit.projekte).replace("{k}", uit.kliente)
        .replace("{b}", uit.befondsers || 0).replace("{s}", uit.soorte || 0);
      if (uit.bly && uit.bly.length) teks += " " + t("ts_bly", "Bly staan:") + " " + uit.bly.join("; ") + ".";
      if (uit.foute && uit.foute.length) teks += " " + t("ts_fout", "Kon nie uitvee nie:") + " " + uit.foute.join(", ") + ".";
      document.querySelectorAll(".ts-uitslag").forEach((p) => { p.textContent = teks; p.hidden = false; });
      document.querySelectorAll(".ts-woorde").forEach((i) => { i.value = ""; });

      if (typeof pj_laai === "function") await pj_laai();
      if (typeof fk_laai === "function") await fk_laai();
      if (typeof window.bf_laai === "function") await window.bf_laai();
      if (typeof window.bo_laai === "function") await window.bo_laai();
      await Promise.all([tel_kliente(), tel_projekte()]);
      teken();
    } catch (fout) {
      window.alert(String(fout.message || fout));
      knop.disabled = false;
    }
  }

  document.addEventListener("bf-gelaai", (ev) => {
    STAAT.befondsers = (ev.detail || []).filter((b) => IS_TOETS.test(b.naam || "")).length;
    teken();
  });
  document.addEventListener("bo-gelaai", (ev) => {
    STAAT.soorte = (ev.detail || []).filter((s) => IS_TOETS.test(s.naam || "")).length;
    teken();
  });

  document.addEventListener("pj-gelaai", (ev) => {
    STAAT.projekte = (ev.detail || []).filter((p) => IS_TOETS.test(p.naam || "")).length;
    teken();
  });

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.getElementById("pj-lys")) return;
    let sessie = null;
    try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }
    if (!sessie || !identiteit_het_rol(sessie.gebruiker, "boekhouding")) return;

    bou_blok("fk-lys", "ts-blok-kliente");
    bou_blok("pj-lys", "ts-blok-projekte");
    bou_blok("bf-lys-befondser", "ts-blok-befondsers");
    bou_blok("bf-lys-skenker", "ts-blok-skenkers");
    bou_blok("bo-lys", "ts-blok-soorte");
    await tel_kliente();
    teken();
  });
})();
