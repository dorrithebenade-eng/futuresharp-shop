// public/js/faktuurpaneel-befondsers.js
//
// Die registers van BEFONDSERS en SKENKERS: twee oortjies, een stoor.
//
// Een module teken albei lyste uit dieselfde data; die oortjie bepaal net die
// filter en die rol van 'n nuwe rekord. Voorvoegsel `BF` / `bf_`.

(function () {
  "use strict";

  const BF = { almal: [], wysig: null, rol: "befondser" };

  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }
  function ontsnap(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  async function vra(naam, opsies) {
    const resp = await fetch("/.netlify/functions/" + naam, {
      ...(opsies || {}),
      headers: { ...((opsies && opsies.headers) || {}), ...(await identiteit_kop()) },
    });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    return resp.json();
  }

  const SOORT_WOORD = {
    maatskappy: () => t("bf_soort_maatskappy", "Maatskappy"),
    trust: () => t("bf_soort_trust", "Trust"),
    organisasie: () => t("bf_soort_organisasie", "Organisasie"),
    persoon: () => t("bf_soort_persoon", "Persoon"),
  };

  // Wat 'n 18A-sertifikaat later sal vra. Net 'n merkie; niks keer die stoor nie.
  function ontbreek(b) {
    const l = [];
    if (!b.registrasienommer) l.push(t("bf_v_reg_kort", "registrasie- of ID-nommer"));
    if (!b.belastingnommer) l.push(t("bf_v_belasting_kort", "belastingnommer"));
    if (!b.epos && !b.telefoon) l.push(t("bf_v_kontak_kort", "kontak"));
    if (!b.adres) l.push(t("bf_v_adres_kort", "adres"));
    return l;
  }

  function teken(rol) {
    const plek = document.getElementById("bf-lys-" + rol);
    if (!plek) return;
    const veld = document.getElementById("bf-soek-" + rol);
    const soek = (veld ? veld.value : "").trim().toLowerCase().replace(/\s+/g, "");
    const eie = BF.almal.filter((b) => b.rol === rol);
    const pas = eie.filter((b) => !soek || [b.naam, b.handelsnaam, b.kontakpersoon, b.nommer, b.nota]
      .filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, "").includes(soek));

    const hulp = document.getElementById("bf-hulp-" + rol);
    if (hulp) hulp.textContent = soek ? `${pas.length} ${t("bf_van", "van")} ${eie.length}` : String(eie.length);

    if (!eie.length) {
      plek.innerHTML = `<p class="stelsel-boodskap">${ontsnap(rol === "befondser"
        ? t("bf_leeg_befondser", "Die register is nog leeg. Voeg die eerste befondser by.")
        : t("bf_leeg_skenker", "Die register is nog leeg. Voeg die eerste skenker by."))}</p>`;
      return;
    }
    if (!pas.length) {
      plek.innerHTML = `<p class="stelsel-boodskap">${ontsnap(t("bf_geen_treffer", "Niks pas by die soektog nie."))}</p>`;
      return;
    }

    plek.innerHTML = pas.map((b) => {
      const ont = ontbreek(b);
      const merkies = [
        b.aktief === false ? `<span class="fk-merkie kt-onaktief">${ontsnap(t("bf_onaktief", "Onaktief"))}</span>` : "",
        b.toets ? `<span class="fk-merkie">${ontsnap(t("bf_toets", "Toets"))}</span>` : "",
      ].join("");
      const onder = [
        ontsnap(b.nommer),
        ontsnap((SOORT_WOORD[b.soort] || SOORT_WOORD.maatskappy)()),
        b.kontakpersoon ? ontsnap(b.kontakpersoon) : "",
      ].filter(Boolean).join(" · ");
      const rand = b.aktief === false
        ? `<button type="button" class="fp-skrap kt-aktiveer" data-bf-aktiveer="${ontsnap(b.nommer)}">${ontsnap(t("bf_aktiveer", "Aktiveer"))}</button>`
        : `<button type="button" class="fp-skrap" data-bf-skrap="${ontsnap(b.nommer)}">${ontsnap(t("bf_skrap", "Skrap"))}</button>`;
      return `
        <div class="fk-ry fk-ry-twee${b.aktief === false ? " kt-ry-onaktief" : ""}">
          <button type="button" class="fk-ry-oop" data-bf="${ontsnap(b.nommer)}">
            <span class="fk-ry-naam">${ontsnap(b.naam)}${merkies}</span>
            <span class="fk-ry-onder">${onder}</span>
            ${ont.length ? `<span class="fk-ry-onder bf-ontbreek">${ontsnap(t("bf_ontbreek", "Vir 'n sertifikaat ontbreek:"))} ${ontsnap(ont.join(", "))}</span>` : ""}
          </button>
          <span class="fk-ry-rand">${rand}</span>
        </div>`;
    }).join("");

    plek.querySelectorAll("[data-bf]").forEach((k) =>
      k.addEventListener("click", () => maak_oop(k.getAttribute("data-bf"))));
    plek.querySelectorAll("[data-bf-skrap]").forEach((k) =>
      k.addEventListener("click", () => skrap(k.getAttribute("data-bf-skrap"))));
    plek.querySelectorAll("[data-bf-aktiveer]").forEach((k) =>
      k.addEventListener("click", () => aktiveer(k.getAttribute("data-bf-aktiveer"))));
  }

  function teken_albei() {
    teken("befondser");
    teken("skenker");
    document.dispatchEvent(new CustomEvent("bf-gelaai", { detail: BF.almal }));
  }

  const VELDE = ["naam", "handelsnaam", "registrasienommer", "belastingnommer",
    "kontakpersoon", "epos", "telefoon", "adres", "nota"];

  function maak_oop(nommer, rol) {
    const b = nommer ? BF.almal.find((x) => x.nommer === nommer) : null;
    BF.wysig = b ? b.nommer : null;
    BF.rol = b ? b.rol : rol || "befondser";
    document.getElementById("bf-vorm-titel").textContent = b
      ? (BF.rol === "befondser" ? t("bf_wysig_befondser", "Wysig befondser") : t("bf_wysig_skenker", "Wysig skenker"))
      : (BF.rol === "befondser" ? t("bf_nuwe_befondser", "Nuwe befondser") : t("bf_nuwe_skenker", "Nuwe skenker"));
    VELDE.forEach((v) => { document.getElementById("bf-" + v).value = b ? b[v] || "" : ""; });
    document.getElementById("bf-soort").value = b ? b.soort || "maatskappy" : (BF.rol === "skenker" ? "persoon" : "maatskappy");
    document.getElementById("bf-vorm-fout").style.display = "none";
    document.getElementById("bf-vorm").classList.add("oop");
    document.getElementById("bf-naam").focus();
  }

  function maak_toe() {
    document.getElementById("bf-vorm").classList.remove("oop");
    BF.wysig = null;
  }

  async function stoor() {
    const fout = document.getElementById("bf-vorm-fout");
    const naam = document.getElementById("bf-naam").value.trim();
    if (!naam) {
      fout.textContent = t("bf_naam_kort", "Die naam is verpligtend.");
      fout.style.display = "";
      return;
    }
    const liggaam = { nommer: BF.wysig || undefined, rol: BF.rol, soort: document.getElementById("bf-soort").value };
    VELDE.forEach((v) => { liggaam[v] = document.getElementById("bf-" + v).value; });
    const knop = document.getElementById("bf-stoor");
    knop.disabled = true;
    try {
      const uit = await vra("stoor-befondser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(liggaam),
      });
      // Uit die antwoord in die lys: list() loop agter.
      const rek = uit.befondser;
      rek.toets = /^\s*TOETS\b/.test(rek.naam || "");
      BF.almal = BF.almal.filter((x) => x.nommer !== rek.nommer).concat([rek])
        .sort((a, b) => String(a.naam).localeCompare(String(b.naam), "af-ZA"));
      maak_toe();
      teken_albei();
    } catch (f) {
      fout.textContent = String(f.message || f);
      fout.style.display = "";
    } finally {
      knop.disabled = false;
    }
  }

  async function skrap(nommer) {
    const b = BF.almal.find((x) => x.nommer === nommer);
    if (!b || !window.confirm(t("bf_skrap_vra",
      "Vee dit uit? Word dit reeds deur 'n toekenning of skenking gebruik, word dit gedeaktiveer in plaas van uitgevee.") + "\n\n" + b.naam)) return;
    try {
      const uit = await vra("skrap-befondser", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nommer }),
      });
      if (uit.uitgevee) BF.almal = BF.almal.filter((x) => x.nommer !== nommer);
      else b.aktief = false;
      teken_albei();
    } catch (f) {
      window.alert(String(f.message || f));
    }
  }

  async function aktiveer(nommer) {
    try {
      await vra("aktiveer-befondser", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nommer }),
      });
      const b = BF.almal.find((x) => x.nommer === nommer);
      if (b) b.aktief = true;
      teken_albei();
    } catch (f) {
      window.alert(String(f.message || f));
    }
  }

  async function laai() {
    try {
      const data = await vra("kry-befondsers");
      BF.almal = Array.isArray(data.befondsers) ? data.befondsers : [];
    } catch (f) {
      console.error("Kon nie die befondsers laai nie:", f);
      ["befondser", "skenker"].forEach((rol) => {
        const plek = document.getElementById("bf-lys-" + rol);
        if (plek) plek.innerHTML = `<p class="stelsel-boodskap">${ontsnap(t("bf_laai_fout", "Kon nie die register laai nie."))}</p>`;
      });
      return;
    }
    teken_albei();
  }
  window.bf_laai = laai;

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.getElementById("bf-lys-befondser")) return;
    let sessie = null;
    try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }
    if (!sessie || !identiteit_het_rol(sessie.gebruiker, "boekhouding")) return;

    ["befondser", "skenker"].forEach((rol) => {
      document.getElementById("bf-nuut-" + rol).addEventListener("click", () => maak_oop(null, rol));
      document.getElementById("bf-soek-" + rol).addEventListener("input", () => teken(rol));
    });
    document.getElementById("bf-stoor").addEventListener("click", stoor);
    document.getElementById("bf-kanselleer").addEventListener("click", maak_toe);
    const oor = document.getElementById("bf-vorm");
    oor.addEventListener("click", (ev) => { if (ev.target === oor) maak_toe(); });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && oor.classList.contains("oop")) maak_toe();
    });
    await laai();
  });
})();
