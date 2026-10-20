// public/js/fsp-verslag-beeld.js
//
// DIE WHATSAPP-BEELD VIR 'N VERSLAGSKAKEL (Oktober 2026). Die paneel teken die
// beeld self op 'n canvas, 1200 x 630 (die grootte wat WhatsApp en e-pos as
// groot voorskou wys), met die skool se naam en "Future Sharp Verslae" of
// "Reports". Daarna word dit as JPG gestoor; geen bediener hoef te teken nie.
//
// teken_verslag_beeld(canvas, { skool, taal: "af" | "en" | "tw" }) -> Promise

(function () {
  const NAVY = "#071630", TEAL = "#00A291", AMBER = "#FCBA10", KORAAL = "#FF491B";

  function laai(src) {
    return new Promise((ok, nee) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nee; i.src = src; });
  }

  // Breek die naam in hoogstens drie reëls en kies die grootste letter wat pas.
  function pas_naam(ctx, teks, breedte) {
    for (let grootte = 76; grootte >= 40; grootte -= 4) {
      ctx.font = "800 " + grootte + "px Montserrat";
      const woorde = teks.split(/\s+/);
      const reels = [];
      let reel = "";
      for (const w of woorde) {
        const toets = reel ? reel + " " + w : w;
        if (ctx.measureText(toets).width <= breedte) reel = toets;
        else { if (reel) reels.push(reel); reel = w; }
      }
      if (reel) reels.push(reel);
      if (reels.length <= 3 && reels.every((r) => ctx.measureText(r).width <= breedte)) return { grootte, reels };
    }
    return { grootte: 40, reels: [teks] };
  }

  async function teken(canvas, opsies) {
    const W = 1200, H = 630;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    try { await document.fonts.load("800 60px Montserrat"); await document.fonts.load("600 30px Poppins"); } catch (_) {}
    const [logo, hand] = await Promise.all([laai("images/future-sharp-logo.png"), laai("images/hand-spiraal.png")]);

    // Agtergrond
    ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);

    // Die logo op 'n wit teël met 'n dun wit rand, links.
    const lh = 400, lw = Math.round(lh * logo.width / logo.height);
    const lx = 70, ly = 62;
    ctx.fillStyle = "#fff"; ctx.fillRect(lx - 8, ly - 8, lw + 16, lh + 16);
    ctx.drawImage(logo, lx, ly, lw, lh);

    // Die teks regs van die logo
    const tx = lx + lw + 70, tw = W - tx - 70;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = AMBER;
    ctx.font = "700 26px Montserrat";
    ctx.fillText("FUTURE SHARP", tx, 120);

    const t = opsies.taal || "af";
    const etiket = t === "en" ? "Reports" : t === "tw" ? "Verslae · Reports" : "Verslae";
    ctx.font = "600 44px Poppins";
    ctx.fillStyle = "#fff";
    ctx.fillText(etiket, tx, 176);
    // Kort kleurstrepe onder die etiket, in die logo se kleure
    [[TEAL, 0], [AMBER, 74], [KORAAL, 148]].forEach(([k, x]) => { ctx.fillStyle = k; ctx.fillRect(tx + x, 198, 64, 6); });

    const { grootte, reels } = pas_naam(ctx, (opsies.skool || "").trim() || "Skool se naam", tw);
    ctx.font = "800 " + grootte + "px Montserrat";
    ctx.fillStyle = "#fff";
    const lyn = Math.round(grootte * 1.12);
    const bo = 262 + grootte * 0.8;
    reels.forEach((r, i) => ctx.fillText(r, tx, bo + i * lyn));

    // Die teal strook onder met die leuse en die hand
    const sh = 92, sy = H - sh;
    ctx.fillStyle = TEAL; ctx.fillRect(0, sy, W, sh);
    ctx.fillStyle = "#fff";
    ctx.font = "600 28px Poppins";
    const leuse = t === "en" ? "Begin with the end in mind. Enjoy the journey." : "Begin met die einde in gedagte. Geniet die reis.";
    ctx.fillText(leuse, 70, sy + 57);
    const hh = 150, hw = Math.round(hh * hand.width / hand.height);
    ctx.drawImage(hand, W - hw - 40, H - hh + 6, hw, hh);
  }

  window.teken_verslag_beeld = teken;
})();
