// public/js/nav-rekening.js
//
// Wys 'n toepaslike rekening-skakel in die nav, gebaseer op wie
// aangemeld is (indien enigiemand):
//   - Niemand aangemeld nie   -> "Meld aan" (aanmeld.html)
//   - Koper aangemeld         -> "My Boeke" (my-boeke.html)
//   - Personeel aangemeld     -> "Paneelbord" (paneelbord.html)
//
// Vereis dat identiteit.js reeds op dieselfde bladsy gelaai is (vir
// identiteit_kry_huidige_sessie en identiteit_het_rol). Vereis 'n
// plekhouer-element in die mini-kop: <span id="nav-rekening-plek"></span>

(async function () {
  const plek = document.getElementById("nav-rekening-plek");
  if (!plek) return;

  let sessie = null;
  try {
    sessie = await identiteit_kry_huidige_sessie();
  } catch {
    sessie = null;
  }

  let skakel_html;
  if (!sessie) {
    skakel_html = `<a href="aanmeld.html" class="mini-kop-rekening">Meld aan</a>`;
  } else if (identiteit_het_rol(sessie.gebruiker, "personeel")) {
    skakel_html = `<a href="paneelbord.html" class="mini-kop-rekening">Paneelbord</a>`;
  } else {
    skakel_html = `<a href="my-boeke.html" class="mini-kop-rekening">My Boeke</a>`;
  }

  plek.innerHTML = skakel_html;
})();
