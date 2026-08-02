// public/js/mandjie-opruiming.js
//
// Verwyder items uit die mandjie wat die aangemelde koper reeds besit.
//
// WAAROM DIT BESTAAN
// Die mandjie is nog altyd op dankie.html leeggemaak — ná Paystack se
// terugkeer. Maar 'n koper wat die venster toemaak, wegnavigeer, of (soos
// in toetsing gebeur het) deur 'n wagwoordherstel gaan voordat dankie.html
// laai, se mandjie word nooit leeggemaak nie. Hy sien dan 'n boek in sy
// mandjie wat reeds in My Boeke staan — en kan dit 'n tweede keer betaal.
//
// Hierdie lêer maak die opruiming padonafhanklik: dit vergelyk die mandjie
// met wat die koper werklik besit, ongeag hoe hy hier gekom het.
//
// DIE REËLS — en waarom hulle so eng is
//
//   eboek        verwyder slegs as die koper 'n PERMANENTE kopie besit.
//                NIE as hy net 'n leen het nie: die leen-na-koop-opgradering
//                (my-boeke.js) sit juis 'n eboek in die mandjie terwyl die
//                leen nog aktief is. Naïewe opruiming sou daardie hele
//                vloei breek.
//
//   leen         verwyder as hy 'n permanente kopie besit (dan is 'n leen
//                sinneloos) of reeds 'n aktiewe leen daarop het.
//
//   harde_kopie  word NOOIT verwyder nie. 'n Tweede gedrukte eksemplaar as
//                geskenk is 'n heeltemal wettige bestelling.
//
// Faal enigiets — geen sessie, geen netwerk, 'n 401 — word die mandjie
// onaangeraak gelaat. 'n Mandjie wat te veel bevat, is 'n ergernis;
// een wat stilweg items verloor, kos 'n verkoop.

(function () {
  const FUNKSIE = "/.netlify/functions/kry-my-boeke";

  async function kry_besit() {
    if (typeof identiteit_kry_huidige_sessie !== "function") return null;

    const sessie = await identiteit_kry_huidige_sessie();
    if (!sessie || !sessie.access_token) return null;

    const resp = await fetch(FUNKSIE, {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data || !Array.isArray(data.boeke)) return null;
    return data.boeke;
  }

  function bou_indeks(boeke) {
    // permanent: die koper besit die boek blywend (nie 'n leen nie)
    // aktiewe_leen: 'n leen wat nog nie verval het nie
    const permanent = new Set();
    const aktiewe_leen = new Set();

    boeke.forEach((boek) => {
      if (!boek || !boek.produk_slug) return;
      if (boek.is_leen) {
        if (boek.leen_aktief !== false) aktiewe_leen.add(boek.produk_slug);
      } else {
        permanent.add(boek.produk_slug);
      }
    });

    return { permanent, aktiewe_leen };
  }

  function moet_verwyder(item, indeks) {
    if (!item || !item.produk_slug) return false;

    if (item.formaat === "eboek") {
      return indeks.permanent.has(item.produk_slug);
    }

    if (item.formaat === "leen") {
      return (
        indeks.permanent.has(item.produk_slug) ||
        indeks.aktiewe_leen.has(item.produk_slug)
      );
    }

    // harde_kopie en enige onbekende formaat bly staan.
    return false;
  }

  async function ruim_op() {
    try {
      if (typeof kry_mandjie !== "function" || typeof stoor_mandjie !== "function") return;

      const items = kry_mandjie();
      if (!items.length) return;

      const boeke = await kry_besit();
      if (!boeke) return;

      const indeks = bou_indeks(boeke);
      const oorblywend = items.filter((item) => !moet_verwyder(item, indeks));

      if (oorblywend.length === items.length) return;

      stoor_mandjie(oorblywend);

      // Herteken die mandjie-bladsy indien ons daarop is. wys_mandjie()
      // bestaan slegs op mandjie.html (mandjie-bladsy.js).
      if (typeof wys_mandjie === "function") wys_mandjie();
    } catch (fout) {
      // Stil misluk: die mandjie bly net soos dit was.
      console.warn("Mandjie-opruiming oorgeslaan:", fout);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ruim_op);
  } else {
    ruim_op();
  }
})();
