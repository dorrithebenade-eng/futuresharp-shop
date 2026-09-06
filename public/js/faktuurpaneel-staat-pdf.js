// public/js/faktuurpaneel-staat-pdf.js
//
// Die knoppie wat die staat as 'n PDF aflaai.
//
// 'N EIE LEER, NIE 'N TOEVOEGING TOT faktuurpaneel-fin-staat.js NIE. Daardie
// leer tel die staat op en teken hom; hierdie een stuur 'n vrag na 'n Function
// en bied 'n leer aan. Twee verskillende dinge, en die optelwerk is die deel
// wat nie gebreek mag word nie.
//
// DIE SYFERS KOM UIT FS.pdf_vrag, wat fs_teken() aan die einde van elke
// tekening bou. Hierdie leer bereken niks. Is die vrag nie daar nie, is die
// staat nog nie gewys nie, en dan is daar niks om te druk.

(function () {
  const KNOPPIE = "fs-pdf";

  function sp_t(sleutel, verstek) {
    return typeof t === "function" ? t(sleutel, verstek) : verstek;
  }

  function sp_boodskap(teks) {
    const plek = document.getElementById("fs-fout");
    if (plek) plek.textContent = teks || "";
    else if (teks) window.alert(teks);
  }

  async function sp_laai_af() {
    const knop = document.getElementById(KNOPPIE);
    const vrag = window.FS_PDF_VRAG;

    if (!vrag || !vrag.van || !vrag.tot) {
      sp_boodskap(sp_t("fs_pdf_geen", "Wys eers die staat vir 'n tydperk."));
      return;
    }

    const ou = knop ? knop.textContent : "";
    if (knop) {
      knop.disabled = true;
      knop.textContent = sp_t("fs_pdf_besig", "Word gebou \u2026");
    }
    sp_boodskap("");

    try {
      const resp = await fetch("/.netlify/functions/kry-staat-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await identiteit_kop()),
        },
        body: JSON.stringify(vrag),
      });
      if (!resp.ok) {
        const teks = await resp.text().catch(() => "");
        throw new Error(teks || String(resp.status));
      }
      const uit = await resp.json();

      // Die PDF kom as base64 saam met sy naam, sodat daar geen tweede
      // oproep is en die leer nie op die bediener hoef te bly le nie.
      const grepe = Uint8Array.from(atob(uit.pdf), (c) => c.charCodeAt(0));
      const blob = new Blob([grepe], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = uit.naam || "staat.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (fout) {
      console.error("Kon nie die staat as PDF bou nie:", fout);
      sp_boodskap(sp_t("fs_pdf_fout", "Kon nie die staat as PDF bou nie."));
    } finally {
      if (knop) {
        knop.disabled = false;
        knop.textContent = ou;
      }
    }
  }

  // DIE KNOPPIE WORD DALK NA HIERDIE LEER GETEKEN. Die paneel bou sy
  // afdelings dinamies, dus word 'n klik op die dokument opgevang in plaas
  // van op 'n element wat nog nie bestaan nie.
  document.addEventListener("click", (e) => {
    const knop = e.target && e.target.closest && e.target.closest("#" + KNOPPIE);
    if (knop) sp_laai_af();
  });
})();
