// public/js/sessie-verval.js
//
// Een plek vir die "sessie verval"-toestand.
//
// 'n Boodskap sonder 'n knoppie laat die koper op 'n doodloopstraat: hy
// lees dat hy weer moet aanmeld, maar daar is niks om te klik nie. Hierdie
// helper skryf die boodskap EN 'n aanmeldknoppie in dieselfde houer, met
// 'n "?terug="-pad sodat hy ná aanmelding weer land waar hy was.
//
// Moet VOOR die bladsy se eie skrip gelaai word, en ná taal.js.
//
// Gebruik:
//   wys_sessie_verval(document.getElementById("my-boeke-status"), "/my-boeke.html")
//
// Word die terug-pad weggelaat, gebruik dit die huidige adres met sy
// parameters — wat die leser nodig het, want ?boek= mag nie verlore gaan
// nie.

function wys_sessie_verval(houer_el, terug_pad) {
  if (!houer_el) return;

  // Vee die plaaslike sessie uit VOORDAT die knoppie gebou word.
  //
  // 'n 401 beteken die bediener het hierdie token verwerp. Plaaslik lyk
  // dit dalk nog geldig, want identiteit_kry_huidige_sessie() oordeel net
  // aan die klok (geskep_op + expires_in). aanmeld.js se
  // "reeds aangemeld"-kontrole sou dan die koper onmiddellik terugstuur na
  // die bladsy wat pas die 401 gekry het — 'n kringloop waaruit hy nie
  // kan kom nie.
  //
  // identiteit_verwyder_sessie() en nie identiteit_meld_af() nie: afmeld
  // maak ook die mandjie leeg, en 'n verwerpte token is geen rede om
  // iemand se mandjie weg te gooi nie.
  if (typeof identiteit_verwyder_sessie === "function") {
    identiteit_verwyder_sessie();
  }

  houer_el.innerHTML = "";

  const teks_el = document.createElement("p");
  // Inlyn, nie 'n klas nie: dit is een eenmalige waarde en styl.css hoef
  // nie daarvoor aangeraak te word nie. Die knoppie se eie marge kom uit
  // die bestaande .terug-skakel-knoppie.
  teks_el.style.margin = "0 0 16px";
  teks_el.textContent = window.t
    ? window.t("sessie_verval_kort")
    : "Sessie verval.";
  houer_el.appendChild(teks_el);

  const pad = terug_pad || window.location.pathname + window.location.search;

  const knoppie_el = document.createElement("a");
  knoppie_el.className = "terug-skakel-knoppie";
  knoppie_el.href = "/aanmeld.html?terug=" + encodeURIComponent(pad);
  knoppie_el.textContent = window.t
    ? window.t("meld_aan_knoppie")
    : "Meld aan";
  houer_el.appendChild(knoppie_el);
}

window.wys_sessie_verval = wys_sessie_verval;
