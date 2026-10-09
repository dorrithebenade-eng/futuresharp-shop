// public/js/paneel-verslae-pil.js
//
// Die pil "Vraelyste en verslae" in die area-ry bo-aan die drie paneelbladsye
// (Admin, Boekhouding, Future Sharp). Opgestel 9 Okt 2026 in FS Integrated.
//
// 'N NUWE LÊER, NIE 'N WYSIGING NIE. paneel-area-pille.js bou die area-ry en
// bly onaangeraak; hierdie lêer wag tot die ry bestaan en voeg een pil agteraan
// by. Dieselfde patroon as die ander paneel-*-lêers.
//
// WAT DIE PIL DOEN. Hy navigeer nie: hy maak 'n ry van vier skakels onder die
// kop oop en toe, in dieselfde vorm as Boekhouding se afdelingspille. Die vier
// skakels lei na ander werwe en gaan elk in 'n nuwe oortjie oop:
//   Verslagkatalogus en Verslagpaneel  (saam, teal: die katalogus en sy admin)
//   Verslagstelsel                     (vlootblou: FSVS)
//   FS Vorms-bouer                     (koraal: die bouer)
//
// WIE DIT SIEN: net wie die rol "verslae" in Netlify Identity het. Die rol word
// uit die sessie se token gelees; wie die rol pas gekry het, moet een keer
// afmeld en weer aanmeld.
//
// DIE PIL IS NIE DIE SLOT NIE. Elkeen van die vier werwe dwing sy eie aanmelding
// af. Die pil is net 'n kortpad.

(function () {
  const ROL = "verslae";
  const SKAKELS = [
    { teks: "Verslagkatalogus", href: "https://futuresharp-katalogus.netlify.app", klas: "vv-kat" },
    { teks: "Verslagpaneel", href: "https://futuresharp-katalogus.netlify.app/admin", klas: "vv-kat" },
    null,
    { teks: "Verslagstelsel", href: "https://fsvs-987325149652.europe-west1.run.app/", klas: "vv-fsvs", een_aanmelding: true },
    null,
    { teks: "FS Vorms-bouer", href: "https://claude.ai/artifact/EEmGC9S3nnVmEtqK4ymJ91", klas: "vv-bouer" },
  ];

  // EEN AANMELDING VIR DIE VERSLAGSTELSEL (9 Okt 2026). Oorgeneem uit die
  // FSVS-gesprek se pil_verslagstelsel.js. FSVS lees die Netlify-sleutel uit
  // die #-deel van die adres (roete /sessie-netlify) en meld die persoon aan
  // sonder Google. Die #-deel gaan nie na enige bediener nie.
  //
  // Die oortjie word dadelik oopgemaak, anders keer die blaaier dit omdat die
  // sleutel eers ná 'n oomblik kom. Die sleutel kom van
  // identiteit_kry_huidige_sessie(), wat hom verfris as hy amper verval het.
  // Lukkie dit nie, gaan die skakel gewoon oop en vra FSVS self aanmelding.
  function met_aanmelding(e, adres) {
    e.preventDefault();
    const w = window.open("about:blank", "_blank");
    identiteit_kry_huidige_sessie()
      .then((sessie) => {
        const sleutel = sessie && sessie.access_token;
        const na = sleutel ? adres + "#ni=" + encodeURIComponent(sleutel) : adres;
        if (w) { w.opener = null; w.location.href = na; } else { window.location.href = na; }
      })
      .catch(() => {
        if (w) { w.opener = null; w.location.href = adres; } else { window.location.href = adres; }
      });
  }

  function bou_onderry() {
    const ry = document.createElement("nav");
    ry.id = "vv-ry";
    ry.className = "vv-ry";
    ry.setAttribute("aria-label", "Vraelyste en verslae");
    ry.hidden = true;
    for (const s of SKAKELS) {
      if (!s) {
        const skei = document.createElement("span");
        skei.className = "vv-skeier";
        skei.setAttribute("aria-hidden", "true");
        ry.appendChild(skei);
        continue;
      }
      const a = document.createElement("a");
      a.className = "vv-pil " + s.klas;
      a.href = s.href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = s.teks;
      const pyl = document.createElement("span");
      pyl.className = "vv-pyl";
      pyl.setAttribute("aria-hidden", "true");
      pyl.textContent = "↗";
      a.appendChild(pyl);
      if (s.een_aanmelding) a.addEventListener("click", (e) => met_aanmelding(e, s.href));
      ry.appendChild(a);
    }
    return ry;
  }

  // Die onderry staan direk onder die swart kop wanneer die area-ry in die kop
  // is (rekenaar), en direk onder die area-ry wanneer dié op die bladsy self
  // staan (foon). Elke keer dat dit oopgaan, word die plek weer bepaal, sodat
  // 'n venster wat tussenin smal getrek is, steeds reg lyk.
  function plaas(onderry, area) {
    const kop = document.querySelector(".mini-kop");
    if (area.classList.contains("in-kop") && kop) {
      kop.parentNode.insertBefore(onderry, kop.nextSibling);
    } else {
      area.parentNode.insertBefore(onderry, area.nextSibling);
    }
  }

  function voeg_by(area) {
    if (document.getElementById("vv-pil")) return;
    const pil = document.createElement("button");
    pil.type = "button";
    pil.id = "vv-pil";
    pil.className = "paneel-area-pil paneel-area-pil-verslae";
    pil.setAttribute("aria-expanded", "false");
    pil.setAttribute("aria-controls", "vv-ry");
    pil.textContent = "Vraelyste en verslae";
    const pyltjie = document.createElement("span");
    pyltjie.className = "vv-pyltjie";
    pyltjie.setAttribute("aria-hidden", "true");
    pyltjie.textContent = "▾";
    pil.appendChild(pyltjie);
    area.appendChild(pil);

    const onderry = bou_onderry();
    plaas(onderry, area);

    pil.addEventListener("click", () => {
      const oop = onderry.hidden;
      if (oop) plaas(onderry, area);
      onderry.hidden = !oop;
      pil.classList.toggle("oop", oop);
      pil.setAttribute("aria-expanded", String(oop));
    });
  }

  async function wag_vir_sessie() {
    const einde = Date.now() + 30000;
    while (Date.now() < einde) {
      let sessie = null;
      try {
        sessie = await identiteit_kry_huidige_sessie();
      } catch {
        sessie = null;
      }
      if (sessie && sessie.gebruiker) return sessie;
      await new Promise((r) => setTimeout(r, 400));
    }
    return null;
  }

  async function begin() {
    const sessie = await wag_vir_sessie();
    if (!sessie || !identiteit_het_rol(sessie.gebruiker, ROL)) return;

    // Die area-ry word deur paneel-area-pille.js gebou, ook eers ná die sessie.
    const nou = document.getElementById("paneel-area-kieslys");
    if (nou) { voeg_by(nou); return; }
    const kyker = new MutationObserver(() => {
      const area = document.getElementById("paneel-area-kieslys");
      if (area) { kyker.disconnect(); voeg_by(area); }
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
