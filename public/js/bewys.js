// public/js/bewys.js
// Weergawe 1 (28 September 2026).
//
// Gedeelde knoppie vir bewyse: by 'n toekenning se kontrolelys, by 'n
// joernaalinskrywing, en by 'n toegewysde bankreel. Voorvoegsel `bw_`.
//
// DIE KNOPPIE BIED 'N KEUSE. Die leerveld het geen `capture` nie, dus vra 'n
// foon self: neem 'n foto, kies uit die fotobiblioteek, of kies 'n leer. 'n
// PDF wat die foon se skandeerder gemaak het, gaan so deur.
//
// FOTO'S WORD IN DIE BLAAIER VERKLEIN (hoogstens 2000 pixels, JPG). Een foto
// bly 'n JPG; meer as een word een PDF, een foto per bladsy. Ander leers
// (PDF, Word, Excel) gaan onveranderd deur, elk apart. Die herkodering laat
// ook die foto se ligging (EXIF) weg.
//
// pdf-lib WORD LUI GELAAI, eers wanneer meer as een foto gekies is. Laai dit
// nie, gaan die foto's elk as 'n aparte JPG deur eerder as glad nie.
//
// Die bediener se grens bly 4 MB per leer (_bewysstukke.js). Is die PDF
// groter, word die foto's kleiner gemaak en weer probeer.

(function () {
  "use strict";

  const PDFLIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
  const MAKS = 4 * 1024 * 1024;
  const AANVAAR = "image/*,.pdf,.doc,.docx,.xls,.xlsx";
  const STAPPE = [[2000, 0.82], [1600, 0.72], [1200, 0.62], [1000, 0.55]];
  const ANDER = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  const BEELD_UITBR = /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i;

  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }
  function ontsnap(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* === die knoppie en die lys === */

  // `data` is die data-eienskappe van die invoerveld, reeds ontsnap.
  function knoppie(data, etiket) {
    return `<label class="tk-laai bw-knop" title="${ontsnap(t("bw_wenk", ""))}">${
      ontsnap(etiket || t("bw_bewys", "Bewys"))}<input type="file" hidden multiple accept="${AANVAAR}" ${data}></label>`;
  }

  // Die bewyse as name om af te laai, elk met 'n x om te verwyder. `eienaar`
  // gaan as data-bw-eienaar saam, sodat die bladsy weet waaraan dit behoort.
  function lys(dokumente, eienaar, klas) {
    const doks = Array.isArray(dokumente) ? dokumente : [];
    if (!doks.length) return "";
    return `<div class="tk-doks ${klas || ""}">${doks.map((d) => `<span class="tk-dok">
      <button type="button" class="tk-dok-naam" data-bw-af="${ontsnap(d.sleutel)}" data-bw-naam="${ontsnap(d.naam)}" title="${ontsnap(t("bw_af", "Laai af"))}">${ontsnap(d.naam)}</button>
      <button type="button" class="tk-dok-weg" data-bw-weg="${ontsnap(d.sleutel)}" data-bw-eienaar="${ontsnap(eienaar)}" aria-label="${ontsnap(t("bw_verwyder", "Verwyder"))}">&#215;</button>
    </span>`).join("")}</div>`;
  }

  /* === foto's === */

  function is_beeld(leer) {
    return /^image\//.test(leer.type || "") || BEELD_UITBR.test(leer.name || "");
  }

  function stempel() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}`;
  }

  // 'n Foon gee 'n kamerafoto 'n naam soos image.jpg of IMG_4521.JPG; dan is
  // 'n datum nuttiger. 'n Eie naam (Afrihost-kwitansie.png) bly staan.
  function foto_naam(leer) {
    const basis = String(leer.name || "").replace(/\.[^.]+$/, "");
    if (!basis || /^(image|img|photo|pxl|dsc|screenshot|\d)/i.test(basis)) {
      return `${t("bw_foto_naam", "Foto")} ${stempel()}.jpg`;
    }
    return basis + ".jpg";
  }

  async function lees_beeld(leer) {
    const url = URL.createObjectURL(leer);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(t("bw_foto_lees", "Kon nie die foto {n} lees nie. Kies dit as JPG of PDF.").replace("{n}", leer.name || ""));
    }
    return { img, url };
  }

  function na_jpg(img, maks, kwaliteit) {
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    const skaal = Math.min(1, maks / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * skaal));
    const h = Math.max(1, Math.round(h0 * skaal));
    const doek = document.createElement("canvas");
    doek.width = w;
    doek.height = h;
    const ks = doek.getContext("2d");
    ks.fillStyle = "#fff";            // 'n deursigtige PNG word nie swart nie
    ks.fillRect(0, 0, w, h);
    ks.drawImage(img, 0, 0, w, h);
    return new Promise((ja, nee) => doek.toBlob(
      (b) => (b ? ja({ blob: b, w, h }) : nee(new Error("toBlob"))), "image/jpeg", kwaliteit));
  }

  function laai_pdflib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    return new Promise((ja, nee) => {
      const s = document.createElement("script");
      s.src = PDFLIB;
      s.onload = () => (window.PDFLib ? ja(window.PDFLib) : nee(new Error("pdf-lib")));
      s.onerror = () => nee(new Error("pdf-lib"));
      document.head.appendChild(s);
    });
  }

  async function een_jpg(img) {
    for (const [maks, kw] of STAPPE) {
      const uit = await na_jpg(img, maks, kw);
      if (uit.blob.size <= MAKS) return uit.blob;
    }
    throw new Error(t("bw_foto_groot", "Die foto's is selfs verklein groter as 4 MB. Laai minder op 'n slag op."));
  }

  async function een_pdf(beelde) {
    const PDFLib = await laai_pdflib();
    for (const [maks, kw] of STAPPE) {
      const doc = await PDFLib.PDFDocument.create();
      for (const img of beelde) {
        const { blob, w, h } = await na_jpg(img, maks, kw);
        const jpg = await doc.embedJpg(await blob.arrayBuffer());
        // A4-breedte; die hoogte volg die foto, sodat 'n lang strokie heel bly.
        const bw = 595.28;
        const bh = (bw * h) / w;
        doc.addPage([bw, bh]).drawImage(jpg, { x: 0, y: 0, width: bw, height: bh });
      }
      const pdf = new Blob([await doc.save()], { type: "application/pdf" });
      if (pdf.size <= MAKS) return pdf;
    }
    throw new Error(t("bw_foto_groot", "Die foto's is selfs verklein groter as 4 MB. Laai minder op 'n slag op."));
  }

  function na_base64(blob) {
    return new Promise((ja, nee) => {
      const r = new FileReader();
      r.onload = () => ja(String(r.result).split(",")[1] || "");
      r.onerror = () => nee(new Error(t("tk_dok_lees", "Kon nie die lêer lees nie.")));
      r.readAsDataURL(blob);
    });
  }

  /* === berei voor en laai op === */

  // Gee [{ naam, inhoud_tipe, blob }]: die foto's as een JPG of een PDF, en
  // elke ander leer apart.
  async function berei(leers) {
    const lys_in = Array.from(leers || []);
    const fotos = lys_in.filter(is_beeld);
    const ander = lys_in.filter((l) => !is_beeld(l));
    const uit = [];

    for (const l of ander) {
      const uitbr = (String(l.name || "").match(/\.([^.]+)$/) || [])[1];
      const tipe = ANDER[String(uitbr || "").toLowerCase()];
      if (!tipe) throw new Error(t("bw_tipe", "{n}: net PDF, foto, Word of Excel word aanvaar.").replace("{n}", l.name || ""));
      if (l.size > MAKS) throw new Error(t("bw_groot", "{n} is groter as 4 MB. Maak dit eers kleiner.").replace("{n}", l.name || ""));
      uit.push({ naam: l.name, inhoud_tipe: tipe, blob: l });
    }

    if (!fotos.length) return uit;

    const gelees = [];
    try {
      for (const l of fotos) gelees.push(await lees_beeld(l));
      if (fotos.length === 1) {
        uit.push({ naam: foto_naam(fotos[0]), inhoud_tipe: "image/jpeg", blob: await een_jpg(gelees[0].img) });
      } else {
        let pdf = null;
        try {
          pdf = await een_pdf(gelees.map((g) => g.img));
        } catch (fout) {
          if (fout && fout.message !== "pdf-lib") throw fout;
          console.error("pdf-lib het nie gelaai nie; die foto's gaan apart:", fout);
        }
        if (pdf) {
          uit.push({ naam: `${t("bw_fotos_naam", "Foto's")} ${stempel()}.pdf`, inhoud_tipe: "application/pdf", blob: pdf });
        } else {
          for (let i = 0; i < fotos.length; i++) {
            uit.push({ naam: foto_naam(fotos[i]).replace(/\.jpg$/, ` (${i + 1}).jpg`), inhoud_tipe: "image/jpeg", blob: await een_jpg(gelees[i].img) });
          }
        }
      }
    } finally {
      gelees.forEach((g) => URL.revokeObjectURL(g.url));
    }
    return uit;
  }

  // Laai elke voorbereide leer op met `basis` ({ toekenning, item } of
  // { inskrywing }). Gee die laaste antwoord van die bediener terug.
  async function laai_op(basis, leers) {
    const klaar = await berei(leers);
    let laaste = null;
    for (const l of klaar) {
      const resp = await fetch("/.netlify/functions/laai-bewys-op", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await identiteit_kop()) },
        body: JSON.stringify({ ...basis, leernaam: l.naam, inhoud_tipe: l.inhoud_tipe, data_base64: await na_base64(l.blob) }),
      });
      if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
      laaste = await resp.json();
    }
    return laaste;
  }

  async function skrap(basis, sleutel) {
    const resp = await fetch("/.netlify/functions/skrap-bewys", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await identiteit_kop()) },
      body: JSON.stringify({ ...basis, sleutel }),
    });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    return resp.json();
  }

  async function laai_af(sleutel, naam) {
    const resp = await fetch("/.netlify/functions/kry-bewys?sleutel=" + encodeURIComponent(sleutel),
      { headers: await identiteit_kop() });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
    const blob = await resp.blob();
    if (typeof window.jn_stuur_af === "function") { window.jn_stuur_af(blob, naam); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = naam;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.bw_knoppie = knoppie;
  window.bw_lys = lys;
  window.bw_berei = berei;
  window.bw_laai_op = laai_op;
  window.bw_skrap = skrap;
  window.bw_laai_af = laai_af;
  window.BW_AANVAAR = AANVAAR;
})();
