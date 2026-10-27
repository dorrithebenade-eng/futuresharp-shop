// public/js/outeur-advertensie.js
//
// "Maak advertensie" op elke titel in My titels (Oktober 2026). 'n Outeur
// maak self 'n advertensiebeeld vir sy boek: die omslag, 'n opskrif en 'n
// kort beskrywing wat hy self kan verander, en 'n QR-kode wat direk na die
// boek se bladsy in die winkel lei. Die beeld word in die blaaier op 'n
// canvas geteken (2400 x 1260, die formaat wat WhatsApp, e-pos en sosiale
// media as groot voorskou wys) en as JPG afgelaai. Daaronder staan 'n
// WhatsApp-boodskap met 'n klikbare skakel, want iemand kan nie 'n QR-kode
// op sy eie foon se skerm skandeer nie.
//
// EIE LÊER, dieselfde patroon as outeur-deel-skakel.js: outeur-titels.js
// bou die kaarte en bly onaangeraak. Hierdie lêer haak met 'n
// MutationObserver in en lees die boek se omslag en beskrywing uit die
// publieke katalogus. Net 'n boek wat te koop is, kry die knoppie.

(function () {
  const WINKEL = window.location.origin;
  const KLEUR = { teal: "#479F91", amber: "#F1BD43", koraal: "#EC5832", swart: "#171717", wit: "#FFFFFF", grys: "#5B5B5B", lig: "#F1FAF8" };

  const TEKS = {
    af: {
      knoppie: "📣 Maak advertensie",
      pil: (outeur) => `Boek deur ${outeur}`,
      opskrif: "Nou te koop in die",
      uitlig: "Future Shop.",
      skan: "Skandeer en lees meer",
      onder: "Future Sharp se eie boekwinkel",
      boodskap: (titel, besk, url) => `📚 *${titel}* is nou te koop in die Future Shop.\n${besk}\nKyk hier: ${url}`,
    },
    en: {
      knoppie: "📣 Make an advert",
      pil: (outeur) => `A book by ${outeur}`,
      opskrif: "Now available in the",
      uitlig: "Future Shop.",
      skan: "Scan to read more",
      onder: "Future Sharp's own bookshop",
      boodskap: (titel, besk, url) => `📚 *${titel}* is now available in the Future Shop.\n${besk}\nHave a look: ${url}`,
    },
  };

  function knoppie_teks() {
    const taal = (document.documentElement.lang || "af").startsWith("en") ? "en" : "af";
    return TEKS[taal].knoppie;
  }

  // --- Katalogus (omslag, beskrywing, taal) ---

  let katalogus = null;
  async function kry_produk(slug) {
    if (!katalogus) {
      const resp = await fetch("/.netlify/functions/kry-katalogus");
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const data = await resp.json();
      katalogus = data.produkte || [];
    }
    return katalogus.find((p) => p.slug === slug) || null;
  }

  function laai_beeld(src) {
    return new Promise((ok, nee) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nee; i.src = src; });
  }

  // Eerste sinne van die oorsig, hoogstens sowat 220 karakters.
  function kort_beskrywing(teks) {
    const skoon = String(teks || "").replace(/\s+/g, " ").trim();
    if (skoon.length <= 220) return skoon;
    const sinne = skoon.match(/[^.!?]+[.!?]+/g) || [skoon];
    let uit = "";
    for (const s of sinne) {
      if ((uit + s).length > 220) break;
      uit += s;
    }
    return (uit || skoon.slice(0, 217) + "…").trim();
  }

  // --- Tekenwerk ---

  function breek(ctx, teks, breedte, maks) {
    const woorde = String(teks || "").split(/\s+/).filter(Boolean);
    const reels = [];
    let reel = "";
    for (const w of woorde) {
      const toets = reel ? reel + " " + w : w;
      if (ctx.measureText(toets).width <= breedte || !reel) reel = toets;
      else { reels.push(reel); reel = w; }
    }
    if (reel) reels.push(reel);
    if (reels.length > maks) {
      const oor = reels.slice(0, maks);
      let l = oor[maks - 1];
      while (l && ctx.measureText(l + "…").width > breedte) l = l.slice(0, -1);
      oor[maks - 1] = l + "…";
      return oor;
    }
    return reels;
  }

  function afgeronde(ctx, x, y, b, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + b, y, x + b, y + h, r);
    ctx.arcTo(x + b, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + b, y, r);
    ctx.closePath();
  }

  function teken_qr(ctx, url, x, y, grootte) {
    if (typeof qrcode !== "function") return;
    const q = qrcode(0, "Q");
    q.addData(url);
    q.make();
    const n = q.getModuleCount();
    const m = grootte / n;
    ctx.fillStyle = KLEUR.swart;
    for (let r = 0; r < n; r++) {
      for (let k = 0; k < n; k++) {
        if (q.isDark(r, k)) ctx.fillRect(Math.floor(x + k * m), Math.floor(y + r * m), Math.ceil(m), Math.ceil(m));
      }
    }
  }

  async function teken(canvas, o) {
    const W = 2400, H = 1260;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    try {
      await document.fonts.load("800 76px Montserrat");
      await document.fonts.load("700 30px Montserrat");
      await document.fonts.load("600 36px Poppins");
      await document.fonts.load("400 30px Poppins");
    } catch (_) {}
    const [omslag, woordmerk, logo, hand] = await Promise.all([
      laai_beeld(o.omslag),
      laai_beeld("images/future-shop-woordmerk.png"),
      laai_beeld("images/FutureSharp_Logo.png"),
      laai_beeld("images/hand-spiraal.png").catch(() => null),
    ]);
    const T = TEKS[o.taal];

    // Agtergrond en blokkies
    ctx.fillStyle = KLEUR.teal; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = KLEUR.amber; ctx.fillRect(0, 0, 300, 60);
    ctx.fillStyle = KLEUR.koraal; ctx.fillRect(300, 0, 120, 60);

    // Omslag, effens skuins met 'n wit rand en skaduwee
    const ob = 400, oh = Math.round(ob * omslag.height / omslag.width);
    const oh_maks = 700, skaal = Math.min(1, oh_maks / oh);
    const b = Math.round(ob * skaal), h = Math.round(oh * skaal);
    ctx.save();
    ctx.translate(110 + 220, 120 + 360);
    ctx.rotate(-3 * Math.PI / 180);
    ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
    ctx.fillStyle = KLEUR.wit; ctx.fillRect(-b / 2 - 12, -h / 2 - 12, b + 24, h + 24);
    ctx.shadowColor = "transparent";
    ctx.drawImage(omslag, -b / 2, -h / 2, b, h);
    ctx.restore();

    // Teks
    const tx = 680, tb = 1120;
    let y = 104;
    ctx.textBaseline = "top";
    ctx.font = "700 26px Montserrat";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
    const pil = T.pil(o.outeur).toUpperCase();
    const pil_b = Math.min(ctx.measureText(pil).width + 48, tb);
    ctx.fillStyle = KLEUR.amber; afgeronde(ctx, tx, y, pil_b, 52, 8); ctx.fill();
    ctx.fillStyle = KLEUR.swart; ctx.fillText(breek(ctx, pil, tb - 48, 1)[0], tx + 24, y + 13);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    y += 92;

    ctx.font = "800 72px Montserrat";
    const opskrif = breek(ctx, o.opskrif, tb, 2);
    ctx.fillStyle = KLEUR.wit;
    opskrif.forEach((r) => { ctx.fillText(r, tx, y); y += 94; });
    const uitlig = breek(ctx, o.uitlig, tb - 36, 2);
    uitlig.forEach((r) => {
      const rb = ctx.measureText(r).width;
      ctx.fillStyle = KLEUR.wit; afgeronde(ctx, tx, y - 4, rb + 36, 90, 8); ctx.fill();
      ctx.fillStyle = KLEUR.koraal; ctx.fillText(r, tx + 18, y + 4);
      y += 104;
    });
    y += 18;

    ctx.fillStyle = KLEUR.wit;
    ctx.font = "600 36px Poppins";
    breek(ctx, o.titel, tb, 2).forEach((r) => { ctx.fillText(r, tx, y); y += 48; });
    y += 14;
    ctx.fillStyle = KLEUR.lig;
    ctx.font = "400 30px Poppins";
    const ruimte = Math.max(1, Math.floor((940 - y) / 46));
    breek(ctx, o.beskrywing, tb, Math.min(4, ruimte)).forEach((r) => { ctx.fillText(r, tx, y); y += 46; });

    // QR-kaart met die hand
    const qx = 1864, qy = 104, qb = 444, qh = 520;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
    ctx.fillStyle = KLEUR.wit; afgeronde(ctx, qx, qy, qb, qh, 20); ctx.fill();
    ctx.restore();
    teken_qr(ctx, o.url, qx + 28, qy + 28, qb - 56);
    ctx.fillStyle = KLEUR.swart;
    ctx.font = "700 30px Montserrat";
    ctx.textAlign = "center";
    breek(ctx, T.skan, qb - 40, 2).forEach((r, i) => ctx.fillText(r, qx + qb / 2, qy + qb - 4 + i * 36));
    ctx.textAlign = "left";
    if (hand) {
      ctx.save();
      ctx.translate(qx + qb / 2, qy + qh + 170);
      ctx.rotate(-78 * Math.PI / 180);
      const hb = 300, hh = Math.round(hb * hand.height / hand.width);
      ctx.drawImage(hand, -hb / 2, -hh / 2, hb, hh);
      ctx.restore();
    }

    // Kleurstrook en wit voet
    const voet = 996;
    [KLEUR.swart, KLEUR.amber, KLEUR.koraal, KLEUR.teal].forEach((k, i) => { ctx.fillStyle = k; ctx.fillRect(i * W / 4, voet - 16, W / 4, 16); });
    ctx.fillStyle = KLEUR.wit; ctx.fillRect(0, voet, W, H - voet);
    const wh = 210, wb = Math.round(wh * woordmerk.width / woordmerk.height);
    ctx.drawImage(woordmerk, 100, voet + (H - voet - wh) / 2, wb, wh);
    const lh = 170, lb = Math.round(lh * logo.width / logo.height);
    ctx.drawImage(logo, W - 92 - lb, voet + (H - voet - lh) / 2, lb, lh);
    ctx.textAlign = "right";
    ctx.fillStyle = KLEUR.teal; ctx.font = "600 38px Poppins";
    ctx.fillText(WINKEL.replace(/^https?:\/\//, ""), W - 92 - lb - 40, voet + 82);
    ctx.fillStyle = KLEUR.grys; ctx.font = "400 28px Poppins";
    ctx.fillText(T.onder, W - 92 - lb - 40, voet + 136);
    ctx.textAlign = "left";
  }

  // --- Venster ---

  let venster = null, huidig = null, wag = null, boodskap_self = false;

  function bou_venster() {
    const styl = document.createElement("style");
    styl.textContent = `
      .oa-strook { margin-top: 8px; }
      .oa-knoppie { background: #F1BD43; color: #171717; border: 0; border-radius: 999px; padding: 7px 14px; font: 600 14px Poppins, sans-serif; cursor: pointer; }
      .oa-knoppie:hover, .oa-knoppie:focus-visible { background: #e6ad2c; }
      .oa-agter[hidden] { display: none !important; }
      .oa-agter { position: fixed; inset: 0; background: rgba(7,22,48,.55); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 24px 16px; }
      .oa-venster { background: #fff; border-radius: 12px; max-width: 1000px; width: 100%; padding: 22px; display: grid; gap: 16px; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
      .oa-kop { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .oa-kop h3 { margin: 0; font-family: Montserrat, sans-serif; font-size: 20px; }
      .oa-sluit { background: #F5F4F1; border: 1px solid #ddd; border-radius: 999px; padding: 6px 14px; font: 600 14px Poppins, sans-serif; cursor: pointer; }
      .oa-uitleg { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 20px; align-items: start; }
      .oa-velde { display: grid; gap: 8px; }
      .oa-velde label { font: 600 13px Poppins, sans-serif; color: #171717; margin-top: 4px; }
      .oa-velde input, .oa-velde textarea, .oa-velde select { width: 100%; box-sizing: border-box; border: 1px solid #d6d6d6; border-radius: 8px; padding: 8px 10px; font: 400 14px Poppins, sans-serif; }
      .oa-wenk { font: 400 12.5px Poppins, sans-serif; color: #5B5B5B; margin: 0; }
      .oa-voorskou canvas { width: 100%; height: auto; display: block; border-radius: 8px; border: 1px solid #e5e5e5; }
      .oa-knoppies { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
      .oa-hoof { background: #EC5832; color: #fff; border: 0; border-radius: 999px; padding: 10px 18px; font: 600 14px Poppins, sans-serif; cursor: pointer; }
      .oa-hoof:hover, .oa-hoof:focus-visible { background: #d94a26; }
      @media (max-width: 780px) { .oa-uitleg { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(styl);

    venster = document.createElement("div");
    venster.className = "oa-agter";
    venster.hidden = true;
    venster.innerHTML = `
      <div class="oa-venster" role="dialog" aria-modal="true" aria-labelledby="oa-titel">
        <div class="oa-kop">
          <h3 id="oa-titel">Advertensie</h3>
          <button type="button" class="oa-sluit" id="oa-sluit">Sluit ✕</button>
        </div>
        <div class="oa-uitleg">
          <div class="oa-velde">
            <label for="oa-taal">Taal van die advertensie</label>
            <select id="oa-taal"><option value="af">Afrikaans</option><option value="en">English</option></select>
            <label for="oa-opskrif">Opskrif</label>
            <input id="oa-opskrif" maxlength="40">
            <label for="oa-uitlig">Uitgeligte woorde (in oranje)</label>
            <input id="oa-uitlig" maxlength="30">
            <label for="oa-beskrywing">Kort beskrywing</label>
            <textarea id="oa-beskrywing" rows="4" maxlength="240"></textarea>
            <p class="oa-wenk">Die QR-kode lei direk na jou boek se bladsy in die winkel.</p>
            <div class="oa-knoppies"><button type="button" class="oa-hoof" id="oa-aflaai">Laai beeld af</button></div>
            <label for="oa-boodskap">WhatsApp-boodskap</label>
            <textarea id="oa-boodskap" rows="5"></textarea>
            <p class="oa-wenk">Stuur eers die beeld, en plak dan hierdie boodskap as onderskrif. Die skakel word in WhatsApp klikbaar.</p>
            <div class="oa-knoppies">
              <button type="button" class="oa-hoof" id="oa-kopieer">Kopieer boodskap</button>
              <span class="oa-wenk" id="oa-status" role="status"></span>
            </div>
          </div>
          <div class="oa-voorskou"><canvas id="oa-canvas" aria-label="Voorskou van die advertensie"></canvas></div>
        </div>
      </div>`;
    document.body.appendChild(venster);

    const $ = (id) => venster.querySelector("#" + id);
    $("oa-sluit").addEventListener("click", sluit);
    venster.addEventListener("click", (e) => { if (e.target === venster) sluit(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !venster.hidden) sluit(); });
    $("oa-taal").addEventListener("change", () => {
      const T = TEKS[$("oa-taal").value];
      $("oa-opskrif").value = T.opskrif;
      $("oa-uitlig").value = T.uitlig;
      boodskap_self = false;
      werk_by();
    });
    ["oa-opskrif", "oa-uitlig", "oa-beskrywing"].forEach((id) => $(id).addEventListener("input", werk_by));
    $("oa-boodskap").addEventListener("input", () => { boodskap_self = true; });
    $("oa-aflaai").addEventListener("click", laai_af);
    $("oa-kopieer").addEventListener("click", kopieer);
  }

  function waardes() {
    const $ = (id) => venster.querySelector("#" + id);
    return {
      taal: $("oa-taal").value,
      opskrif: $("oa-opskrif").value.trim(),
      uitlig: $("oa-uitlig").value.trim(),
      beskrywing: $("oa-beskrywing").value.trim(),
      titel: huidig.titel,
      outeur: huidig.outeur,
      omslag: huidig.omslag,
      url: `${WINKEL}/produk.html?produk=${encodeURIComponent(huidig.slug)}`,
    };
  }

  function werk_by() {
    if (!huidig) return;
    const w = waardes();
    if (!boodskap_self) venster.querySelector("#oa-boodskap").value = TEKS[w.taal].boodskap(w.titel, w.beskrywing, w.url);
    clearTimeout(wag);
    wag = setTimeout(() => teken(venster.querySelector("#oa-canvas"), w).catch((f) => console.error("Kon nie advertensie teken nie:", f)), 200);
  }

  function laai_af() {
    const a = document.createElement("a");
    a.href = venster.querySelector("#oa-canvas").toDataURL("image/jpeg", 0.9);
    a.download = `advertensie-${huidig.slug}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function kopieer() {
    const veld = venster.querySelector("#oa-boodskap");
    const status = venster.querySelector("#oa-status");
    try { await navigator.clipboard.writeText(veld.value); status.textContent = "Gekopieer ✓"; }
    catch (_) { veld.focus(); veld.select(); status.textContent = "Druk Ctrl+C om te kopieer"; }
    setTimeout(() => { status.textContent = ""; }, 3000);
  }

  function sluit() { venster.hidden = true; huidig = null; }

  async function maak_oop(slug, knoppie) {
    knoppie.disabled = true;
    try {
      const p = await kry_produk(slug);
      if (!p || !p.omslag) throw new Error("Boek of omslag nie gevind nie");
      if (!venster) bou_venster();
      huidig = { slug, titel: p.titel, outeur: p.outeur || "", omslag: p.omslag };
      const taal = p.taal === "en" ? "en" : "af";
      const $ = (id) => venster.querySelector("#" + id);
      $("oa-titel").textContent = `Advertensie: ${p.titel}`;
      $("oa-taal").value = taal;
      $("oa-opskrif").value = TEKS[taal].opskrif;
      $("oa-uitlig").value = TEKS[taal].uitlig;
      $("oa-beskrywing").value = kort_beskrywing(p.oorsig);
      $("oa-status").textContent = "";
      boodskap_self = false;
      venster.hidden = false;
      werk_by();
    } catch (fout) {
      console.error("Kon nie advertensie oopmaak nie:", fout);
      knoppie.textContent = "Kon nie laai nie, probeer weer";
    } finally {
      knoppie.disabled = false;
    }
  }

  // --- Inhaak by My titels ---

  function voeg_knoppie_by(kaart) {
    if (kaart.dataset.oaGedoen === "ja") return;
    kaart.dataset.oaGedoen = "ja";
    if (kaart.dataset.status !== "te_koop" || !kaart.dataset.slug) return;
    const strook = document.createElement("div");
    strook.className = "oa-strook";
    const knoppie = document.createElement("button");
    knoppie.type = "button";
    knoppie.className = "oa-knoppie";
    knoppie.textContent = knoppie_teks();
    knoppie.addEventListener("click", () => maak_oop(kaart.dataset.slug, knoppie));
    strook.appendChild(knoppie);
    kaart.appendChild(strook);
    if (!document.getElementById("oa-basis-styl")) {
      const s = document.createElement("style");
      s.id = "oa-basis-styl";
      s.textContent = ".oa-strook{margin-top:8px}.oa-knoppie{background:#F1BD43;color:#171717;border:0;border-radius:999px;padding:7px 14px;font:600 14px Poppins,sans-serif;cursor:pointer}.oa-knoppie:hover,.oa-knoppie:focus-visible{background:#e6ad2c}";
      document.head.appendChild(s);
    }
  }

  function loop_deur() {
    document.querySelectorAll(".outeur-titel[data-slug]").forEach(voeg_knoppie_by);
  }

  const lys = document.getElementById("outeur-titels-lys");
  if (!lys) return;
  new MutationObserver(loop_deur).observe(lys, { childList: true });
  loop_deur();
})();
