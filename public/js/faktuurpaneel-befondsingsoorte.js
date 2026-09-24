// public/js/faktuurpaneel-befondsingsoorte.js
//
// Die register van befondsingsoorte, met die twee wysigbare lyste per soort:
// wat Future Sharp uitreik, en watter rekords gehou moet word. Voorvoegsel
// `BO` / `bo_`.
//
// DIE LYSTE WORD IN DIE VORM SELF GEWYSIG: elke item is 'n eie invoerveld met
// 'n x om dit te verwyder, en "+ Voeg by" sit 'n lee een onderaan. By die
// rekords merk 'n blokkie of 'n opgelaaide dokument vereis word. Die item se
// id reis saam, sodat 'n hernoemde item dieselfde item bly.

(function () {
  "use strict";

  const BO = { soorte: [], wysig: null };

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

  function teken() {
    const plek = document.getElementById("bo-lys");
    if (!plek) return;
    const veld = document.getElementById("bo-soek");
    const soek = (veld ? veld.value : "").trim().toLowerCase().replace(/\s+/g, "");
    const pas = BO.soorte.filter((s) => !soek || String(s.naam).toLowerCase().replace(/\s+/g, "").includes(soek));
    const hulp = document.getElementById("bo-hulp");
    if (hulp) hulp.textContent = soek ? `${pas.length} ${t("bso_van", "van")} ${BO.soorte.length}` : String(BO.soorte.length);

    if (!pas.length) {
      plek.innerHTML = `<p class="stelsel-boodskap">${ontsnap(BO.soorte.length
        ? t("bso_geen_treffer", "Geen soort pas by die soektog nie.")
        : t("bso_leeg", "Die register is nog leeg. Voeg die eerste soort by."))}</p>`;
      return;
    }

    plek.innerHTML = pas.map((s) => {
      const merkies = [
        s.aktief === false ? `<span class="fk-merkie kt-onaktief">${ontsnap(t("bso_onaktief", "Onaktief"))}</span>` : "",
        s.vereis_18a ? `<span class="fk-merkie kt-hosting">${ontsnap(t("bso_vereis_18a_kort", "Vereis 18A"))}</span>` : "",
        s.toets ? `<span class="fk-merkie">${ontsnap(t("bso_toets", "Toets"))}</span>` : "",
      ].join("");
      const onder = t("bso_tel", "{u} om uit te reik · {r} rekords")
        .replace("{u}", (s.uitreik || []).length).replace("{r}", (s.rekords || []).length);
      const rand = s.aktief === false
        ? `<button type="button" class="fp-skrap kt-aktiveer" data-bo-aktiveer="${ontsnap(s.id)}">${ontsnap(t("bso_aktiveer", "Aktiveer"))}</button>`
        : `<button type="button" class="fp-skrap" data-bo-skrap="${ontsnap(s.id)}">${ontsnap(t("bso_skrap", "Skrap"))}</button>`;
      return `
        <div class="fk-ry fk-ry-twee${s.aktief === false ? " kt-ry-onaktief" : ""}">
          <button type="button" class="fk-ry-oop" data-bo="${ontsnap(s.id)}">
            <span class="fk-ry-naam">${ontsnap(s.naam)}${merkies}</span>
            <span class="fk-ry-onder">${ontsnap(onder)}</span>
          </button>
          <span class="fk-ry-rand">${rand}</span>
        </div>`;
    }).join("");

    plek.querySelectorAll("[data-bo]").forEach((k) => k.addEventListener("click", () => maak_oop(k.getAttribute("data-bo"))));
    plek.querySelectorAll("[data-bo-skrap]").forEach((k) => k.addEventListener("click", () => skrap(k.getAttribute("data-bo-skrap"))));
    plek.querySelectorAll("[data-bo-aktiveer]").forEach((k) => k.addEventListener("click", () => aktiveer(k.getAttribute("data-bo-aktiveer"))));
    document.dispatchEvent(new CustomEvent("bo-gelaai", { detail: BO.soorte }));
  }

  /* ═══ die wysigbare lyste ═══ */

  function item_ry(lys, item) {
    const ry = document.createElement("div");
    ry.className = "bo-item";
    ry.dataset.id = item.id || "";
    ry.innerHTML =
      `<input type="text" class="veld-invoer bo-item-naam" maxlength="160" value="${ontsnap(item.naam || "")}"
              placeholder="${ontsnap(t("bso_item_plek", "Beskryf die item"))}">` +
      (lys === "rekords"
        ? `<label class="wi-merk bo-dok"><input type="checkbox"${item.dokument ? " checked" : ""}>
             <span>${ontsnap(t("bso_dokument", "Dokument"))}</span></label>`
        : "") +
      `<button type="button" class="bo-item-weg" aria-label="${ontsnap(t("bso_verwyder", "Verwyder"))}">&#215;</button>`;
    ry.querySelector(".bo-item-weg").addEventListener("click", () => ry.remove());
    return ry;
  }

  function vul_lys(lys, items) {
    const plek = document.getElementById("bo-" + lys);
    plek.innerHTML = "";
    (items || []).forEach((it) => plek.appendChild(item_ry(lys, it)));
  }

  function lees_lys(lys) {
    return [...document.querySelectorAll(`#bo-${lys} .bo-item`)].map((ry) => {
      const item = { id: ry.dataset.id || "", naam: ry.querySelector(".bo-item-naam").value.trim() };
      const dok = ry.querySelector(".bo-dok input");
      if (dok) item.dokument = dok.checked;
      return item;
    }).filter((it) => it.naam);
  }

  /* ═══ die vorm ═══ */

  function maak_oop(id) {
    const s = id ? BO.soorte.find((x) => x.id === id) : null;
    BO.wysig = s ? s.id : null;
    document.getElementById("bo-vorm-titel").textContent = s
      ? t("bso_wysig_titel", "Wysig befondsingsoort") : t("bso_nuwe_titel", "Nuwe befondsingsoort");
    document.getElementById("bo-naam").value = s ? s.naam : "";
    document.getElementById("bo-18a").checked = Boolean(s && s.vereis_18a);
    document.getElementById("bo-nota").value = s ? s.nota || "" : "";
    vul_lys("uitreik", s ? s.uitreik : []);
    vul_lys("rekords", s ? s.rekords : []);
    document.getElementById("bo-vorm-fout").style.display = "none";
    document.getElementById("bo-vorm").classList.add("oop");
    document.getElementById("bo-naam").focus();
  }

  function maak_toe() {
    document.getElementById("bo-vorm").classList.remove("oop");
    BO.wysig = null;
  }

  async function stoor() {
    const fout = document.getElementById("bo-vorm-fout");
    const naam = document.getElementById("bo-naam").value.trim();
    if (!naam) {
      fout.textContent = t("bso_naam_kort", "Die naam is verpligtend.");
      fout.style.display = "";
      return;
    }
    const knop = document.getElementById("bo-stoor");
    knop.disabled = true;
    try {
      const uit = await vra("stoor-befondsingsoort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: BO.wysig || undefined,
          naam,
          vereis_18a: document.getElementById("bo-18a").checked,
          uitreik: lees_lys("uitreik"),
          rekords: lees_lys("rekords"),
          nota: document.getElementById("bo-nota").value,
        }),
      });
      const rek = uit.soort;
      rek.toets = /^\s*TOETS\b/.test(rek.naam || "");
      BO.soorte = BO.soorte.filter((x) => x.id !== rek.id).concat([rek])
        .sort((a, b) => String(a.naam).localeCompare(String(b.naam), "af-ZA"));
      maak_toe();
      teken();
    } catch (f) {
      fout.textContent = String(f.message || f);
      fout.style.display = "";
    } finally {
      knop.disabled = false;
    }
  }

  async function skrap(id) {
    const s = BO.soorte.find((x) => x.id === id);
    if (!s || !window.confirm(t("bso_skrap_vra",
      "Vee hierdie soort uit? Word dit reeds deur 'n toekenning gebruik, word dit gedeaktiveer in plaas van uitgevee.") + "\n\n" + s.naam)) return;
    try {
      const uit = await vra("skrap-befondsingsoort", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      if (uit.uitgevee) BO.soorte = BO.soorte.filter((x) => x.id !== id);
      else s.aktief = false;
      teken();
    } catch (f) {
      window.alert(String(f.message || f));
    }
  }

  async function aktiveer(id) {
    try {
      await vra("aktiveer-befondsingsoort", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const s = BO.soorte.find((x) => x.id === id);
      if (s) s.aktief = true;
      teken();
    } catch (f) {
      window.alert(String(f.message || f));
    }
  }

  async function laai() {
    try {
      const data = await vra("kry-befondsingsoorte");
      BO.soorte = Array.isArray(data.soorte) ? data.soorte : [];
      teken();
    } catch (f) {
      console.error("Kon nie die befondsingsoorte laai nie:", f);
      const plek = document.getElementById("bo-lys");
      if (plek) plek.innerHTML = `<p class="stelsel-boodskap">${ontsnap(t("bso_laai_fout", "Kon nie die befondsingsoorte laai nie."))}</p>`;
    }
  }
  window.bo_laai = laai;

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.getElementById("bo-lys")) return;
    let sessie = null;
    try { sessie = await identiteit_kry_huidige_sessie(); } catch { sessie = null; }
    if (!sessie || !identiteit_het_rol(sessie.gebruiker, "boekhouding")) return;

    document.getElementById("bo-nuut").addEventListener("click", () => maak_oop(null));
    document.getElementById("bo-soek").addEventListener("input", teken);
    document.getElementById("bo-stoor").addEventListener("click", stoor);
    document.getElementById("bo-kanselleer").addEventListener("click", maak_toe);
    ["uitreik", "rekords"].forEach((lys) =>
      document.getElementById("bo-voeg-" + lys).addEventListener("click", () => {
        const ry = item_ry(lys, { id: "", naam: "", dokument: false });
        document.getElementById("bo-" + lys).appendChild(ry);
        ry.querySelector(".bo-item-naam").focus();
      }));
    const oor = document.getElementById("bo-vorm");
    oor.addEventListener("click", (ev) => { if (ev.target === oor) maak_toe(); });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && oor.classList.contains("oop")) maak_toe();
    });
    await laai();
  });
})();
