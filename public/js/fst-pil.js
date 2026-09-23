// fst-pil.js — die FutureSharp Talks-pil in die winkel se kop.
//
// Sit 'n skakel na /talks vooraan in .mini-kop-regs: die woord FutureSharp
// met die vyf gekleurde blokkies op die goue lyn, soos die FST-woordmerk.
// Loop SINCHROON (nie by DOMContentLoaded nie) en moet VOOR nav-rekening.js
// laai, sodat die pil reeds in die kop is wanneer die mobiele kieslys dit
// saamneem.

(function fst_pil() {
  const regs = document.querySelector(".mini-kop-regs");
  if (!regs || regs.querySelector(".fst-winkel-pil")) return;
  const pil = document.createElement("a");
  pil.className = "fst-winkel-pil";
  pil.href = "/talks";
  pil.setAttribute("aria-label", "FutureSharp Talks");
  pil.innerHTML =
    '<span class="fst-winkel-pil-naam">FutureSharp</span>' +
    '<span class="fst-winkel-pil-blokwrap"><span class="fst-winkel-pil-blokke">' +
    '<b class="fst-wp-t">T</b><b class="fst-wp-g">A</b><b class="fst-wp-k">L</b><b class="fst-wp-t">K</b><b class="fst-wp-g">S</b>' +
    '</span><span class="fst-winkel-pil-vloer"></span></span>';
  regs.insertBefore(pil, regs.firstChild);
})();
