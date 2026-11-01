// public/js/paneel-koepon-beeld.js
//
// KOEPONBEELD (Oktober 2026). Elke koepon in die Koepons-lys kry 'n knoppie
// "Maak koeponbeeld". Dit maak 'n venster oop waar personeel kies op watter
// advertensie die koepon kom, en self die teks bepaal: wat die koepon gee en
// tot wanneer dit geldig is. Die paneel teken die beeld self op 'n canvas
// (2400 x 1260, dubbel 1200 x 630 sodat dit skerp is op WhatsApp, e-pos en
// sosiale media) en laai dit as JPG af. Geen bediener hoef te teken nie.
// Daaronder staan 'n WhatsApp-boodskap met die kode en 'n klikbare skakel,
// om saam met die beeld te stuur.
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
    { lêer: "Nuwe_Baba_AF", naam: "Wanneer ’n Nuwe Baba Kom (Afrikaans)", taal: "af" },
    { lêer: "New_Baby_EN", naam: "When a New Baby Arrives (English)", taal: "en" },
    { lêer: "Eugene_Botha_AF", naam: "Eugene Botha se boeke (Afrikaans)", taal: "af" },
    { lêer: "Eugene_Botha_EN", naam: "Eugene Botha's books (English)", taal: "en" },
    // FutureSharp Talks: donker agtergrond, die koeponblok staan elders.
    { lêer: "Talks_AF", naam: "FutureSharp Talks (Afrikaans)", taal: "af", blok: { x: 1200, y: 556, b: 660 } },
    { lêer: "Talks_EN", naam: "FutureSharp Talks (English)", taal: "en", blok: { x: 1200, y: 556, b: 660 } },
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

  // DIE GEKOSE BOEKE (November 2026). Die koeponbeeld kan die omslae wys van
  // presies die boeke wat in die koepon gekies is: een boek groot, 'n paar in
  // 'n waaier, baie in 'n rooster. Die paneel teken dit self op dieselfde
  // uitleg as die reeksadvertensies (QR-kode, koeponblok en voetstrook bly).
  // Van 'n Afrikaans-Engelse paar word net een uitgawe gewys.
  const GEKOSE = "__boek";
  const MAKS_OMSLAE = 12;

  function gekose_boeke(koepon) {
    if (koepon.formaat_beperking === "video") return null;
    const lys = typeof produkte_kas !== "undefined" ? produkte_kas : [];
    const boeke = koepon_boeke(koepon).map((s) => lys.find((x) => x.slug === s)).filter(Boolean);
    if (!boeke.length) return null;
    // Die taal van die meeste boeke; by gelykop Afrikaans.
    const en = boeke.filter((b) => b.taal === "en").length;
    const taal = en > boeke.length - en ? "en" : "af";
    // Die Afrikaanse en Engelse uitgawe van een boek: albei omslae, en die
    // titel in die taal van die advertensie.
    const paar =
      boeke.length === 2 &&
      (boeke[0].eweknie_slug === boeke[1].slug || boeke[1].eweknie_slug === boeke[0].slug);
    if (paar) boeke.sort((a, b) => ((a.taal || "af") === taal ? -1 : 1) - ((b.taal || "af") === taal ? -1 : 1));
    return { boeke, taal, paar };
  }

  function deel_titel(titel) {
    const t = String(titel || "");
    const i = t.indexOf(":");
    return i > 0 ? { reeks: t.slice(0, i).trim(), kort: t.slice(i + 1).trim() } : { reeks: "", kort: t.trim() };
  }

  // Een omslag met 'n room rand en 'n skaduwee, gedraai om sy middel.
  function teken_omslag(ctx, o, mx, my, w, hoek) {
    const h = Math.round((w * o.height) / o.width);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate((hoek * Math.PI) / 180);
    const rand = Math.max(8, Math.round(w * 0.05));
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#FAF8F0";
    ctx.fillRect(-(w + 2 * rand) / 2, -(h + 2 * rand) / 2, w + 2 * rand, h + 2 * rand);
    ctx.shadowColor = "transparent";
    ctx.drawImage(o, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // Die omslae in die linkerkantste vlak (x 40..1020, y 90..940).
  async function teken_omslae(ctx, boeke) {
    const beelde = [];
    for (const b of boeke.slice(0, MAKS_OMSLAE)) {
      if (!b.omslag) continue;
      try {
        beelde.push(await laai_beeld(b.omslag));
      } catch (_) {
        /* sonder hierdie omslag */
      }
    }
    const n = beelde.length;
    if (!n) return;
    const verhouding = beelde[0].height / beelde[0].width || 1.42;

    if (n === 1) {
      const w = Math.min(500, Math.round(780 / verhouding));
      teken_omslag(ctx, beelde[0], 560, 520, w, -4);
      return;
    }
    if (n <= 8) {
      // 'n Waaier van links na regs, soos die reeksadvertensies.
      const w = n <= 3 ? 380 : n <= 5 ? 320 : 270;
      // By twee of drie boeke oorvleuel hulle rondom die middel; meer boeke
      // vul die hele breedte.
      const span = n === 2 ? 300 : n === 3 ? 480 : 900 - w;
      const links = 545 - span / 2, regs = 545 + span / 2;
      const stap = (regs - links) / (n - 1);
      beelde.forEach((o, i) => {
        const hoek = n <= 3 ? (i - (n - 1) / 2) * 6 : -8 + (16 * i) / (n - 1);
        const my = 560 - Math.round(i * (n <= 3 ? 10 : 18));
        teken_omslag(ctx, o, links + i * stap, my, w, hoek);
      });
      return;
    }
    // 'n Rooster vir baie boeke.
    const kolomme = n <= 10 ? 5 : 4;
    const rye = Math.ceil(n / kolomme);
    const sx = kolomme === 5 ? 192 : 230;
    const w = Math.min(sx - 34, Math.floor(780 / rye / verhouding) - 20);
    const h = Math.round(w * verhouding);
    const sy = h + 36;
    const begin_y = 520 - ((rye - 1) * sy) / 2;
    beelde.forEach((o, i) => {
      const r = Math.floor(i / kolomme), k = i % kolomme;
      const in_ry = Math.min(kolomme, n - r * kolomme);
      const begin_x = 540 - ((in_ry - 1) * sx) / 2;
      teken_omslag(ctx, o, begin_x + k * sx, begin_y + r * sy, w, 0);
    });
  }

  function boek_taal(keuse) {
    return keuse && keuse.taal === "en" ? "en" : "af";
  }

  // Teken die gekose boeke se agtergrond oor die reeksadvertensie se uitleg.
  async function teken_boek_agtergrond(ctx, keuse, taal) {
    const boeke = keuse.boeke;
    const basis = await laai_beeld(`images/koepon/${taal === "en" ? "Play-Smart_series_EN" : "Speel-Slim_reeks_AF"}.jpg`);
    ctx.drawImage(basis, 0, 0, 2400, 1260);
    ctx.fillStyle = "#479F91";
    ctx.fillRect(0, 40, 1060, 935); // die reeks se omslae
    ctx.fillRect(1060, 80, 770, 490); // die reeks se opskrif

    // By 'n paar staan die uitgawe in die advertensie se taal voor.
    await teken_omslae(ctx, keuse.paar ? [...boeke].reverse() : boeke);

    // Etiket, opskrif en 'n reël daaronder.
    const dele = boeke.map((b) => deel_titel(b.titel));
    const een_reeks = dele.every((d) => d.reeks && d.reeks === dele[0].reeks);
    let etiket, opskrif, onder;
    if (boeke.length === 1 || keuse.paar) {
      etiket = dele[0].reeks || "Future Shop";
      opskrif = dele[0].kort;
      onder = keuse.paar
        ? (taal === "en" ? "In Afrikaans and English" : "In Afrikaans en Engels")
        : boeke[0].outeur || "";
    } else {
      etiket = een_reeks ? dele[0].reeks : "Future Shop";
      opskrif = taal === "en" ? `Valid on these ${boeke.length} books` : `Geldig op hierdie ${boeke.length} boeke`;
      const outeurs = [...new Set(boeke.map((b) => b.outeur).filter(Boolean))];
      onder = boeke.length <= 4 ? dele.map((d) => d.kort).join(" · ") : outeurs.length === 1 ? outeurs[0] : "";
    }
    if (onder) onder = onder.replace(/ en /, taal === "en" ? " and " : " en ");

    ctx.textBaseline = "alphabetic";
    ctx.font = "700 34px Montserrat";
    etiket = etiket.toUpperCase();
    const ew = ctx.measureText(etiket).width;
    ctx.fillStyle = "#F5C043";
    rond_reghoek(ctx, 1080, 100, ew + 52, 70, 10);
    ctx.fillStyle = "#171717";
    ctx.fillText(etiket, 1106, 148);

    const BREEDTE = 740;
    // Twee gebalanseerde reëls (die tweede kry die wit blok), so groot as
    // wat pas. Een woord bly een reël.
    const woorde = opskrif.split(/\s+/).filter(Boolean);
    const verdeel = () => {
      if (woorde.length < 2) return [opskrif];
      let beste = null;
      for (let i = 1; i < woorde.length; i++) {
        const twee = [woorde.slice(0, i).join(" "), woorde.slice(i).join(" ")];
        const wydste = Math.max(...twee.map((r) => ctx.measureText(r).width));
        if (!beste || wydste < beste.wydste) beste = { twee, wydste };
      }
      return beste.twee;
    };
    let grootte = 92, reels;
    do {
      grootte -= 4;
      ctx.font = `800 ${grootte}px Montserrat`;
      reels = verdeel();
    } while (reels.some((r) => ctx.measureText(r).width > BREEDTE - 40) && grootte > 44);
    const reel_h = Math.round(grootte * 1.28);
    let y = 205 + grootte;
    reels.forEach((r, i) => {
      const laaste = i === reels.length - 1 && reels.length > 1;
      if (laaste) {
        const rw = ctx.measureText(r).width;
        ctx.fillStyle = "#FFFFFF";
        rond_reghoek(ctx, 1072, y - grootte + 4, rw + 36, grootte + 22, 10);
        ctx.fillStyle = "#EC5832";
        ctx.fillText(r, 1090, y);
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(r, 1080, y);
      }
      y += reel_h;
    });

    if (onder) {
      let og = 36;
      ctx.font = `500 ${og}px Poppins`;
      let onder_reels = breek(ctx, onder, BREEDTE, 2);
      while (onder_reels.length > 1 && og > 26) {
        og -= 2;
        ctx.font = `500 ${og}px Poppins`;
        onder_reels = breek(ctx, onder, BREEDTE, 2);
        if (onder_reels.length === 1) break;
      }
      ctx.fillStyle = "#FFFFFF";
      const begin = Math.min(y + 10, 560 - (onder_reels.length - 1) * (og + 8));
      onder_reels.forEach((r, i) => ctx.fillText(r, 1080, begin + i * (og + 8)));
    }
  }

  function rond_reghoek(ctx, x, y, b, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + b, y, x + b, y + h, r);
    ctx.arcTo(x + b, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + b, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // Kies 'n agtergrond wat by die koepon se boeke pas.
  function stel_agtergrond_voor(koepon) {
    const boeke = koepon_boeke(koepon).map((s) => s.toLowerCase());
    // By 'n Afrikaans-Engelse paar: begin by die Afrikaanse advertensie.
    if (koepon.formaat_beperking === "video") return "Talks_AF";
    const eerste = boeke.find((s) => s.startsWith("speel-slim") || s.startsWith("n-")) || boeke[0] || "";
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
    if (koepon.formaat_beperking === "video") {
      if (koepon.tipe === "afslag") {
        const bedrag = koepon.afslag_tipe === "vaste_bedrag" ? `R${Math.round((koepon.afslag_waarde || 0) / 100)}` : `${koepon.afslag_waarde || 0}%`;
        return af ? `${bedrag} afslag op ’n FutureSharp Talk` : `${bedrag} off a FutureSharp Talk`;
      }
      return af ? "’n Gratis FutureSharp Talk" : "A free FutureSharp Talk";
    }
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
        const titel = boek_titel(boeke[0]);
        const albei = af ? "in Afrikaans en Engels" : "in Afrikaans and English";
        if (koepon.tipe === "afslag") {
          const bedrag = koepon.afslag_tipe === "vaste_bedrag"
            ? `R${Math.round((koepon.afslag_waarde || 0) / 100)}`
            : `${koepon.afslag_waarde || 0}%`;
          return af ? `${bedrag} afslag op ${titel}, ${albei}` : `${bedrag} off ${titel}, ${albei}`;
        }
        return af ? `Gratis e-boeke: ${titel}, ${albei}` : `Free e-books: ${titel}, ${albei}`;
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
      await document.fonts.load("700 34px Montserrat");
      await document.fonts.load("600 32px Poppins");
      await document.fonts.load("500 36px Poppins");
      await document.fonts.load("400 26px Poppins");
    } catch (_) {}
    if (opsies.agtergrond === GEKOSE && opsies.boek) {
      await teken_boek_agtergrond(ctx, opsies.boek, opsies.taal);
    } else {
      const agtergrond = await laai_beeld(`images/koepon/${opsies.agtergrond}.jpg`);
      ctx.drawImage(agtergrond, 0, 0, W, H);
    }

    const a = AGTERGRONDE.find((x) => x.lêer === opsies.agtergrond);
    const B = Object.assign({}, KOEPON_BLOK, (a && a.blok) || {});
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

  // Die WhatsApp-boodskap wat saam met die beeld gestuur word. Die skakel
  // in die teks is in WhatsApp klikbaar, anders as die QR-kode op die beeld
  // (wat iemand nie met sy eie foon van sy eie skerm kan skandeer nie).
  function stel_boodskap_voor(kode, aanbod, geldig, taal, is_talk) {
    const winkel = is_talk ? "https://futuresharp.co.za/talks" : "https://futureshop.futuresharp.co.za";
    const waar = is_talk ? "FutureSharp Talks" : "Future Shop";
    const kies = is_talk
      ? (taal === "en" ? "Choose the talk and enter the code when you pay." : "Kies die talk en tik die kode in wanneer jy betaal.")
      : (taal === "en" ? "Choose the book, go to your cart and enter the code when you pay." : "Kies die boek, gaan na jou mandjie en tik die kode in wanneer jy betaal.");
    const klein = String(aanbod || "").replace(/^’n Gratis/, "’n gratis").replace(/^A free/, "a free");
    if (taal === "en") {
      return [
        `A gift for you! 🎁 Here's a voucher${klein ? ` for ${klein}` : ""} at ${is_talk ? "" : "the "}${waar}.`,
        `Your code: *${kode}*`,
        `${kies}${geldig ? ` ${geldig}.` : ""}`,
        winkel,
      ].join("\n");
    }
    return [
      `’n Geskenk vir jou! 🎁 Hier is ’n koepon${klein ? ` vir ${klein}` : ""} by ${is_talk ? "" : "die "}${waar}.`,
      `Jou kode: *${kode}*`,
      `${kies}${geldig ? ` ${geldig}.` : ""}`,
      winkel,
    ].join("\n");
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
              <button type="button" class="kaart-aksie" id="kb-deel">📲 Deel</button>
              <button type="button" class="kaart-aksie" id="kb-aflaai">Laai beeld af</button>
              <span class="kb-wenk" id="kb-deel-status" role="status"></span>
            </div>
            <label class="veld-etiket" for="kb-boodskap">WhatsApp-boodskap</label>
            <textarea id="kb-boodskap" class="veld-invoer" rows="6"></textarea>
            <p class="kb-wenk">Stuur eers die beeld, en plak dan hierdie boodskap as onderskrif. Die skakel word in WhatsApp klikbaar, en *sterretjies* maak die kode vet.</p>
            <div class="kb-knoppies">
              <button type="button" class="kaart-aksie" id="kb-kopieer">Kopieer boodskap</button>
              <span class="kb-wenk" id="kb-kopieer-status" role="status"></span>
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
      boodskap_self_verander = false;
      werk_boodskap_by();
      herteken();
    });
    venster.querySelector("#kb-aanbod").addEventListener("input", () => { herteken_later(); werk_boodskap_by(); });
    venster.querySelector("#kb-geldig").addEventListener("input", () => { herteken_later(); werk_boodskap_by(); });
    venster.querySelector("#kb-aflaai").addEventListener("click", laai_af);
    venster.querySelector("#kb-deel").addEventListener("click", deel);
    venster.querySelector("#kb-boodskap").addEventListener("input", () => { boodskap_self_verander = true; });
    venster.querySelector("#kb-kopieer").addEventListener("click", kopieer_boodskap);
  }

  let huidige_koepon = null;
  let huidige_boek = null;
  let wag = null;
  let boodskap_self_verander = false;

  function werk_boodskap_by() {
    if (!huidige_koepon || boodskap_self_verander) return;
    venster.querySelector("#kb-boodskap").value = stel_boodskap_voor(
      huidige_koepon.kode,
      venster.querySelector("#kb-aanbod").value.trim(),
      venster.querySelector("#kb-geldig").value.trim(),
      huidige_taal(),
      huidige_koepon.formaat_beperking === "video"
    );
  }

  async function kopieer_boodskap() {
    const veld = venster.querySelector("#kb-boodskap");
    const status = venster.querySelector("#kb-kopieer-status");
    try {
      await navigator.clipboard.writeText(veld.value);
      status.textContent = "Gekopieer ✓";
    } catch (_) {
      veld.focus();
      veld.select();
      status.textContent = "Druk Ctrl+C om te kopieer";
    }
    setTimeout(() => { status.textContent = ""; }, 3000);
  }

  function huidige_taal() {
    if (venster.querySelector("#kb-agtergrond").value === GEKOSE) return boek_taal(huidige_boek);
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
        boek: huidige_boek,
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

  // Deel die beeld en die boodskap met die foon se deel-venster. Die lêer word
  // sonder wag uit die canvas gebou, want die blaaier laat net deel toe binne
  // die tik self. Die boodskap word ook gekopieer: sommige fone (veral iPhone
  // na WhatsApp) laat die teks val as daar 'n prent by is.
  function deel() {
    const canvas = venster.querySelector("#kb-canvas");
    const status = venster.querySelector("#kb-deel-status");
    const teks = venster.querySelector("#kb-boodskap").value || "";
    const data = atob(canvas.toDataURL("image/jpeg", 0.9).split(",")[1]);
    const grepe = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) grepe[i] = data.charCodeAt(i);
    const lêer = new File([grepe], `koepon-${huidige_koepon.kode}.jpg`, { type: "image/jpeg" });

    if (teks && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(teks).catch(() => {});

    let kan = false;
    try { kan = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [lêer] })); } catch (_) { kan = false; }
    if (kan) {
      navigator.share({ files: [lêer], text: teks })
        .then(() => { status.textContent = "Gedeel. Die boodskap is ook gekopieer."; })
        .catch((e) => { if (!e || e.name !== "AbortError") status.textContent = "Kon nie deel nie."; });
      return;
    }
    laai_af();
    status.textContent = teks ? "Beeld afgelaai en boodskap gekopieer." : "Beeld afgelaai.";
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
    huidige_boek = gekose_boeke(koepon);
    venster.querySelector("#kb-titel").textContent = `Koeponbeeld: ${koepon.kode}`;
    const kies = venster.querySelector("#kb-agtergrond");
    kies.innerHTML =
      (huidige_boek
        ? `<option value="${GEKOSE}">${huidige_boek.boeke.length === 1
            ? `Net hierdie boek: ${ontsnap(huidige_boek.boeke[0].titel)}`
            : huidige_boek.paar
            ? `Hierdie boek in Afrikaans en Engels: ${ontsnap(huidige_boek.boeke[0].titel)}`
            : `Die gekose boeke (${huidige_boek.boeke.length})`}</option>`
        : "") +
      AGTERGRONDE.map((a) => `<option value="${a.lêer}">${ontsnap(a.naam)}</option>`).join("");
    kies.value = huidige_boek ? GEKOSE : stel_agtergrond_voor(koepon);
    const taal = huidige_taal();
    venster.querySelector("#kb-aanbod").value = stel_aanbod_voor(koepon, taal);
    venster.querySelector("#kb-geldig").value = stel_geldig_voor(koepon, taal);
    boodskap_self_verander = false;
    werk_boodskap_by();
    venster.querySelector("#kb-kopieer-status").textContent = "";
    venster.hidden = false;
    herteken();
  };
})();
