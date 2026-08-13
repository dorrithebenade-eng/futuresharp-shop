// public/js/outeur-deel-skakel.js
//
// Die "Kopieer skakel"-strook op elke titel in My titels, sodat 'n outeur
// sy boek se adres in 'n e-pos of WhatsApp kan plak.
//
// EIE LÊER: outeur-titels.js bou die kaart en bly onaangeraak behalwe vir
// twee data-attribute. Hierdie lêer haak by die lys in met 'n
// MutationObserver — dieselfde patroon as paneel-registers.js — sodat 'n
// verandering hier niks aan die syfers of die statusmerkie kan doen nie.
//
// DAAR IS NIKS OM TE GENEREER NIE. Die boek se bladsy is 'n gewone
// publieke adres wat bestaan sodra hy op die rak is; die knoppie kopieer
// dit net. 'n "Genereer"-knoppie sou voorgee dat daar 'n geheim agter sit.
//
// DIE STROOK VERSKYN NET BY 'n BOEK WAT TE KOOP IS. Kom die boek uit die
// winkel — gedeaktiveer, geskrap, elke formaat afgeskakel — verdwyn sy
// skakel saam met hom. 'n Grys knoppie sou niks verklaar wat die merkie
// nie reeds sê nie, en 'n skakel na 'n boek wat nie daar is nie, gee 'n
// foutbladsy vir wie ook al dit ontvang.

const ODS_TERUGVAL = {
  ods_kopieer: "Kopieer skakel",
  ods_gekopieer: "Gekopieer",
  ods_kon_nie: "Kon nie kopieer nie",
};

function ods_t(sleutel) {
  return window.t ? window.t(sleutel) : ODS_TERUGVAL[sleutel] || sleutel;
}

function ods_adres(slug) {
  return `${window.location.origin}/produk.html?produk=${encodeURIComponent(slug)}`;
}

// navigator.clipboard vereis 'n veilige konteks en misluk stil in 'n paar
// blaaiers. Die terugval merk die teks self, sodat hy dit met die hand kan
// kopieer in plaas daarvan om met 'n dooie knoppie te sit.
function ods_kopieer(knoppie, adres, adresBlok) {
  const geslaag = () => ods_wys(knoppie, "✓ " + ods_t("ods_gekopieer"), true);
  const misluk = () => {
    ods_wys(knoppie, ods_t("ods_kon_nie"), false);
    if (adresBlok && window.getSelection) {
      const reeks = document.createRange();
      reeks.selectNodeContents(adresBlok);
      const keuse = window.getSelection();
      keuse.removeAllRanges();
      keuse.addRange(reeks);
    }
  };

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    misluk();
    return;
  }
  navigator.clipboard.writeText(adres).then(geslaag, misluk);
}

function ods_wys(knoppie, teks, geslaag) {
  if (knoppie.dataset.odsBesig === "ja") return;
  const oud = knoppie.textContent;
  knoppie.dataset.odsBesig = "ja";
  knoppie.textContent = teks;
  if (geslaag) knoppie.classList.add("ods-knoppie--gekopieer");

  setTimeout(() => {
    knoppie.textContent = oud;
    knoppie.classList.remove("ods-knoppie--gekopieer");
    delete knoppie.dataset.odsBesig;
  }, 1800);
}

function ods_voeg_strook_by(kaart) {
  if (kaart.dataset.odsGedoen === "ja") return;
  kaart.dataset.odsGedoen = "ja";

  // Die kaart dra sy eie slug en status; hierdie lêer lees die antwoord
  // nie oor nie.
  if (kaart.dataset.status !== "te_koop" || !kaart.dataset.slug) return;

  const adres = ods_adres(kaart.dataset.slug);

  const strook = document.createElement("div");
  strook.className = "ods-strook";

  const knoppie = document.createElement("button");
  knoppie.type = "button";
  knoppie.className = "ods-knoppie";
  knoppie.textContent = "🔗 " + ods_t("ods_kopieer");

  const adresBlok = document.createElement("span");
  adresBlok.className = "ods-adres";
  adresBlok.textContent = adres;

  knoppie.addEventListener("click", () => ods_kopieer(knoppie, adres, adresBlok));

  strook.appendChild(knoppie);
  strook.appendChild(adresBlok);
  kaart.appendChild(strook);
}

function ods_loop_deur() {
  document.querySelectorAll(".outeur-titel[data-slug]").forEach(ods_voeg_strook_by);
}

(function ods_begin() {
  const lys = document.getElementById("outeur-titels-lys");
  if (!lys) return;

  // Die kaarte word herbou elke keer as die lys laai, dus kyk ons na die
  // houer en nie na die kaarte nie.
  new MutationObserver(ods_loop_deur).observe(lys, { childList: true });

  ods_loop_deur();
})();
