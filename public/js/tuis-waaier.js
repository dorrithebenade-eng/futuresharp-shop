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
    // 'n Merkie op een taaluitgawe geld vir albei; dan kies ons die
    // uitgawe in die huidige taal.
    const taal_nou = typeof kry_huidige_taal === "function" ? kry_huidige_taal() : "af";
    const per_slug = new Map(met_omslag.map((p) => [p.slug, p]));
    const gemerk = met_omslag.filter((p) => {
      const e = p.eweknie_slug && per_slug.get(p.eweknie_slug);
      const merk = p.op_tuisblad === true || (e && e.op_tuisblad === true);
      const in_taal = !p.taal || p.taal === taal_nou || !e;
      return merk && in_taal;
    });
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

  // VASTE KEUSE (November 2026): as personeel in die paneel 'n boek vir
  // links, middel en regs gekies het, lê presies daardie drie so. 'n Boek
  // word in die huidige taal gewys as sy eweknie in daardie taal bestaan.
  function vaste_keuse(produkte, band) {
    if (!band || !band.links || !band.middel || !band.regs) return null;
    const taal = typeof kry_huidige_taal === "function" ? kry_huidige_taal() : "af";
    const per_slug = new Map(produkte.map((p) => [p.slug, p]));
    const kry = (slug) => {
      const p = per_slug.get(slug);
      if (!p) return null;
      const e = p.eweknie_slug && per_slug.get(p.eweknie_slug);
      const keuse = p.taal && p.taal !== taal && e && e.taal === taal ? e : p;
      return keuse.omslag ? keuse : null;
    };
    const drie = [kry(band.links), kry(band.middel), kry(band.regs)];
    return drie.every(Boolean) ? drie : null;
  }

  Promise.all([
    fetch("/.netlify/functions/kry-katalogus").then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch("/.netlify/functions/kry-afdelings").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ])
    .then(([data, afd]) => {
      const produkte = data.produkte || [];
      teken(vaste_keuse(produkte, afd.band) || kies(produkte));
    })
    .catch(() => { /* die band werk sonder omslae */ });
})();
