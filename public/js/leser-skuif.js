// leser-skuif.js — skuifbalk onderaan die leser (November 2026), soos Kindle.
//
// Sleep wys 'n borrel met die bladsynommer; die bladsy self verander eers
// wanneer die leser los ("change"), sodat PDF.js nie elke tussenbladsy
// teken nie. Links staan die persentasie gelees, regs hoeveel bladsye oor is.
//
// Laai NA leser.js. leser.js se wys_voortgang() roep
// window.leser_skuif_werk_by() by elke bladsywissel, en hierdie lêer roep
// leser.js se wys_bladsy() wanneer die skuifbalk losgelaat word. Geld vir
// leser.html (kopers) en paneel-leser.html (admin).

(function () {
  const skuif = document.getElementById("leser-skuif");
  const borrel = document.getElementById("leser-skuif-borrel");
  const persentasie_el = document.getElementById("leser-persentasie");
  const oor_el = document.getElementById("leser-bladsye-oor");
  if (!skuif) return;

  const vertaal = (sleutel, terugval) => (window.t ? window.t(sleutel) : terugval);
  skuif.setAttribute("aria-label", vertaal("leser_skuif_etiket", "Gaan na bladsy"));

  let sleep_besig = false;

  // Die borrel staan bo die knop. Die knop beweeg nie van rand tot rand nie
  // (sy eie breedte sit aan weerskante), daarom die regstelling van 9px.
  function plaas_borrel(bladsy, totaal) {
    const verhouding = totaal > 1 ? (bladsy - 1) / (totaal - 1) : 0;
    borrel.style.left = `calc(${verhouding * 100}% + ${(0.5 - verhouding) * 18}px)`;
    borrel.textContent = `${vertaal("mb_bladsy_kort", "bl.")} ${bladsy}`;
  }

  function skryf_syfers(bladsy, totaal) {
    if (!totaal) return;
    persentasie_el.textContent = `${Math.round((bladsy / totaal) * 100)}%`;
    const oor = totaal - bladsy;
    oor_el.textContent = `${oor} ${oor === 1 ? vertaal("leser_bladsy_oor", "bladsy oor") : vertaal("leser_bladsye_oor", "bladsye oor")}`;
  }

  window.leser_skuif_werk_by = function (bladsy, totaal) {
    if (!totaal) return;
    skuif.max = String(totaal);
    if (!sleep_besig) skuif.value = String(bladsy);
    skuif.setAttribute("aria-valuetext", `${vertaal("mb_bladsy_kort", "bl.")} ${bladsy} / ${totaal}`);
    skryf_syfers(bladsy, totaal);
  };

  skuif.addEventListener("input", () => {
    sleep_besig = true;
    const bladsy = Number(skuif.value);
    const totaal = Number(skuif.max);
    plaas_borrel(bladsy, totaal);
    borrel.classList.add("leser-skuif-borrel-sigbaar");
    skryf_syfers(bladsy, totaal);
  });

  skuif.addEventListener("change", () => {
    sleep_besig = false;
    borrel.classList.remove("leser-skuif-borrel-sigbaar");
    if (typeof wys_bladsy === "function") wys_bladsy(Number(skuif.value));
  });
})();
