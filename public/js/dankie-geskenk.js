// dankie-geskenk.js
//
// GESKENKE (November 2026). Op die dankie-bladsy, ná 'n bestelling met
// geskenk-items: 'n blok met die geskenkkode en 'n knoppie na die
// geskenkbewys (geskenk.html?kode=…&bewys=1). Die webhook skep die kode
// eers ná die betaling, dus vra ons kry-bestelstand 'n paar keer weer as die
// kode nog nie daar is nie. Sien netlify/functions/_geskenke.js.

function dankie_wys_geskenk(u) {
  const kaart = document.getElementById("dankie-kaart");
  if (!kaart || document.getElementById("dankie-geskenk")) return;

  const blok = document.createElement("div");
  blok.id = "dankie-geskenk";
  blok.style.cssText =
    "margin:18px 0 6px;padding:16px;border-radius:12px;background:#eef7f5;border:2px dashed #479F91;text-align:left";
  const knoppies = kaart.querySelector(".dankie-knoppies");
  kaart.insertBefore(blok, knoppies || null);

  const teken = (kode) => {
    if (kode) {
      const url = `geskenk.html?kode=${encodeURIComponent(kode)}&bewys=1`;
      blok.innerHTML = `
        <div style="font-weight:700;color:#479F91">🎁 ${t("geskenk_dankie_kop")}</div>
        <div style="font-size:22px;font-weight:700;letter-spacing:2px;margin:8px 0">${kode}</div>
        <p style="margin:0 0 10px;font-size:14px">${t("geskenk_dankie_teks")}</p>
        <a class="kaart-aksie dankie-knoppie" href="${url}">${t("geskenk_wys_bewys")}</a>`;
    } else {
      blok.innerHTML = `
        <div style="font-weight:700;color:#479F91">🎁 ${t("geskenk_dankie_kop")}</div>
        <p style="margin:6px 0 0;font-size:14px">${t("geskenk_dankie_wag")}</p>`;
    }
  };
  teken(u.geskenk_kode);
  if (u.geskenk_kode) return;

  // Vra weer, tot 6 keer, elke 4 sekondes.
  const bestelnommer = new URLSearchParams(location.search).get("bestelnommer") || "";
  let pogings = 0;
  const vra = async () => {
    pogings++;
    try {
      const sessie = typeof identiteit_kry_huidige_sessie === "function" ? await identiteit_kry_huidige_sessie() : null;
      if (!sessie || !sessie.access_token || !bestelnommer) return;
      const resp = await fetch(
        "/.netlify/functions/kry-bestelstand?bestelnommer=" + encodeURIComponent(bestelnommer),
        { headers: { Authorization: `Bearer ${sessie.access_token}` } }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.geskenk_kode) return teken(data.geskenk_kode);
      }
    } catch (_) {
      /* probeer weer */
    }
    if (pogings < 6) setTimeout(vra, 4000);
  };
  setTimeout(vra, 3000);
}
