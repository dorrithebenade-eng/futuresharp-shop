// fst-pil.js — FutureSharp Talks se twee ingange op die winkelfront.
//
// 1. Die pil in die kop: vooraan in .mini-kop-regs, net die vyf blokkies op
//    die goue lyn. Op 'n foon skuif dit saam met die res van die kop agter
//    die hamburger in.
// 2. (Afgehaal 3 Nov 2026) Die aankondigingspil bo-aan die teal-band.
//
// Loop SINCHROON (nie by DOMContentLoaded nie) en moet VOOR nav-rekening.js
// laai, sodat die kop-pil reeds daar is wanneer die mobiele kieslys dit
// saamneem. Na taal.js, vir die taal van "Nuut".

(function fst_pil() {
  const blokke =
    '<span class="fst-winkel-pil-blokwrap"><span class="fst-winkel-pil-blokke">' +
    '<b class="fst-wp-t">T</b><b class="fst-wp-g">A</b><b class="fst-wp-k">L</b><b class="fst-wp-t">K</b><b class="fst-wp-g">S</b>' +
    '</span><span class="fst-winkel-pil-vloer"></span></span>';

  const regs = document.querySelector(".mini-kop-regs");
  if (regs && !regs.querySelector(".fst-winkel-pil")) {
    const pil = document.createElement("a");
    pil.className = "fst-winkel-pil";
    pil.href = "/talks";
    pil.setAttribute("aria-label", "FutureSharp Talks");
    pil.innerHTML = '<span class="fst-winkel-pil-naam">FutureSharp</span>' + blokke;
    regs.insertBefore(pil, regs.firstChild);
  }

  // Die aankondigingspil ("Nuut" bo-aan die teal-band) is op 3 November
  // 2026 afgehaal. Die pil in die kop bly.
})();
