// paneel-afdelings.js — "Rye op die Boeke-bladsy" (November 2026).
//
// Personeel stel hier self in hoe die Boeke-bladsy lyk:
//   - die volgorde van die rye (▲ ▼),
//   - elke ry se opskrif en kort beskrywing in albei tale,
//   - watter boeke in watter ry staan ("Skuif na …"),
//   - die volgorde van die boeke in 'n ry (◀ ▶).
//
// 'n Afrikaanse en Engelse uitgawe van een boek (eweknieë) is hier EEN
// kaartjie: wat jy met die een doen, geld vir albei.
//
// Die begintoestand is presies wat die winkel nou wys (bk_bou_rye uit
// boekkaart.js), sodat niks verander voordat iemand iets skuif nie.
// "Stoor" stuur die hele uitleg na stoor-afdelings.js.
//
// kry_outorisasie_kop() kom van paneelbord.js; bk_* van boekkaart.js.

(function () {
  const AFDELING = "afdelings";
  let RYE = [];     // [{ kode, naam_af, naam_en, beskrywing_af, beskrywing_en, werke: [produk] }]
  let ANDER = [];   // [produk] — boeke in geen ry nie
  let PER_SLUG = new Map();
  // Tuisblad-merkies: slug van die werk -> waar/onwaar, en hoe dit was toe
  // die bladsy gelaai het (net veranderinge word gestoor).
  let TUIS = new Map();
  let TUIS_BEGIN = new Map();
  let BAND = { links: "", middel: "", regs: "", nuut_op_rak: false };
  let WERKE = [];

  function is_op_tuisblad(w) {
    const e = w.eweknie_slug && PER_SLUG.get(w.eweknie_slug);
    return w.op_tuisblad === true || !!(e && e.taal !== w.taal && e.op_tuisblad === true);
  }

  const esc = (w) => String(w == null ? "" : w)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  async function kry_produkte() {
    // produkte_kas is 'n top-vlak "let" in paneelbord.js: sigbaar vir ander
    // skripte, maar nie as window.produkte_kas nie.
    if (typeof produkte_kas !== "undefined" && Array.isArray(produkte_kas) && produkte_kas.length) return produkte_kas;
    try {
      const r = await fetch("/.netlify/functions/kry-alle-produkte", { headers: kry_outorisasie_kop() });
      if (!r.ok) return [];
      const d = await r.json();
      return d.produkte || d || [];
    } catch {
      return [];
    }
  }

  // Een kaartjie per werk: die Afrikaanse uitgawe as daar een is.
  function werke_uit(produkte) {
    const per_slug = new Map(produkte.map((p) => [p.slug, p]));
    const gesien = new Set();
    const werke = [];
    for (const p of produkte) {
      if (gesien.has(p.slug)) continue;
      gesien.add(p.slug);
      const e = p.eweknie_slug && per_slug.get(p.eweknie_slug);
      if (e && e.taal !== p.taal) {
        gesien.add(e.slug);
        werke.push(p.taal === "af" ? p : (e.taal === "af" ? e : p));
      } else {
        werke.push(p);
      }
    }
    return werke;
  }

  function engelse_naam(werk) {
    const e = werk && werk.eweknie_slug && PER_SLUG.get(werk.eweknie_slug);
    const titel = e && e.taal === "en" ? e.titel : (werk && werk.taal === "en" ? werk.titel : "");
    const pas = String(titel || "").match(/^([^:]{2,40}):\s+/);
    return pas ? pas[1].trim() : "";
  }

  function afr_naam(werk) {
    const pas = String((werk && werk.titel) || "").match(/^([^:]{2,40}):\s+/);
    return pas ? pas[1].trim() : "";
  }

  function kort(p) {
    return typeof bk_kort_titel === "function" ? bk_kort_titel(p) : p.titel;
  }

  // --- Teken -----------------------------------------------------------------

  function skuif_keuse(slug, huidige) {
    const opsies = RYE.map((r, i) => `<option value="${i}"${i === huidige ? " selected" : ""}>${esc(r.naam_af || r.kode || "Ry " + (i + 1))}</option>`).join("");
    return `<select class="veld-invoer ra-skuif" data-slug="${esc(slug)}" data-huidig="${huidige}" style="font-size:12px;padding:4px 6px;margin-top:6px;">
      <option value="" disabled>Skuif na …</option>${opsies}
      <option value="ander"${huidige === "ander" ? " selected" : ""}>Ander boeke</option></select>`;
  }

  function boek_html(w, ry_i, boek_i, aantal) {
    const omslag = w.omslag ? `<img src="${esc(w.omslag)}" alt="" style="height:96px;max-width:72px;object-fit:contain;border-radius:3px;box-shadow:0 3px 8px rgba(0,0,0,.15);">`
      : `<span style="display:block;width:68px;height:96px;background:#E2DCCF;border-radius:3px;"></span>`;
    const pyle = ry_i === "ander" ? "" : `
      <div style="display:flex;gap:4px;justify-content:center;margin-top:6px;">
        <button type="button" class="terug-skakel ra-links" data-ry="${ry_i}" data-boek="${boek_i}" ${boek_i === 0 ? "disabled" : ""} title="Skuif links">◀</button>
        <button type="button" class="terug-skakel ra-regs" data-ry="${ry_i}" data-boek="${boek_i}" ${boek_i === aantal - 1 ? "disabled" : ""} title="Skuif regs">▶</button>
      </div>`;
    return `<div style="width:120px;text-align:center;background:#F7F4EE;border-radius:8px;padding:10px 6px;">
      ${omslag}
      <p style="font-size:12px;line-height:1.3;margin:6px 0 0;min-height:31px;">${esc(kort(w))}</p>
      ${pyle}
      ${skuif_keuse(w.slug, ry_i)}
      <label style="display:flex;gap:5px;align-items:center;justify-content:center;font-size:12px;margin-top:8px;cursor:pointer;${TUIS.get(w.slug) ? "color:#B7791F;font-weight:600;" : ""}">
        <input type="checkbox" class="ra-tuis" data-slug="${esc(w.slug)}" ${TUIS.get(w.slug) ? "checked" : ""}> ★ Op die tuisblad
      </label>
    </div>`;
  }

  function teken() {
    const wrap = document.getElementById("paneel-afdelings-lys");
    const rye_html = RYE.map((r, i) => `
      <div class="ra-ry" style="border:1px solid #E5E0D6;border-radius:12px;padding:16px 18px;margin-bottom:16px;background:#fff;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <b style="font-size:15px;">Ry ${i + 1}</b>
          <button type="button" class="terug-skakel ra-op" data-ry="${i}" ${i === 0 ? "disabled" : ""} title="Skuif die ry op">▲ Op</button>
          <button type="button" class="terug-skakel ra-af" data-ry="${i}" ${i === RYE.length - 1 ? "disabled" : ""} title="Skuif die ry af">▼ Af</button>
          <span style="flex:1"></span>
          <button type="button" class="terug-skakel paneel-skrap-knoppie ra-verwyder" data-ry="${i}">Verwyder ry</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px 14px;margin-top:12px;">
          <label class="veld-etiket">Opskrif (Afrikaans)<input type="text" class="veld-invoer ra-veld" data-ry="${i}" data-veld="naam_af" value="${esc(r.naam_af)}"></label>
          <label class="veld-etiket">Opskrif (Engels)<input type="text" class="veld-invoer ra-veld" data-ry="${i}" data-veld="naam_en" value="${esc(r.naam_en)}"></label>
          <label class="veld-etiket">Kort sin onder die opskrif (Afrikaans, opsioneel)<input type="text" class="veld-invoer ra-veld" data-ry="${i}" data-veld="beskrywing_af" value="${esc(r.beskrywing_af)}"></label>
          <label class="veld-etiket">Kort sin (Engels, opsioneel)<input type="text" class="veld-invoer ra-veld" data-ry="${i}" data-veld="beskrywing_en" value="${esc(r.beskrywing_en)}"></label>
        </div>
        <p class="paneel-hulp-teks ra-voorskou" data-ry="${i}" style="margin:10px 0 0;">Op die winkel: <b>${esc(r.naam_af || "(geen opskrif)")}</b>${r.beskrywing_af ? " · " + esc(r.beskrywing_af) : ""}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
          ${r.werke.length ? r.werke.map((w, j) => boek_html(w, i, j, r.werke.length)).join("") : `<p class="paneel-hulp-teks">Nog geen boeke in hierdie ry nie. Skuif boeke hierheen met "Skuif na …".</p>`}
        </div>
      </div>`).join("");

    const ander_html = `
      <div style="border:1px dashed #D9D3C7;border-radius:12px;padding:16px 18px;margin-bottom:16px;">
        <b style="font-size:15px;">Ander boeke</b>
        <p class="paneel-hulp-teks" style="margin:4px 0 0;">Boeke in geen ry nie. Hulle staan onderaan die Boeke-bladsy, alfabeties.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
          ${ANDER.length ? ANDER.map((w) => boek_html(w, "ander", 0, 1)).join("") : `<p class="paneel-hulp-teks">Geen.</p>`}
        </div>
      </div>
      <button type="button" class="terug-skakel" id="ra-nuwe-ry">+ Nuwe ry</button>`;

    const getal = [...TUIS.values()].filter(Boolean).length;
    const band_vas = BAND.links && BAND.middel && BAND.regs;
    const keuse = (plek, etiket) => `<label class="veld-etiket" style="flex:1;min-width:200px;">${etiket}
        <select class="veld-invoer ra-band" data-plek="${plek}">
          <option value="">— kies 'n boek —</option>
          ${WERKE.map((w) => `<option value="${esc(w.slug)}"${BAND[plek] === w.slug ? " selected" : ""}>${esc(w.titel)}</option>`).join("")}
        </select></label>`;
    const band_html = `<div style="border:1px solid #E5E0D6;border-radius:12px;padding:16px 18px;margin-bottom:16px;max-width:900px;background:#fff;">
      <b style="font-size:15px;">Die tuisblad se band</b>
      <p class="paneel-hulp-teks" style="margin:4px 0 10px;">Kies watter boek links, bo in die middel en regs lê. Die keuse word dadelik gestoor.
        Kies jy nie al drie nie, wissel die band elke keer uit die boeke met <b>★ Op die tuisblad</b>.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${keuse("links", "Links")}${keuse("middel", "Bo, in die middel")}${keuse("regs", "Regs")}
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin:14px 0 0;cursor:pointer;">
        <input type="checkbox" class="ra-nuut" ${BAND.nuut_op_rak ? "checked" : ""}>
        <span><b>Wys "Nuut op die rak" bo-aan die tuisblad</b> (die vier nuutste boeke). Onder die band wys die tuisblad altyd al die rye, in die volgorde hieronder.</span>
      </label>
      <p class="paneel-hulp-teks" style="margin:10px 0 0;">${band_vas ? "<b>Vas:</b> die band wys altyd hierdie drie, in hierdie volgorde." : "<b>Wissel:</b> die band kies self uit die ★-boeke."}
        ${BAND.links || BAND.middel || BAND.regs ? `<button type="button" class="terug-skakel ra-band-skoon" style="margin-left:8px;">Maak skoon (laat wissel)</button>` : ""}</p>
    </div>`;
    const tuis_html = band_html + `<p class="paneel-hulp-teks" style="background:#FFF7E6;border:1px solid #F1D9A6;border-radius:10px;padding:10px 14px;max-width:760px;">
      <b>★ Op die tuisblad:</b> ${getal} ${getal === 1 ? "boek" : "boeke"} gemerk.
      ${getal >= 3 ? (getal === 3 ? "Die band wys altyd hierdie drie." : "Die band wys elke keer drie van hulle, telkens 'n ander drie.")
        : "Merk ten minste drie. Tot dan kies die band uit al die boeke."}</p>`;
    wrap.innerHTML = tuis_html + rye_html + ander_html;
    koppel();
  }

  // --- Aksies ----------------------------------------------------------------

  function verwyder_uit_waar_hy_is(slug) {
    for (const r of RYE) {
      const i = r.werke.findIndex((w) => w.slug === slug);
      if (i >= 0) return r.werke.splice(i, 1)[0];
    }
    const i = ANDER.findIndex((w) => w.slug === slug);
    if (i >= 0) return ANDER.splice(i, 1)[0];
    return null;
  }

  function sorteer_ander() {
    ANDER.sort((a, b) => String(kort(a)).localeCompare(String(kort(b)), "af", { numeric: true }));
  }

  function koppel() {
    const wrap = document.getElementById("paneel-afdelings-lys");
    wrap.querySelectorAll(".ra-veld").forEach((el) => el.addEventListener("input", () => {
      const r = RYE[Number(el.dataset.ry)];
      r[el.dataset.veld] = el.value;
      const v = wrap.querySelector(`.ra-voorskou[data-ry="${el.dataset.ry}"]`);
      if (v) v.innerHTML = `Op die winkel: <b>${esc(r.naam_af || "(geen opskrif)")}</b>${r.beskrywing_af ? " · " + esc(r.beskrywing_af) : ""}`;
    }));
    wrap.querySelectorAll(".ra-op, .ra-af").forEach((b) => b.addEventListener("click", () => {
      const i = Number(b.dataset.ry);
      const j = b.classList.contains("ra-op") ? i - 1 : i + 1;
      if (j < 0 || j >= RYE.length) return;
      [RYE[i], RYE[j]] = [RYE[j], RYE[i]];
      teken();
    }));
    wrap.querySelectorAll(".ra-links, .ra-regs").forEach((b) => b.addEventListener("click", () => {
      const r = RYE[Number(b.dataset.ry)];
      const i = Number(b.dataset.boek);
      const j = b.classList.contains("ra-links") ? i - 1 : i + 1;
      if (!r || j < 0 || j >= r.werke.length) return;
      [r.werke[i], r.werke[j]] = [r.werke[j], r.werke[i]];
      teken();
    }));
    wrap.querySelectorAll(".ra-skuif").forEach((s) => s.addEventListener("change", () => {
      if (s.value === String(s.dataset.huidig)) return;
      const w = verwyder_uit_waar_hy_is(s.dataset.slug);
      if (!w) return;
      if (s.value === "ander") { ANDER.push(w); sorteer_ander(); }
      else RYE[Number(s.value)].werke.push(w);
      teken();
    }));
    wrap.querySelectorAll(".ra-verwyder").forEach((b) => b.addEventListener("click", () => {
      const i = Number(b.dataset.ry);
      const r = RYE[i];
      if (!confirm(`Verwyder die ry "${r.naam_af || r.kode}"? Die boeke daarin skuif na "Ander boeke".`)) return;
      ANDER.push(...r.werke);
      sorteer_ander();
      RYE.splice(i, 1);
      teken();
    }));
    // Die tuisblad-merkie stoor DADELIK (November 2026). Met net die
    // Stoor-knoppie heel onder het 'n merkie wat verander is, maklik
    // ongestoor gebly en die tuisblad het nie verander nie.
    const stoor_band = async () => {
      const status = document.getElementById("paneel-afdelings-status");
      try {
        const r = await fetch("/.netlify/functions/stoor-afdelings", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
          body: JSON.stringify({ band: BAND }),
        });
        if (!r.ok) throw new Error(await r.text());
        status.textContent = "Tuisblad gestoor.";
      } catch (fout) {
        alert("Kon nie die band stoor nie: " + (fout.message || fout));
      }
      teken();
    };
    wrap.querySelectorAll(".ra-band").forEach((sel) => sel.addEventListener("change", () => {
      BAND[sel.dataset.plek] = sel.value;
      stoor_band();
    }));
    const skoon = wrap.querySelector(".ra-band-skoon");
    if (skoon) skoon.addEventListener("click", () => { BAND = { ...BAND, links: "", middel: "", regs: "" }; stoor_band(); });
    const nuut = wrap.querySelector(".ra-nuut");
    if (nuut) nuut.addEventListener("change", () => { BAND.nuut_op_rak = nuut.checked; stoor_band(); });

    wrap.querySelectorAll(".ra-tuis").forEach((c) => c.addEventListener("change", async () => {
      const status = document.getElementById("paneel-afdelings-status");
      c.disabled = true;
      TUIS.set(c.dataset.slug, c.checked);
      try {
        await stoor_tuisblad();
        TUIS_BEGIN = new Map(TUIS);
        status.textContent = "★ Tuisblad gestoor.";
      } catch (fout) {
        TUIS.set(c.dataset.slug, !c.checked);
        alert("Kon nie die tuisblad-keuse stoor nie: " + (fout.message || fout));
      }
      teken();
    }));
    const nuwe = document.getElementById("ra-nuwe-ry");
    if (nuwe) nuwe.addEventListener("click", () => {
      RYE.push({ kode: "", naam_af: "", naam_en: "", beskrywing_af: "", beskrywing_en: "", werke: [] });
      teken();
      const velde = wrap.querySelectorAll(`.ra-veld[data-ry="${RYE.length - 1}"][data-veld="naam_af"]`);
      if (velde[0]) velde[0].focus();
    });
  }

  function maak_kode(naam, gebruik) {
    let basis = String(naam || "RY").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "RY";
    let kode = basis, n = 2;
    while (gebruik.has(kode)) kode = `${basis}-${n++}`;
    gebruik.add(kode);
    return kode;
  }

  // --- Laai en stoor ----------------------------------------------------------

  async function laai() {
    const wrap = document.getElementById("paneel-afdelings-lys");
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_word_gelaai")}</p>`;
    document.getElementById("paneel-afdelings-status").textContent = "";
    try {
      const [r, alle] = await Promise.all([fetch("/.netlify/functions/kry-afdelings"), kry_produkte()]);
      const afd_data = r.ok ? await r.json() : {};
      const afdelings = afd_data.afdelings || [];
      BAND = Object.assign({ links: "", middel: "", regs: "", nuut_op_rak: false }, afd_data.band || {});
      const produkte = alle.filter((p) => p && p.aktief !== false);
      PER_SLUG = new Map(produkte.map((p) => [p.slug, p]));
      const konteks = {
        per_slug: PER_SLUG,
        afdelings_per_kode: new Map(afdelings.map((a) => [a.kode, a])),
        lidmaatskap: bk_lidmaatskap(afdelings, PER_SLUG),
      };
      const werke = werke_uit(produkte);
      WERKE = werke.filter((w) => w.omslag).slice().sort((a, b) => String(a.titel).localeCompare(String(b.titel), "af", { numeric: true }));
      TUIS = new Map(werke.map((w) => [w.slug, is_op_tuisblad(w)]));
      TUIS_BEGIN = new Map(TUIS);
      const rye = bk_bou_rye(werke, konteks);
      RYE = rye.filter((ry) => ry.kode).map((ry) => {
        const meta = konteks.afdelings_per_kode.get(ry.kode) || {};
        return {
          kode: ry.kode,
          naam_af: meta.naam_af || afr_naam(ry.boeke[0]) || ry.naam,
          naam_en: meta.naam_en || engelse_naam(ry.boeke[0]) || "",
          beskrywing_af: meta.beskrywing_af || "",
          beskrywing_en: meta.beskrywing_en || "",
          werke: ry.boeke,
        };
      });
      // Gestoorde rye wat (nog) leeg is, bly ook staan.
      for (const a of afdelings) {
        if (!RYE.some((r) => r.kode === a.kode)) {
          RYE.splice(Math.min((a.plek || RYE.length + 1) - 1, RYE.length), 0,
            { kode: a.kode, naam_af: a.naam_af, naam_en: a.naam_en, beskrywing_af: a.beskrywing_af, beskrywing_en: a.beskrywing_en, werke: [] });
        }
      }
      const ander = rye.find((ry) => !ry.kode);
      ANDER = ander ? ander.boeke.slice() : [];
      sorteer_ander();
      teken();
    } catch (fout) {
      console.error("Kon nie die rye laai nie:", fout);
      wrap.innerHTML = `<p class="stelsel-boodskap">Kon nie die rye laai nie.</p>`;
    }
  }

  // Net die werke waarvan die merkie verander het. Die merkie sit op die
  // uitgawe wat hier gewys word; word dit afgehaal, gaan dit ook van die
  // eweknie af, anders sou die boek steeds in die band verskyn.
  async function stoor_tuisblad() {
    const stel = async (slug, waarde) => {
      const r = await fetch("/.netlify/functions/wysig-produk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
        body: JSON.stringify({ slug, wysigings: { op_tuisblad: waarde } }),
      });
      if (!r.ok) throw new Error(`${slug}: ${await r.text()}`);
      const p = PER_SLUG.get(slug);
      if (p) p.op_tuisblad = waarde;
    };
    for (const [slug, nou] of TUIS) {
      if (nou === TUIS_BEGIN.get(slug)) continue;
      await stel(slug, nou);
      const w = PER_SLUG.get(slug);
      const e = w && w.eweknie_slug && PER_SLUG.get(w.eweknie_slug);
      if (!nou && e && e.op_tuisblad === true) await stel(e.slug, false);
    }
    // Die paneel se eie produklys moet die nuwe waardes ook ken.
    if (typeof produkte_kas !== "undefined" && Array.isArray(produkte_kas)) {
      produkte_kas.forEach((p) => { const n = PER_SLUG.get(p.slug); if (n) p.op_tuisblad = n.op_tuisblad; });
    }
  }

  async function stoor() {
    const knoppie = document.getElementById("paneel-afdelings-stoor");
    const status = document.getElementById("paneel-afdelings-status");
    const foute = document.getElementById("paneel-afdelings-foute");
    foute.style.display = "none";
    const leeg = RYE.findIndex((r) => !String(r.naam_af || "").trim());
    if (leeg >= 0) {
      foute.textContent = `Ry ${leeg + 1} het nog nie 'n Afrikaanse opskrif nie.`;
      foute.style.display = "block";
      return;
    }
    const gebruik = new Set(RYE.map((r) => r.kode).filter(Boolean));
    const afdelings = RYE.map((r, i) => ({
      kode: r.kode || maak_kode(r.naam_af, gebruik),
      naam_af: r.naam_af.trim(),
      naam_en: (r.naam_en || "").trim(),
      beskrywing_af: (r.beskrywing_af || "").trim(),
      beskrywing_en: (r.beskrywing_en || "").trim(),
      plek: i + 1,
      boeke: r.werke.map((w) => w.slug),
    }));
    knoppie.disabled = true;
    status.textContent = "Besig …";
    try {
      const r = await fetch("/.netlify/functions/stoor-afdelings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
        body: JSON.stringify({ afdelings }),
      });
      if (!r.ok) throw new Error(await r.text());
      await stoor_tuisblad();
      await laai();
      status.textContent = "Gestoor. Die Boeke-bladsy wys dit dadelik.";
    } catch (fout) {
      foute.textContent = "Kon nie stoor nie: " + (fout.message || fout);
      foute.style.display = "block";
      status.textContent = "";
    } finally {
      knoppie.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(`.paneel-kieslys-item[data-afdeling="${AFDELING}"]`).forEach((b) => b.addEventListener("click", laai));
    const k = document.getElementById("paneel-afdelings-stoor");
    if (k) k.addEventListener("click", stoor);
  });
})();
