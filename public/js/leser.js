// public/js/leser.js
//
// Kry 'n kort-leeftyd leestoken (kry-leser-token.js, met 'n regte
// Bearer-versoek), en wys dan die <iframe> direk na
// kry-eboek-inhoud.js met daardie token in die URL. Die iframe self
// (nie hierdie skrip nie) laai die PDF — die blaaier se ingeboude
// PDF-bekyker vra self die inhoud stuk-vir-stuk aan via HTTP
// Range-versoeke, wat nodig is vir groter e-boeke (sien nota in
// kry-eboek-inhoud.js).
//
// Vereis identiteit.js reeds gelaai. Lees die produk-slug uit die
// "?boek="-URL-parameter (sien my-boeke.js se skakel-konstruksie).

function wys_status(teks) {
  const el = document.getElementById("leser-status");
  if (el) el.textContent = teks;
}

async function kry_boek_titel(sessie, produk_slug) {
  try {
    const resp = await fetch("/.netlify/functions/kry-my-boeke", {
      headers: { Authorization: `Bearer ${sessie.access_token}` },
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    const gevind = (data.boeke || []).find((b) => b.produk_slug === produk_slug);
    return gevind ? gevind.titel : "";
  } catch {
    return "";
  }
}

async function laai_leser() {
  const parms = new URLSearchParams(window.location.search);
  const produk_slug = parms.get("boek");

  if (!produk_slug) {
    wys_status(window.t ? window.t("leser_geen_boek") : "Geen boek gespesifiseer nie.");
    return;
  }

  const sessie = await identiteit_kry_huidige_sessie();
  if (!sessie || !sessie.access_token) {
    window.location.href = `/aanmeld.html?terug=${encodeURIComponent(
      `/leser.html?boek=${produk_slug}`
    )}`;
    return;
  }

  wys_status(window.t ? window.t("leser_laai_tans") : "Jou boek word gelaai...");

  kry_boek_titel(sessie, produk_slug).then((titel) => {
    if (titel) document.getElementById("leser-titel").textContent = titel;
  });

  try {
    const token_resp = await fetch(
      `/.netlify/functions/kry-leser-token?produk_slug=${encodeURIComponent(produk_slug)}`,
      { method: "POST", headers: { Authorization: `Bearer ${sessie.access_token}` } }
    );

    if (token_resp.status === 401) {
      wys_status(window.t ? window.t("sessie_verval") : "Jou sessie het verval — meld gerus weer aan.");
      return;
    }
    if (!token_resp.ok) {
      throw new Error(`Onverwagte status: ${token_resp.status}`);
    }

    const { token } = await token_resp.json();

    // Die iframe se src word DIREK na die Function gewys (nie via 'n
    // fetch()+blob-URL nie) — sodat die blaaier se eie PDF-bekyker die
    // groot-lêer-Range-versoeke self hanteer.
    const raam = document.getElementById("leser-raam");
    raam.src = `/.netlify/functions/kry-eboek-inhoud?produk_slug=${encodeURIComponent(
      produk_slug
    )}&token=${encodeURIComponent(token)}`;
    raam.hidden = false;
    wys_status("");
  } catch (fout) {
    console.error("Kon nie e-boek laai nie:", fout);
    wys_status(window.t ? window.t("leser_fout") : "Kon nie jou boek laai nie — probeer later weer.");
  }
}

document.addEventListener("DOMContentLoaded", laai_leser);
