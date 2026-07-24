// public/js/bevestig.js
//
// Verwerk 'n Identity-e-poslink (bevestiging Ó herstel) — GoTrue plaas die
// token in die URL-hash, bv:
//   #confirmation_token=xxxxx&type=signup   (nuwe koper-registrasie)
//   #recovery_token=xxxxx&type=recovery     (wagwoord vergeet)
//
// identiteit.js se identiteit_verwerk_token(tipe, token, nuwe_wagwoord)
// stel die wagwoord EN bevestig/herstel in dieselfde stap (so werk
// GoTrue se /verify-eindpunt).

function kry_token_uit_url() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  // confirmation_token: koper/personeel het self geregistreer en het
  // klaar 'n wagwoord by die registrasie-vorm gekies — hier hoef ons
  // net die e-pos te bevestig, nie weer vir 'n wagwoord te vra nie.
  const bevestig_token = hash.get("confirmation_token");
  if (bevestig_token) return { tipe: "signup", token: bevestig_token, benodig_wagwoord: false };

  // recovery_token: wagwoord-vergeet-vloei — wagwoord moet gestel word.
  const herstel_token = hash.get("recovery_token");
  if (herstel_token) return { tipe: "recovery", token: herstel_token, benodig_wagwoord: true };

  // invite_token: admin het die rekening geskep (bv. personeel) — die
  // gebruiker het nog nooit 'n wagwoord gehad nie, dus moet dit hier
  // gestel word.
  const uitnodig_token = hash.get("invite_token");
  if (uitnodig_token) return { tipe: "signup", token: uitnodig_token, benodig_wagwoord: true };

  return null;
}

// Sien aanmeld.js vir waarom dit in localStorage gestoor word (nie net
// 'n "?terug="-URL-parameter nie): GoTrue se e-poslinke bevat geen
// "?terug="-parameter nie, so dit sou anders verlore raak.
const TERUG_SLEUTEL = "future_shop_terug_na";

function kry_terug_pad() {
  const pad = localStorage.getItem(TERUG_SLEUTEL);
  localStorage.removeItem(TERUG_SLEUTEL);
  return pad || "/my-boeke.html";
}

function wys_boodskap(teks, is_fout) {
  const el = document.getElementById("bevestig-boodskap");
  if (!el) return;
  el.textContent = teks;
  el.classList.toggle("boodskap-fout", !!is_fout);
  el.classList.toggle("boodskap-sukses", !is_fout && !!teks);
}

function wys_ongeldige_skakel() {
  document.getElementById("bevestig-blok").hidden = true;
  document.getElementById("bevestig-fout-blok").hidden = false;
}

async function verifieer_en_herlei(tipe, token, wagwoord) {
  const sessie = await identiteit_verwerk_token(tipe, token, wagwoord);
  // Universele bestemming vir ALLE Identity-e-poslinke (koper én
  // personeel) — ná verwerking weet ons eers wie dit is, dus besluit
  // ons EERS NOU waarheen om te gaan, i.p.v. vooraf te probeer raai.
  const is_personeel = identiteit_het_rol(sessie.gebruiker, "personeel");
  window.location.href = is_personeel ? "/paneelbord.html" : kry_terug_pad();
}

const token_inligting = kry_token_uit_url();

if (!token_inligting) {
  wys_ongeldige_skakel();
} else if (!token_inligting.benodig_wagwoord) {
  // Self-registrasie: wagwoord is klaar by registrasie gekies — moenie
  // weer daarvoor vra nie, verifieer outomaties.
  document.getElementById("bevestig-blok").hidden = true;
  wys_boodskap(window.t ? window.t("bevestig_tans") : "Bevestig tans...");

  verifieer_en_herlei(token_inligting.tipe, token_inligting.token, undefined).catch((fout) => {
    document.getElementById("bevestig-blok").hidden = false;
    document.getElementById("bevestig-vorm").hidden = true;
    wys_boodskap(
      fout.message || (window.t ? window.t("bevestig_fout") : "Kon nie bevestig nie."),
      true
    );
  });
} else {
  document.getElementById("bevestig-vorm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const wagwoord = document.getElementById("bevestig-wagwoord").value;
    const knoppie = ev.target.querySelector("button[type=submit]");

    knoppie.disabled = true;
    wys_boodskap(window.t ? window.t("bevestig_tans") : "Bevestig...");

    try {
      await verifieer_en_herlei(token_inligting.tipe, token_inligting.token, wagwoord);
    } catch (fout) {
      knoppie.disabled = false;
      wys_boodskap(
        fout.message || (window.t ? window.t("bevestig_fout") : "Kon nie bevestig nie."),
        true
      );
    }
  });
}
