// public/js/tuis-waaier.js
//
// Die drie omslae in 'n waaier in die tuisblad se donker band (November
// 2026). Elke keer as die bladsy oopmaak, is dit 'n ander drie, sodat die
// tuisblad nie altyd dieselfde lyk nie en die verskeidenheid van die rak wys.
//
// WATTER BOEKE: as enige produk `op_tuisblad: true` het (die merkie "Wys op
// die tuisblad" in die paneel, fase 2), kies ons net uit daardie boeke. Tot
// dan kies ons uit al die boeke met 'n omslag in die huidige taal, en val
// terug op enige taal as daar te min is.
//
// Die waaier is versiering (aria-hidden in die HTML). Misluk die oproep,
// bly die band net sonder omslae; die teks en knoppie werk steeds.

(function () {
  const plek = document.getElementById("kop-waaier");
  if (!plek) return;

  function skommel(lys) {
    const a = lys.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function kies(produkte) {
    const met_omslag = produkte.filter((p) => p && p.omslag);
    const gemerk = met_omslag.filter((p) => p.op_tuisblad === true);
    if (gemerk.length >= 3) return skommel(gemerk).slice(0, 3);

    const taal = typeof kry_huidige_taal === "function" ? kry_huidige_taal() : "af";
    const in_taal = met_omslag.filter((p) => !p.taal || p.taal === taal);
    const poel = in_taal.length >= 3 ? in_taal : met_omslag;
    return skommel(poel).slice(0, 3);
  }

  function teken(drie) {
    if (drie.length === 0) return;
    plek.innerHTML = drie
      .map((p, i) => `<img class="kop-waaier-omslag kop-waaier-omslag--${i + 1}" src="${p.omslag}" alt="" loading="eager">`)
      .join("");
    plek.classList.add("kop-waaier--gereed");
  }

  fetch("/.netlify/functions/kry-katalogus")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => teken(kies(data.produkte || [])))
    .catch(() => { /* die band werk sonder omslae */ });
})();
