// public/js/herstel-mandjie.js
//
// Die skakel in die mandjie-herinnering (November 2026) land hier.
//
// As die skakel nog geldig is: sit die boeke terug in die mandjie (ook op 'n
// ander toestel as waar die koper begin het), onthou die koepon wat hy self
// ingetik het, gebruik weer dieselfde bestelnommer, en stuur hom na die
// mandjie. Hy kies dan self weer hoe hy die boeke wil ontvang.
//
// Is die skakel verval of die bestelling reeds betaal, wys die bladsy 'n kort
// boodskap met een knoppie.

(async function () {
  const q = new URLSearchParams(window.location.search);
  const b = q.get("b");
  const t_param = q.get("t");

  function wys(titel_sleutel, teks_sleutel, knoppie_sleutel, href) {
    document.getElementById("herstel-titel").textContent = t(titel_sleutel);
    document.getElementById("herstel-teks").textContent = t(teks_sleutel);
    const k = document.getElementById("herstel-knoppie");
    k.textContent = t(knoppie_sleutel);
    k.href = href;
    k.hidden = false;
  }

  if (!b || !t_param) {
    wys("herstel_verval_titel", "herstel_verval_teks", "herstel_na_boeke", "boeke.html");
    return;
  }

  let data = null;
  try {
    const resp = await fetch(
      `/.netlify/functions/kry-herstel-mandjie?b=${encodeURIComponent(b)}&t=${encodeURIComponent(t_param)}`,
      { cache: "no-store" }
    );
    if (resp.ok) data = await resp.json();
  } catch (_) {
    data = null;
  }

  // Die koper lees die winkel in die taal waarin hy gekoop het. Net as hy
  // nog nooit self 'n taal gekies het nie, sodat ons nie sy keuse oorskryf nie.
  if (data && (data.taal === "af" || data.taal === "en") && !localStorage.getItem("future_shop_taal")) {
    localStorage.setItem("future_shop_taal", data.taal);
    if (typeof pas_i18n_toe === "function") pas_i18n_toe();
  }

  if (!data || data.stand === "ongeldig" || data.stand === "verval") {
    wys("herstel_verval_titel", "herstel_verval_teks", "herstel_na_boeke", "boeke.html");
    return;
  }
  if (data.stand === "betaal") {
    wys("herstel_betaal_titel", "herstel_betaal_teks", "gaan_na_my_boeke", "my-boeke.html");
    return;
  }

  // Voeg by wat nog nie in die mandjie is nie. voeg_by_mandjie() keer self
  // duplikate af, so 'n tweede klik op die skakel doen niks verkeerds nie.
  (data.items || []).forEach((item) => voeg_by_mandjie(item));

  // Die koper se eie koepon: voltooi-betaling.js lees dit en pas dit toe.
  // Die bediener kontroleer dit weer; 'n verlope aanbod word daar geweier.
  if (data.koepon) {
    localStorage.setItem("future_shop_koepon", JSON.stringify({ kode: data.koepon, op: Date.now() }));
  }

  // Dieselfde bestelnommer, sodat die paneel een bestelling wys en nie twee nie.
  if (data.bestelnommer) {
    sessionStorage.setItem("future_shop_bestelnommer_konsep", data.bestelnommer);
  }

  window.location.replace("mandjie.html");
})();
