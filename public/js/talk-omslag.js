// talk-omslag.js — FutureSharp Talks: teken 'n talk se omslag op 'n canvas.
//
// 'n Suiwer tekenfunksie: dit lees geen vorm nie en stoor niks. Die
// paneelbord (paneel-talks.js) gee die gegewens en laai die uitslag op; die
// spreker se indienvorm (Fase 6) kan dieselfde funksie vir 'n voorskou
// gebruik. So bestaan die ontwerp op een plek.
//
// Die slug is die saad: dieselfde talk kry altyd dieselfde omslag, en twee
// talks in dieselfde kategorie lyk verwant maar nie identies nie.
//
// FST_KATEGORIEE moet dieselfde id's hê as _fst-kategoriee.js op die bediener.

const FST_KATEGORIEE = [
  { id: "navorsing", naam: "Navorsing", c1: "#2F6F66", c2: "#3FB6A4" },
  { id: "besigheid", naam: "Besigheid", c1: "#5A4410", c2: "#F1BD43" },
  { id: "medisyne", naam: "Medisyne", c1: "#7A2A15", c2: "#EC5832" },
  { id: "praktyk", naam: "Professionele praktyk", c1: "#26302E", c2: "#479F91" },
];

const FST_OMSLAG_BREEDTE = 1280;
const FST_OMSLAG_HOOGTE = 720;

function fst_omslag_saad(teks) {
  let h = 2166136261;
  for (const c of String(teks)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fst_omslag_draai(ctx, teks, maks_breedte) {
  const woorde = String(teks).split(/\s+/).filter(Boolean);
  const reels = [];
  let reel = "";
  for (const w of woorde) {
    const toets = reel ? `${reel} ${w}` : w;
    if (ctx.measureText(toets).width > maks_breedte && reel) {
      reels.push(reel);
      reel = w;
    } else {
      reel = toets;
    }
  }
  if (reel) reels.push(reel);
  return reels;
}

// Groot waar dit kan, kleiner waar dit moet: hoogstens drie reëls.
function fst_omslag_pas_titel(ctx, titel, maks_breedte) {
  for (const grootte of [96, 86, 76, 66, 58]) {
    ctx.font = `800 ${grootte}px Montserrat, sans-serif`;
    const reels = fst_omslag_draai(ctx, titel, maks_breedte);
    if (reels.length <= 3) return { grootte, reels };
  }
  ctx.font = "800 58px Montserrat, sans-serif";
  return { grootte: 58, reels: fst_omslag_draai(ctx, titel, maks_breedte).slice(0, 3) };
}

// Die lettertipes moet gelaai wees voordat daar geteken word, anders teken
// die canvas in 'n stelsel-lettertipe en dit word so gestoor.
async function fst_omslag_laai_lettertipes() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load("800 96px Montserrat"),
      document.fonts.load("800 20px Montserrat"),
      document.fonts.load("500 34px Poppins"),
    ]);
  } catch {
    /* teken dan maar met wat daar is */
  }
}

/**
 * Teken die omslag.
 * @param {HTMLCanvasElement} doek  word op 1280 x 720 gestel
 * @param {{titel:string, slug:string, kategoriee:string[], sprekers:string[]}} g
 */
function fst_teken_omslag(doek, g) {
  const W = FST_OMSLAG_BREEDTE, H = FST_OMSLAG_HOOGTE, M = 80;
  doek.width = W;
  doek.height = H;
  const ctx = doek.getContext("2d");

  const kategoriee = (g.kategoriee || []).map((id) => FST_KATEGORIEE.find((k) => k.id === id)).filter(Boolean);
  const kat = kategoriee[0] || FST_KATEGORIEE[0];
  const titel = String(g.titel || "").trim() || "Titel van die talk";
  const saad = fst_omslag_saad(g.slug || titel);

  // Agtergrond: die hoofkategorie se donker kleur, met 'n gloed uit sy
  // helder kleur, en 'n sagte donkerte onder sodat die teks rustig lees.
  ctx.fillStyle = kat.c1;
  ctx.fillRect(0, 0, W, H);
  const gx = W * (0.68 + ((saad >> 8) % 20) / 100);
  const gy = H * (0.12 + ((saad >> 12) % 22) / 100);
  const gloed = ctx.createRadialGradient(gx, gy, 0, gx, gy, W * 0.7);
  gloed.addColorStop(0, kat.c2 + "cc");
  gloed.addColorStop(0.55, kat.c2 + "22");
  gloed.addColorStop(1, kat.c2 + "00");
  ctx.fillStyle = gloed;
  ctx.fillRect(0, 0, W, H);
  const skaduwee = ctx.createLinearGradient(0, H * 0.35, 0, H);
  skaduwee.addColorStop(0, "rgba(0,0,0,0)");
  skaduwee.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = skaduwee;
  ctx.fillRect(0, 0, W, H);

  // Die goue lyn uit die promo.
  const hoek = -(3 + (saad % 6)) * Math.PI / 180;
  const lyn_y = H * (0.30 + ((saad >> 4) % 10) / 100);
  ctx.save();
  ctx.translate(0, lyn_y);
  ctx.rotate(hoek);
  ctx.shadowColor = "rgba(241,189,67,0.8)";
  ctx.shadowBlur = 18;
  const lyn = ctx.createLinearGradient(0, 0, W, 0);
  lyn.addColorStop(0, "rgba(241,189,67,0)");
  lyn.addColorStop(0.18, "#F1BD43");
  lyn.addColorStop(0.85, "#F1BD43");
  lyn.addColorStop(1, "rgba(241,189,67,0)");
  ctx.fillStyle = lyn;
  ctx.fillRect(-60, -2, W + 200, 4);
  ctx.restore();

  // Bo links: die kategorieë.
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "500 26px Poppins, sans-serif";
  ctx.fillText(kategoriee.map((k) => k.naam).join("  ·  "), M, M + 18);

  // Bo regs: FutureSharp met die vyf blokkies op die goue lyn.
  const blok = 30, gap = 3, wb = 5 * blok + 4 * gap, bx = W - M - wb, by = M - 12;
  const kleure = [["#479F91", "#fff"], ["#F1BD43", "#171717"], ["#EC5832", "#fff"], ["#479F91", "#fff"], ["#F1BD43", "#171717"]];
  ctx.font = "800 20px Montserrat, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "#fff";
  ctx.fillText("FutureSharp", bx - 12, by + blok - 8);
  "TALKS".split("").forEach((letter, i) => {
    const x = bx + i * (blok + gap);
    ctx.fillStyle = kleure[i][0];
    ctx.fillRect(x, by, blok, blok);
    ctx.fillStyle = kleure[i][1];
    ctx.font = "800 18px Montserrat, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, x + blok / 2, by + blok / 2 + 1);
  });
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#F1BD43";
  ctx.fillRect(bx, by + blok + 5, wb, 3);

  // Onder: die spreker(s), en die titel daarbo.
  const naam_y = H - M;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "500 34px Poppins, sans-serif";
  ctx.fillText((g.sprekers || []).filter(Boolean).join(" & "), M, naam_y);

  const { grootte, reels } = fst_omslag_pas_titel(ctx, titel, W * 0.78);
  const reel_hoogte = Math.round(grootte * 1.08);
  ctx.fillStyle = "#fff";
  const eerste_y = naam_y - 34 - 26 - (reels.length - 1) * reel_hoogte;
  reels.forEach((r, i) => ctx.fillText(r, M - 3, eerste_y + i * reel_hoogte));
}
