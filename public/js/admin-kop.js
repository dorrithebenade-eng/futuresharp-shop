// public/js/admin-kop.js
//
// Ry twee van die eenvormige admin-kop. Opgestel 9 Okt 2026 in FS Integrated.
// Sien admin-kop.css vir die vorm.
//
// 'N NUWE LÊER, NIE 'N WYSIGING NIE. paneel-area-pille.js bou die area-ry en
// sit hom op 'n rekenaar in die kop en op 'n foon op die bladsy. Hierdie lêer
// skuif hom daarna altyd na 'n tweede ry onder in die kop (.ak-ry2), sodat die
// oortjies op elke skerm op dieselfde plek staan.
//
// DIE KLAS in-kop BLY OP DIE RY. paneel-verslae-pil.js lees dit om te weet dat
// sy onderry direk onder die kop hoort.
//
// DIE VOLGORDE BY 'N DRAAI VAN DIE FOON. paneel-area-pille.js luister na
// dieselfde breekpunt en skuif die ry dan terug. Ons luisteraar word eers ná
// syne geregistreer (eers wanneer die ry bestaan), dus loop ons s'n laaste en
// staan die ry weer in die kop.

(function () {
  function ry_twee() {
    const kop = document.querySelector(".mini-kop");
    if (!kop) return null;
    let ry = kop.querySelector(":scope > .ak-ry2");
    if (!ry) {
      ry = document.createElement("div");
      ry.className = "ak-ry2";
      kop.appendChild(ry);
    }
    return ry;
  }

  function plaas() {
    const area = document.getElementById("paneel-area-kieslys");
    if (!area) return false;
    const ry = ry_twee();
    if (!ry) return false;
    area.classList.add("in-kop");
    if (area.parentNode !== ry) ry.appendChild(area);
    return true;
  }

  function luister() {
    window.matchMedia("(max-width: 620px)").addEventListener("change", plaas);
  }

  function begin() {
    if (plaas()) { luister(); return; }
    const kyker = new MutationObserver(() => {
      if (plaas()) { kyker.disconnect(); luister(); }
    });
    kyker.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => kyker.disconnect(), 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin);
  } else {
    begin();
  }
})();
