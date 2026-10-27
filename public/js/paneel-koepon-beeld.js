// public/js/paneel-koepon-beeld.js
//
// KOEPONBEELD (Oktober 2026). Elke koepon in die Koepons-lys kry 'n knoppie
// "Maak koeponbeeld". Dit maak 'n venster oop waar personeel kies op watter
// advertensie die koepon kom, en self die teks bepaal: wat die koepon gee en
// tot wanneer dit geldig is. Die paneel teken die beeld self op 'n canvas
// (2400 x 1260, dubbel 1200 x 630 sodat dit skerp is op WhatsApp, e-pos en
// sosiale media) en laai dit as JPG af. Geen bediener hoef te teken nie.
//
// Die agtergronde is die advertensies met 'n leë, gestippelde koeponblok,
// in public/images/koepon/. Die blok staan op dieselfde plek in elkeen
// (sien KOEPON_BLOK), sodat een tekening vir almal werk.
//
// Die teks word uit die koepon self voorgestel (tipe, afslag, boeke,
// formaat, vervaldatum), maar personeel kan dit voor die aflaai verander.
// Dit verander net die beeld; die koepon se reëls in die winkel bly soos
// dit in die koeponvorm gestel is.

(function () {
  const AGTERGRONDE = [
    { lêer: "Future_Shop_AF", naam: "Future Shop (Afrikaans)", taal: "af" },
    { lêer: "Future_Shop_EN", naam: "Future Shop (English)", taal: "en" },
    { lêer: "Speel-Slim_reeks_AF", naam: "Speel-Slim-reeks (Afrikaans)", taal: "af" },
    { lêer: "Play-Smart_series_EN", naam: "Play-Smart series (English)", taal: "en" },
    { lêer: "Speel-Slim_Fokus_reeks_AF", naam: "Speel-Slim Fokus (Afrikaans)", taal: "af" },
    { lêer: "Play-Smart_Focus_series_EN", naam: "Play-Smart Focus (English)", taal: "en" },
    { lêer: "Eugene_Botha_AF", naam: "Eugene Botha se boeke (Afrikaans)", taal: "af" },
    { lêer: "Eugene_Botha_EN", naam: "Eugene Botha's books (English)", taal: "en" },
  ];

  // Die gestippelde blok in die agtergrond, in pixels van die 2400 x 1260-beeld.
  const KOEPON_BLOK = { x: 1080, y: 600, b: 760, h: 356, rand: 5, binne_x: 40 };
  const WIT = "#FFFFFF", AMPER_WIT = "#E3F3EF";

  const MAANDE = {
    af: ["Januarie", "Februarie", "Maart", "April", "Mei", "Junie", "Julie", "Augustus", "September", "Oktober", "November", "Desember"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  };

  function ontsnap(teks) {
    return String(teks == null ? "" : teks).replace(/[&<>"']/g, (k) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[k]));
  }

  function laai_beeld(src) {
    return new Promise((ok, nee) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nee; i.src = src; });
  }

  function koepon_boeke(koepon) {
    if (Array.isArray(koepon.produk_slugs) && koepon.produk_slugs.length) return koepon.produk_slugs;
    return koepon.produk_slug ? [koepon.produk_slug] : [];
  }

  function boek_titel(slug) {
    const lys = typeof produkte_kas !== "undefined" ? produkte_kas : [];
    const p = lys.find((x) => x.slug === slug);
    return p ? p.titel : slug;
  }

  // Kies 'n agtergrond wat by die koepon se boeke pas.
  function stel_agtergrond_voor(koepon) {
    const boeke = koepon_boeke(koepon).map((s) => s.toLowerCase());
    const eerste = boeke[0] || "";
    if (eerste.startsWith("speel-slim-fokus")) return "Speel-Slim_Fokus_reeks_AF";
    if (eerste.startsWith("play-smart-focus")) return "Play-Smart_Focus_series_EN";
    if (eerste.startsWith("speel-slim")) return "Speel-Slim_reeks_AF";
    if (eerste.startsWith("play-smart")) return "Play-Smart_series_EN";
    if (/^n-(ma|pa)-se-reis/.test(eerste)) return "Eugene_Botha_AF";
    if (/^(words-i-would|you-child)/.test(eerste)) return "Eugene_Botha_EN";
    return "Future_Shop_AF";
  }

  // Stel die "wat dit gee"-teks voor uit die koepon se reëls.
  function stel_aanbod_voor(koepon, taal) {
    const af = taal !== "en";
    const formaat = {
      eboek: af ? "e-boek" : "e-book",
      harde_kopie: af ? "harde kopie" : "hard copy",
      leen: af ? "lening" : "loan",
    }[koepon.formaat_beperking] || (af ? "boek" : "book");
    let boeke = koepon_boeke(koepon);
    // Geld die koepon vir die Afrikaanse en Engelse weergawe van dieselfde
    // boek? Noem dan net die boek in die taal van die advertensie.
    const lys = typeof produkte_kas !== "undefined" ? produkte_kas : [];
    if (boeke.length === 2) {
      const [a, b] = boeke.map((s) => lys.find((x) => x.slug === s));
      if (a && b && (a.eweknie_slug === b.slug || b.eweknie_slug === a.slug)) {
        const in_taal = [a, b].find((x) => x.taal === (af ? "af" : "en"));
        boeke = [(in_taal || a).slug];
      }
    }
    let waarvan;
    if (boeke.length === 1) waarvan = boek_titel(boeke[0]);
    else if (boeke.length > 1) waarvan = af ? `${boeke.length} gekose boeke` : `${boeke.length} selected books`;
    else waarvan = af ? "jou keuse" : "your choice";

    if (koepon.tipe === "afslag") {
      const bedrag = koepon.afslag_tipe === "vaste_bedrag"
        ? `R${Math.round((koepon.afslag_waarde || 0) / 100)}`
        : `${koepon.afslag_waarde || 0}%`;
      if (boeke.length === 1) return af ? `${bedrag} afslag op ${waarvan}` : `${bedrag} off ${waarvan}`;
      if (boeke.length > 1) return af ? `${bedrag} afslag op ’n ${formaat} uit ${waarvan}` : `${bedrag} off a ${formaat} from ${waarvan}`;
      return af ? `${bedrag} afslag op ’n ${formaat} van ${waarvan}` : `${bedrag} off a ${formaat} of ${waarvan}`;
    }
    if (boeke.length === 1) return af ? `’n Gratis ${formaat}: ${waarvan}` : `A free ${formaat}: ${waarvan}`;
    if (boeke.length > 1) return af ? `’n Gratis ${formaat} uit ${waarvan}` : `A free ${formaat} from ${waarvan}`;
    return af ? `’n Gratis ${formaat} van ${waarvan}` : `A free ${formaat} of ${waarvan}`;
  }

  function formateer_datum(iso, taal) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getDate()} ${MAANDE[taal === "en" ? "en" : "af"][d.getMonth()]} ${d.getFullYear()}`;
  }

  function stel_geldig_voor(koepon, taal) {
    const datum = formateer_datum(koepon.verval_op, taal);
    if (!datum) return "";
    return taal === "en" ? `Valid until ${datum}` : `Geldig tot ${datum}`;
  }

  // Breek teks in reëls wat in 'n breedte pas.
  function breek(ctx, teks, breedte, maks_reels) {
    const woorde = String(teks || "").split(/\s+/).filter(Boolean);
    const reels = [];
    let reel = "";
    for (const w of woorde) {
      const toets = reel ? reel + " " + w : w;
      if (ctx.measureText(toets).width <= breedte || !reel) reel = toets;
      else { reels.push(reel); reel = w; }
    }
    if (reel) reels.push(reel);
    if (reels.length > maks_reels) {
      const oor = reels.slice(0, maks_reels);
      let laaste = oor[maks_reels - 1];
      while (laaste && ctx.measureText(laaste + "…").width > breedte) laaste = laaste.slice(0, -1);
      oor[maks_reels - 1] = laaste + "…";
      return oor;
    }
    return reels;
  }

  async function teken(canvas, opsies) {
    const W = 2400, H = 1260;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    try {
      await document.fonts.load("800 76px Montserrat");
      await document.fonts.load("600 32px Poppins");
      await document.fonts.load("400 26px Poppins");
    } catch (_) {}
    const agtergrond = await laai_beeld(`images/koepon/${opsies.agtergrond}.jpg`);
    ctx.drawImage(agtergrond, 0, 0, W, H);

    const B = KOEPON_BLOK;
    const x = B.x + B.rand + B.binne_x;
    const breedte = B.b - 2 * (B.rand + B.binne_x);
    ctx.textBaseline = "alphabetic";

    // Die kode: so groot as wat in die breedte pas.
    ctx.fillStyle = WIT;
    let grootte = 76;
    do {
      ctx.font = `800 ${grootte}px Montserrat`;
      grootte -= 2;
    } while (ctx.measureText(opsies.kode).width > breedte && grootte > 36);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
    ctx.fillText(opsies.kode, x, B.y + 150);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    // Wat die koepon gee: hoogstens twee reëls.
    ctx.font = "600 32px Poppins";
    const aanbod = breek(ctx, opsies.aanbod, breedte, 2);
    aanbod.forEach((r, i) => ctx.fillText(r, x, B.y + 206 + i * 40));

    // Onderste reël: geldigheid en hoe om die kode te gebruik.
    ctx.font = "400 26px Poppins";
    ctx.fillStyle = AMPER_WIT;
    const hoe = opsies.taal === "en" ? "Enter the code when you pay" : "Tik die kode in wanneer jy betaal";
    const onder = opsies.geldig ? `${opsies.geldig} · ${hoe}` : hoe;
    const onder_reels = breek(ctx, onder, breedte, 2);
    const onder_y = B.y + B.h - B.rand - 30 - (onder_reels.length - 1) * 34;
    onder_reels.forEach((r, i) => ctx.fillText(r, x, onder_y + i * 34));
  }

  // --- Die venster ---

  let venster = null;

  function bou_venster() {
    const styl = document.createElement("style");
    styl.textContent = `
      .kb-agter[hidden] { display: none !important; }
      .kb-agter { position: fixed; inset: 0; background: rgba(7,22,48,.55); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 24px 16px; }
      .kb-venster { background: #fff; border-radius: 12px; max-width: 980px; width: 100%; padding: 22px; display: grid; gap: 16px; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
      .kb-kop { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .kb-sluit { background: #F5F4F1; border: 1px solid #ddd; border-radius: 999px; padding: 6px 14px; font: 600 14px Poppins, sans-serif; cursor: pointer; }
      .kb-sluit:hover, .kb-sluit:focus-visible { background: #e9e7e1; }
      .kb-kop h3 { margin: 0; font-family: Montserrat, sans-serif; font-size: 20px; }
      .kb-uitleg { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 20px; align-items: start; }
      .kb-velde { display: grid; gap: 10px; }
      .kb-velde .veld-invoer { width: 100%; }
      .kb-wenk { font-size: 12.5px; color: #5B5B5B; margin: 0; }
      .kb-voorskou canvas { width: 100%; height: auto; display: block; border-radius: 8px; border: 1px solid #e5e5e5; }
      .kb-knoppies { display: flex; gap: 10px; flex-wrap: wrap; }
      @media (max-width: 760px) { .kb-uitleg { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(styl);

    venster = document.createElement("div");
    venster.className = "kb-agter";
    venster.hidden = true;
    venster.innerHTML = `
      <div class="kb-venster" role="dialog" aria-modal="true" aria-labelledby="kb-titel">
        <div class="kb-kop">
          <h3 id="kb-titel">Koeponbeeld</h3>
          <button type="button" class="kb-sluit" id="kb-sluit" aria-label="Sluit">Sluit ✕</button>
        </div>
        <div class="kb-uitleg">
          <div class="kb-velde">
            <label class="veld-etiket" for="kb-agtergrond">Advertensie</label>
            <select id="kb-agtergrond" class="veld-invoer">
              ${AGTERGRONDE.map((a) => `<option value="${a.lêer}">${ontsnap(a.naam)}</option>`).join("")}
            </select>
            <label class="veld-etiket" for="kb-aanbod">Wat die koepon gee</label>
            <textarea id="kb-aanbod" class="veld-invoer" rows="2" maxlength="90"></textarea>
            <label class="veld-etiket" for="kb-geldig">Geldigheid</label>
            <input type="text" id="kb-geldig" class="veld-invoer" maxlength="60">
            <p class="kb-wenk">Die teks is voorgestel uit die koepon self. Verander dit gerus; dit verander net die beeld, nie wat die koepon in die winkel doen nie. Laat Geldigheid leeg as die koepon nie verval nie.</p>
            <div class="kb-knoppies">
              <button type="button" class="kaart-aksie" id="kb-aflaai">Laai beeld af</button>
            </div>
          </div>
          <div class="kb-voorskou"><canvas id="kb-canvas" aria-label="Voorskou van die koeponbeeld"></canvas></div>
        </div>
      </div>
    `;
    document.body.appendChild(venster);

    venster.querySelector("#kb-sluit").addEventListener("click", sluit);
    venster.addEventListener("click", (e) => { if (e.target === venster) sluit(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !venster.hidden) sluit(); });
    venster.querySelector("#kb-agtergrond").addEventListener("change", () => {
      // Ander taal gekies: stel die teks weer in daardie taal voor.
      const taal = huidige_taal();
      venster.querySelector("#kb-aanbod").value = stel_aanbod_voor(huidige_koepon, taal);
      venster.querySelector("#kb-geldig").value = stel_geldig_voor(huidige_koepon, taal);
      herteken();
    });
    venster.querySelector("#kb-aanbod").addEventListener("input", herteken_later);
    venster.querySelector("#kb-geldig").addEventListener("input", herteken_later);
    venster.querySelector("#kb-aflaai").addEventListener("click", laai_af);
  }

  let huidige_koepon = null;
  let wag = null;

  function huidige_taal() {
    const a = AGTERGRONDE.find((x) => x.lêer === venster.querySelector("#kb-agtergrond").value);
    return a ? a.taal : "af";
  }

  function herteken_later() {
    clearTimeout(wag);
    wag = setTimeout(herteken, 250);
  }

  async function herteken() {
    if (!huidige_koepon) return;
    try {
      await teken(venster.querySelector("#kb-canvas"), {
        agtergrond: venster.querySelector("#kb-agtergrond").value,
        taal: huidige_taal(),
        kode: huidige_koepon.kode,
        aanbod: venster.querySelector("#kb-aanbod").value.trim(),
        geldig: venster.querySelector("#kb-geldig").value.trim(),
      });
    } catch (fout) {
      console.error("Kon nie koeponbeeld teken nie:", fout);
    }
  }

  function laai_af() {
    const canvas = venster.querySelector("#kb-canvas");
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/jpeg", 0.9);
    a.download = `koepon-${huidige_koepon.kode}-${venster.querySelector("#kb-agtergrond").value}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function sluit() {
    venster.hidden = true;
    huidige_koepon = null;
  }

  // Word deur paneelbord.js geroep wanneer "Maak koeponbeeld" gekliek word.
  window.open_koepon_beeld = function (koepon) {
    if (!koepon) return;
    if (!venster) bou_venster();
    huidige_koepon = koepon;
    venster.querySelector("#kb-titel").textContent = `Koeponbeeld: ${koepon.kode}`;
    venster.querySelector("#kb-agtergrond").value = stel_agtergrond_voor(koepon);
    const taal = huidige_taal();
    venster.querySelector("#kb-aanbod").value = stel_aanbod_voor(koepon, taal);
    venster.querySelector("#kb-geldig").value = stel_geldig_voor(koepon, taal);
    venster.hidden = false;
    herteken();
  };
})();
