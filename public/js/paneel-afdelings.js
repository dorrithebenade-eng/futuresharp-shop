// paneel-afdelings.js — die "Afdelings (Boeke-bladsy)"-afdeling (November 2026).
//
// Elke reekskode wat in die katalogus voorkom (die veld "Reeks" in die
// produkvorm) word 'n ry op die Boeke-bladsy. Hier kry elke kode 'n naam
// in Afrikaans en Engels, 'n kort beskrywing en 'n plek (1 = bo-aan).
//
// Die lys word saamgestel uit wat reeds gestoor is PLUS elke kode wat in
// die produkte voorkom, sodat 'n nuwe reeks vanself hier verskyn. 'n Kode
// wat nie meer by 'n boek gebruik word nie, bly staan tot iemand dit leeg
// maak; dit doen niks op die winkel nie.
//
// kry_outorisasie_kop() kom van paneelbord.js.

(function () {
  const AFDELING = "afdelings";
  let geskiedenis = [];

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

  function tel_per_kode(produkte) {
    const per_slug = new Map(produkte.map((p) => [p.slug, p]));
    const tel = new Map();
    for (const p of produkte) {
      let kode = p.reeks && p.reeks.reeks_slug;
      if (!kode && p.eweknie_slug) {
        const e = per_slug.get(p.eweknie_slug);
        kode = e && e.reeks && e.reeks.reeks_slug;
      }
      if (!kode) continue;
      kode = kode.trim().toUpperCase();
      tel.set(kode, (tel.get(kode) || 0) + 1);
    }
    return tel;
  }

  function veld(kode, naam, waarde, plekhouer, wye) {
    return `<input type="text" class="veld-invoer" data-kode="${esc(kode)}" data-veld="${naam}" value="${esc(waarde)}" placeholder="${esc(plekhouer)}" style="${wye ? "" : "max-width:220px"}">`;
  }

  function teken(lys, tel) {
    const wrap = document.getElementById("paneel-afdelings-lys");
    if (!lys.length) {
      wrap.innerHTML = `<p class="stelsel-boodskap">Nog geen reekse nie. Gee eers 'n boek 'n <b>Reeks</b> in die produkvorm.</p>`;
      return;
    }
    wrap.innerHTML = lys.map((a) => `
      <div class="paneel-produk-ry" style="display:block;padding:14px 0;border-bottom:1px solid #eee;">
        <p style="margin:0 0 8px;"><b>${esc(a.kode)}</b> <span class="paneel-hulp-teks">(${(tel.get(a.kode) || 0) === 1 ? "1 boek" : (tel.get(a.kode) || 0) + " boeke"})</span></p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 14px;">
          <label class="veld-etiket">Naam (Afrikaans)${veld(a.kode, "naam_af", a.naam_af, "bv. Speel-Slim", true)}</label>
          <label class="veld-etiket">Name (English)${veld(a.kode, "naam_en", a.naam_en, "e.g. Play-Smart", true)}</label>
          <label class="veld-etiket">Beskrywing (Afrikaans, opsioneel)${veld(a.kode, "beskrywing_af", a.beskrywing_af, "Een kort sin", true)}</label>
          <label class="veld-etiket">Description (English, optional)${veld(a.kode, "beskrywing_en", a.beskrywing_en, "One short sentence", true)}</label>
          <label class="veld-etiket">Plek (1 = bo-aan)<input type="number" min="1" step="1" class="veld-invoer" data-kode="${esc(a.kode)}" data-veld="plek" value="${a.plek || ""}" style="max-width:100px"></label>
        </div>
      </div>`).join("");
  }

  async function laai() {
    const wrap = document.getElementById("paneel-afdelings-lys");
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("paneel_word_gelaai")}</p>`;
    document.getElementById("paneel-afdelings-status").textContent = "";
    try {
      const [r, produkte] = await Promise.all([fetch("/.netlify/functions/kry-afdelings"), kry_produkte()]);
      const gestoor = r.ok ? ((await r.json()).afdelings || []) : [];
      const tel = tel_per_kode(produkte);
      const per_kode = new Map(gestoor.map((a) => [a.kode, a]));
      for (const kode of tel.keys()) {
        if (!per_kode.has(kode)) per_kode.set(kode, { kode, naam_af: "", naam_en: "", beskrywing_af: "", beskrywing_en: "", plek: null });
      }
      geskiedenis = [...per_kode.values()].sort((a, b) => (a.plek || 999) - (b.plek || 999) || a.kode.localeCompare(b.kode));
      teken(geskiedenis, tel);
    } catch (fout) {
      console.error("Kon nie afdelings laai nie:", fout);
      wrap.innerHTML = `<p class="stelsel-boodskap">Kon nie die afdelings laai nie.</p>`;
    }
  }

  async function stoor() {
    const knoppie = document.getElementById("paneel-afdelings-stoor");
    const status = document.getElementById("paneel-afdelings-status");
    const foute = document.getElementById("paneel-afdelings-foute");
    foute.style.display = "none";
    const per_kode = new Map(geskiedenis.map((a) => [a.kode, { ...a }]));
    document.querySelectorAll("#paneel-afdelings-lys [data-kode]").forEach((el) => {
      const a = per_kode.get(el.dataset.kode);
      if (!a) return;
      a[el.dataset.veld] = el.dataset.veld === "plek" ? (Number(el.value) || null) : el.value.trim();
    });
    knoppie.disabled = true;
    status.textContent = "Besig …";
    try {
      const r = await fetch("/.netlify/functions/stoor-afdelings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
        body: JSON.stringify({ afdelings: [...per_kode.values()] }),
      });
      if (!r.ok) throw new Error(await r.text());
      status.textContent = "Gestoor.";
      await laai();
      status.textContent = "Gestoor.";
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
