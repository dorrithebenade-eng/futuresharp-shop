// public/js/faktuurpaneel-toekennings.js
// Weergawe 2 (25 September 2026): bewysstukke by elke item (oplaai, aflaai,
// verwyder), en die aanbod wanneer die soort nuwe items gekry het.
//
// Die toekennings van een projek, in 'n eie venster wat uit die projektelys
// oopgemaak word (window.tk_maak_oop). Voorvoegsel `TK` / `tk_`.
//
// ELKE TOEKENNING WYS SY KONTROLELYS: wat Future Sharp moet uitreik en watter
// rekords gehou moet word, gekopieer uit die befondsingsoort by die skep. 'n
// Item word met 'n blokkie afgemerk; die datum en wie word aangeteken. Eie
// items kan per toekenning bygevoeg en weer verwyder word; die soort se items
// bly, want hulle is die afspraak met die befondser.
//
// BEWYSSTUKKE (fase C). Elke item kan leers dra: PDF, foto, Word of Excel, tot
// 4 MB elk. 'n Item met die merk "Dokument" wys "Dokument ontbreek" tot daar een
// is. Oplaai merk die item nie outomaties af nie. Aflaai gaan deur die joernaal
// se jn_stuur_af(), soos die werkboeke.

(function () {
  "use strict";

  const TK = { projek: null, lys: [], befondsers: [], soorte: [], oop: new Set(), wysig: null };

  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }
  function ontsnap(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function rand(sent) {
    const n = Math.round(Math.abs(Number(sent) || 0));
    const heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    return "R" + heel + "," + String(n % 100).padStart(2, "0");
  }
  function datum(iso) {
    return String(iso || "").replace(/-/g, "/");
  }
  async function vra(naam, opsies) {
    const resp = await fetch("/.netlify/functions/" + naam, {
      ...(opsies || {}),
      headers: { ...((opsies && opsies.headers) || {}), ...(await identiteit_kop()) },
    });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    return resp.json();
  }
  function pos(naam, liggaam) {
    return vra(naam, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(liggaam) });
  }

  /* ═══ die lys ═══ */

  const AANVAAR = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";

  function item_ry(tk, i) {
    const doks = i.dokumente || [];
    const dok_lys = doks.map((d) => `<span class="tk-dok">
        <button type="button" class="tk-dok-naam" data-tk-dok="${ontsnap(tk.id)}" data-item="${ontsnap(i.id)}" data-sleutel="${ontsnap(d.sleutel)}" title="${ontsnap(t("tk_dok_af", "Laai af"))}">${ontsnap(d.naam)}</button>
        <button type="button" class="tk-dok-weg" data-tk-dok-weg="${ontsnap(tk.id)}" data-item="${ontsnap(i.id)}" data-sleutel="${ontsnap(d.sleutel)}" aria-label="${ontsnap(t("tk_verwyder", "Verwyder"))}">&#215;</button>
      </span>`).join("");
    return `<li class="tk-item${i.klaar ? " klaar" : ""}">
      <div class="tk-item-bo">
      <label class="tk-merk"><input type="checkbox" data-tk-merk="${ontsnap(tk.id)}" data-item="${ontsnap(i.id)}"${i.klaar ? " checked" : ""}>
        <span>${ontsnap(i.naam)}</span></label>
      <span class="tk-item-rand">
        ${i.dokument && !doks.length ? `<span class="bs-stand leeg">${ontsnap(t("tk_dok_ontbreek", "Dokument ontbreek"))}</span>` : ""}
        <label class="tk-laai">${ontsnap(t("tk_laai_op", "Laai op"))}<input type="file" hidden accept="${AANVAAR}" data-tk-laai="${ontsnap(tk.id)}" data-item="${ontsnap(i.id)}"></label>
        ${i.klaar ? `<span class="tk-datum">${datum(i.datum)}</span>` : ""}
        ${i.eie ? `<button type="button" class="bs-ontdoen" data-tk-weg="${ontsnap(tk.id)}" data-item="${ontsnap(i.id)}">${ontsnap(t("tk_verwyder", "Verwyder"))}</button>` : ""}
      </span>
      </div>
      ${doks.length ? `<div class="tk-doks">${dok_lys}</div>` : ""}
    </li>`;
  }

  function teken() {
    const plek = document.getElementById("tk-lys");
    if (!plek) return;
    if (!TK.lys.length) {
      plek.innerHTML = `<p class="stelsel-boodskap">${ontsnap(t("tk_leeg", "Hierdie projek het nog geen toekenning nie."))}</p>`;
      return;
    }
    plek.innerHTML = TK.lys.map((tk) => {
      const oop = TK.oop.has(tk.id);
      const items = tk.kontrolelys || [];
      const klaar = items.filter((i) => i.klaar).length;
      const tydperk = tk.van || tk.tot ? `${datum(tk.van) || "\u2026"} ${t("tk_tot", "tot")} ${datum(tk.tot) || "\u2026"}` : "";
      return `<div class="tk-kaart">
        <button type="button" class="tk-kop" data-tk-oop="${ontsnap(tk.id)}" aria-expanded="${oop}">
          <span class="tk-kop-links">
            <b>${ontsnap(tk.befondser_naam || tk.befondser)}${tk.befondser_weg ? ` (${ontsnap(t("tk_weg", "bestaan nie meer"))})` : ""}</b>
            <span class="tk-sub">${[ontsnap(tk.soort_naam), tydperk, tk.voorwaardes ? ontsnap(t("tk_met_voorwaardes", "met voorwaardes")) : ""].filter(Boolean).join(" \u00b7 ")}</span>
          </span>
          <span class="tk-kop-regs">
            <b>${rand(tk.bedrag_sent)}</b>
            <span class="bs-stand ${klaar === items.length && items.length ? "voorstel" : "oop"}">${
              ontsnap(t("tk_afgehandel", "{k} van {n} afgehandel").replace("{k}", klaar).replace("{n}", items.length))}</span>
          </span>
        </button>
        ${oop ? `<div class="tk-lyf">
          ${tk.nota ? `<p class="tk-nota">${ontsnap(tk.nota)}</p>` : ""}
          ${(tk.nuwe_items || []).length ? `<p class="tk-aanbod">${ontsnap(t("tk_aanbod",
            "Die soort het sedert die skep {n} nuwe item(s) gekry: {l}.").replace("{n}", tk.nuwe_items.length).replace("{l}", tk.nuwe_items.join(", ")))}
            <button type="button" class="bs-bevestig" data-tk-neem="${ontsnap(tk.id)}">${ontsnap(t("tk_neem_oor", "Voeg by"))}</button></p>` : ""}
          <p class="tk-lyskop">${ontsnap(t("tk_uitreik", "Wat Future Sharp uitreik"))}</p>
          <ul class="tk-items">${items.filter((i) => i.lys === "uitreik").map((i) => item_ry(tk, i)).join("") ||
            `<li class="tk-leeg">${ontsnap(t("tk_niks", "Niks nie"))}</li>`}</ul>
          <p class="tk-lyskop">${ontsnap(t("tk_rekords", "Rekords wat gehou moet word"))}</p>
          <ul class="tk-items">${items.filter((i) => i.lys === "rekords").map((i) => item_ry(tk, i)).join("") ||
            `<li class="tk-leeg">${ontsnap(t("tk_niks", "Niks nie"))}</li>`}</ul>
          <div class="tk-eie">
            <input type="text" class="veld-invoer" maxlength="160" data-tk-eie-naam="${ontsnap(tk.id)}"
                   placeholder="${ontsnap(t("tk_eie_plek", "Item net vir hierdie toekenning"))}">
            <select class="veld-invoer" data-tk-eie-lys="${ontsnap(tk.id)}">
              <option value="rekords">${ontsnap(t("tk_eie_rekord", "Rekord"))}</option>
              <option value="uitreik">${ontsnap(t("tk_eie_uitreik", "Uitreik"))}</option>
            </select>
            <button type="button" class="bs-bevestig" data-tk-eie="${ontsnap(tk.id)}">${ontsnap(t("tk_voeg_by", "Voeg by"))}</button>
          </div>
          <div class="tk-knoppe">
            <button type="button" class="bs-ontdoen" data-tk-wysig="${ontsnap(tk.id)}">${ontsnap(t("tk_wysig", "Wysig bedrag en tydperk"))}</button>
            <button type="button" class="fp-skrap" data-tk-skrap="${ontsnap(tk.id)}">${ontsnap(t("tk_skrap", "Skrap toekenning"))}</button>
          </div>
        </div>` : ""}
      </div>`;
    }).join("");

    plek.querySelectorAll("[data-tk-oop]").forEach((k) => k.addEventListener("click", () => {
      const id = k.getAttribute("data-tk-oop");
      if (TK.oop.has(id)) TK.oop.delete(id); else TK.oop.add(id);
      teken();
    }));
    plek.querySelectorAll("[data-tk-merk]").forEach((k) => k.addEventListener("change", () =>
      wysig({ aksie: "merk", id: k.getAttribute("data-tk-merk"), item: k.getAttribute("data-item"), klaar: k.checked })));
    plek.querySelectorAll("[data-tk-weg]").forEach((k) => k.addEventListener("click", () =>
      wysig({ aksie: "verwyder", id: k.getAttribute("data-tk-weg"), item: k.getAttribute("data-item") })));
    plek.querySelectorAll("[data-tk-eie]").forEach((k) => k.addEventListener("click", () => {
      const id = k.getAttribute("data-tk-eie");
      const naam = plek.querySelector(`[data-tk-eie-naam="${id}"]`).value.trim();
      const lys = plek.querySelector(`[data-tk-eie-lys="${id}"]`).value;
      if (naam) wysig({ aksie: "voeg_by", id, naam, lys, dokument: false });
    }));
    plek.querySelectorAll("[data-tk-neem]").forEach((k) => k.addEventListener("click", async () => {
      await wysig({ aksie: "neem_oor", id: k.getAttribute("data-tk-neem") });
      await laai();
    }));
    plek.querySelectorAll("[data-tk-laai]").forEach((k) => k.addEventListener("change", () =>
      laai_op(k.getAttribute("data-tk-laai"), k.getAttribute("data-item"), k.files && k.files[0], k)));
    plek.querySelectorAll("[data-tk-dok]").forEach((k) => k.addEventListener("click", () =>
      laai_af(k.getAttribute("data-sleutel"), k.textContent.trim())));
    plek.querySelectorAll("[data-tk-dok-weg]").forEach((k) => k.addEventListener("click", () =>
      skrap_dok(k.getAttribute("data-tk-dok-weg"), k.getAttribute("data-item"), k.getAttribute("data-sleutel"))));
    plek.querySelectorAll("[data-tk-wysig]").forEach((k) => k.addEventListener("click", () =>
      maak_vorm_oop(TK.lys.find((x) => x.id === k.getAttribute("data-tk-wysig")))));
    plek.querySelectorAll("[data-tk-skrap]").forEach((k) => k.addEventListener("click", () =>
      skrap(k.getAttribute("data-tk-skrap"))));
  }

  async function wysig(liggaam) {
    try {
      const uit = await pos("wysig-kontrolelys", liggaam);
      const i = TK.lys.findIndex((x) => x.id === uit.toekenning.id);
      if (i >= 0) TK.lys[i] = { ...TK.lys[i], ...uit.toekenning };
    } catch (f) {
      window.alert(String(f.message || f));
    }
    teken();
  }

  /* ═══ bewysstukke ═══ */

  function vervang(tk) {
    const i = TK.lys.findIndex((x) => x.id === tk.id);
    if (i >= 0) TK.lys[i] = { ...TK.lys[i], ...tk };
  }

  function lees_base64(leer) {
    return new Promise((ja, nee) => {
      const r = new FileReader();
      r.onload = () => ja(String(r.result).split(",")[1] || "");
      r.onerror = () => nee(new Error(t("tk_dok_lees", "Kon nie die lêer lees nie.")));
      r.readAsDataURL(leer);
    });
  }

  async function laai_op(tk_id, item_id, leer, invoer) {
    if (!leer) return;
    if (leer.size > 4 * 1024 * 1024) {
      window.alert(t("tk_dok_groot", "Die lêer is groter as 4 MB. Maak dit eers kleiner."));
      invoer.value = "";
      return;
    }
    const etiket = invoer.closest(".tk-laai");
    if (etiket) etiket.classList.add("besig");
    try {
      const uit = await pos("laai-bewys-op", {
        toekenning: tk_id, item: item_id, leernaam: leer.name,
        inhoud_tipe: leer.type, data_base64: await lees_base64(leer),
      });
      vervang(uit.toekenning);
    } catch (f) {
      window.alert(String(f.message || f));
    }
    teken();
  }

  async function laai_af(sleutel, naam) {
    try {
      const resp = await fetch("/.netlify/functions/kry-bewys?sleutel=" + encodeURIComponent(sleutel),
        { headers: await identiteit_kop() });
      if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
      jn_stuur_af(await resp.blob(), naam);
    } catch (f) {
      window.alert(String(f.message || f));
    }
  }

  async function skrap_dok(tk_id, item_id, sleutel) {
    if (!window.confirm(t("tk_dok_skrap_vra", "Vee hierdie bewysstuk uit?"))) return;
    try {
      const uit = await pos("skrap-bewys", { toekenning: tk_id, item: item_id, sleutel });
      vervang(uit.toekenning);
    } catch (f) {
      window.alert(String(f.message || f));
    }
    teken();
  }

  async function skrap(id) {
    if (!window.confirm(t("tk_skrap_vra", "Vee hierdie toekenning en sy kontrolelys uit?"))) return;
    try {
      await pos("skrap-toekenning", { id });
      TK.lys = TK.lys.filter((x) => x.id !== id);
      teken();
      if (typeof window.pj_herlaai === "function") window.pj_herlaai();
    } catch (f) {
      window.alert(String(f.message || f));
    }
  }

  /* ═══ die vorm vir 'n nuwe toekenning, of die wysiging van een ═══ */

  function maak_vorm_oop(tk) {
    TK.wysig = tk ? tk.id : null;
    const v = document.getElementById("tk-vorm");
    v.hidden = false;
    document.getElementById("tk-nuut").hidden = true;

    const bf = document.getElementById("tk-befondser");
    const so = document.getElementById("tk-soort");
    bf.disabled = so.disabled = Boolean(tk);
    bf.innerHTML = `<option value="">${ontsnap(t("tk_kies_bf", "Kies 'n befondser"))}</option>` +
      TK.befondsers.filter((b) => b.rol === "befondser" && (b.aktief !== false || (tk && b.nommer === tk.befondser)))
        .map((b) => `<option value="${ontsnap(b.nommer)}"${tk && tk.befondser === b.nommer ? " selected" : ""}>${ontsnap(b.nommer)} \u00b7 ${ontsnap(b.naam)}</option>`).join("");
    so.innerHTML = `<option value="">${ontsnap(t("tk_kies_soort", "Kies die soort befondsing"))}</option>` +
      TK.soorte.filter((s) => s.aktief !== false || (tk && s.id === tk.soort))
        .map((s) => `<option value="${ontsnap(s.id)}"${tk && tk.soort === s.id ? " selected" : ""}${s.vereis_18a && !tk ? " disabled" : ""}>${
          ontsnap(s.naam)}${s.vereis_18a ? " (" + ontsnap(t("tk_vereis_18a", "vereis 18A-goedkeuring")) + ")" : ""}</option>`).join("");
    document.getElementById("tk-bedrag").value = tk ? (tk.bedrag_sent / 100).toFixed(2).replace(".", ",") : "";
    document.getElementById("tk-van").value = tk ? tk.van || "" : "";
    document.getElementById("tk-tot").value = tk ? tk.tot || "" : "";
    document.getElementById("tk-voorwaardes").checked = Boolean(tk && tk.voorwaardes);
    document.getElementById("tk-nota").value = tk ? tk.nota || "" : "";
    document.getElementById("tk-fout").style.display = "none";
    document.getElementById("tk-stoor").textContent = tk ? t("tk_stoor", "Stoor") : t("tk_skep", "Skep toekenning");
    (tk ? document.getElementById("tk-bedrag") : bf).focus();
  }

  function maak_vorm_toe() {
    document.getElementById("tk-vorm").hidden = true;
    document.getElementById("tk-nuut").hidden = false;
    TK.wysig = null;
  }

  async function stoor() {
    const fout = document.getElementById("tk-fout");
    const liggaam = {
      id: TK.wysig || undefined,
      projek_id: TK.projek.id,
      befondser: document.getElementById("tk-befondser").value,
      soort: document.getElementById("tk-soort").value,
      bedrag: document.getElementById("tk-bedrag").value,
      van: document.getElementById("tk-van").value,
      tot: document.getElementById("tk-tot").value,
      voorwaardes: document.getElementById("tk-voorwaardes").checked,
      nota: document.getElementById("tk-nota").value,
    };
    const knop = document.getElementById("tk-stoor");
    knop.disabled = true;
    try {
      const uit = await pos("stoor-toekenning", liggaam);
      maak_vorm_toe();
      TK.oop.add(uit.toekenning.id);
      await laai();
      if (typeof window.pj_herlaai === "function") window.pj_herlaai();
    } catch (f) {
      fout.textContent = String(f.message || f);
      fout.style.display = "";
    } finally {
      knop.disabled = false;
    }
  }

  /* ═══ oop en toe ═══ */

  async function laai() {
    const plek = document.getElementById("tk-lys");
    try {
      const data = await vra("kry-toekennings?projek=" + encodeURIComponent(TK.projek.id));
      TK.lys = Array.isArray(data.toekennings) ? data.toekennings : [];
    } catch (f) {
      plek.innerHTML = `<p class="bs-foutboodskap">${ontsnap(t("tk_laai_fout", "Kon nie die toekennings laai nie."))}</p>`;
      return;
    }
    teken();
  }

  async function maak_oop(projek) {
    TK.projek = projek;
    TK.oop = new Set();
    document.getElementById("tk-titel").textContent =
      t("tk_titel", "Toekennings") + ": " + projek.naam;
    document.getElementById("tk-lys").innerHTML =
      `<p class="stelsel-boodskap">${ontsnap(t("fp_laai", "Word gelaai \u2026"))}</p>`;
    maak_vorm_toe();
    document.getElementById("tk-venster").classList.add("oop");

    const [_, bf, so] = await Promise.all([
      laai(),
      vra("kry-befondsers").catch(() => ({ befondsers: [] })),
      vra("kry-befondsingsoorte").catch(() => ({ soorte: [] })),
    ]);
    TK.befondsers = bf.befondsers || [];
    TK.soorte = so.soorte || [];
    if (!TK.lys.length && TK.befondsers.some((b) => b.rol === "befondser")) maak_vorm_oop(null);
  }

  function maak_toe() {
    document.getElementById("tk-venster").classList.remove("oop");
    TK.projek = null;
  }

  window.tk_maak_oop = maak_oop;

  document.addEventListener("DOMContentLoaded", () => {
    const venster = document.getElementById("tk-venster");
    if (!venster) return;
    document.getElementById("tk-nuut").addEventListener("click", () => maak_vorm_oop(null));
    document.getElementById("tk-kanselleer").addEventListener("click", maak_vorm_toe);
    document.getElementById("tk-stoor").addEventListener("click", stoor);
    document.getElementById("tk-toe").addEventListener("click", maak_toe);
    venster.addEventListener("click", (ev) => { if (ev.target === venster) maak_toe(); });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && venster.classList.contains("oop")) maak_toe();
    });
  });
})();
