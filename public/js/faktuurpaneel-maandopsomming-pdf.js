// public/js/faktuurpaneel-maandopsomming-pdf.js
// Weergawe 1 (16 Oktober 2026).
//
// Die knoppie "Laai boekjaar af (PDF)" in die Maandopsomming.
//
// DIE SYFERS KOM UIT window.MS_PDF_VRAG, wat faktuurpaneel-maandopsomming.js
// aan die einde van elke tekening bou. Hierdie leer bereken niks; dit stuur
// die rye na kry-maandopsomming-pdf en bied die PDF as aflaai aan, soos
// faktuurpaneel-staat-pdf.js dit vir die staat doen.

(function () {
  "use strict";

  const KNOPPIE = "ms-boekjaar-pdf";

  function t(sleutel, verstek) {
    const uit = window.t ? window.t(sleutel) : null;
    return uit && uit !== sleutel ? uit : verstek;
  }

  async function laai_af() {
    const knop = document.getElementById(KNOPPIE);
    const vrag = window.MS_PDF_VRAG;
    if (!vrag || !vrag.rye || !vrag.rye.length) {
      window.alert(t("ms_pdf_geen", "Kies eers 'n boekjaar."));
      return;
    }
    const ou = knop ? knop.textContent : "";
    if (knop) { knop.disabled = true; knop.textContent = t("ms_pdf_besig", "Word gebou …"); }
    try {
      const resp = await fetch("/.netlify/functions/kry-maandopsomming-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await identiteit_kop()) },
        body: JSON.stringify(vrag),
      });
      if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || String(resp.status));
      const uit = await resp.json();
      const grepe = Uint8Array.from(atob(uit.pdf), (c) => c.charCodeAt(0));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([grepe], { type: "application/pdf" }));
      a.download = uit.naam || "maandopsomming.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (fout) {
      console.error("Kon nie die maandopsomming as PDF bou nie:", fout);
      window.alert(t("ms_pdf_fout", "Kon nie die PDF bou nie.") + " " + (fout.message || ""));
    } finally {
      if (knop) { knop.disabled = false; knop.textContent = ou; }
    }
  }

  document.addEventListener("click", (e) => {
    if (e.target && e.target.closest && e.target.closest("#" + KNOPPIE)) laai_af();
  });
})();
