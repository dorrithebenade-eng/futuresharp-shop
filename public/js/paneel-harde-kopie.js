// public/js/paneel-harde-kopie.js
//
// Die "Laat weet my"-lys by 'n boek se harde kopie, in die produkvorm van die
// paneelbord (November 2026). Sien netlify/functions/_harde-kopie-belang.js.
//
// paneelbord.js roep hk_paneel_wys(produk) wanneer 'n boek oopgemaak word,
// en hk_paneel_wys(null) vir 'n nuwe boek. Die stuur-knoppie werk in twee
// klikke: die eerste wys vir hoeveel mense, die tweede stuur.

let HK_OPSOMMING = null;

async function hk_laai_opsomming(vars) {
  if (HK_OPSOMMING && !vars) return HK_OPSOMMING;
  try {
    const resp = await fetch("/.netlify/functions/harde-kopie-belang-paneel", {
      headers: kry_outorisasie_kop(),
    });
    HK_OPSOMMING = resp.ok ? (await resp.json()).per_slug || {} : {};
  } catch {
    HK_OPSOMMING = {};
  }
  return HK_OPSOMMING;
}

function hk_datum(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("af-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function hk_mense(n) {
  return n === 1 ? "1 persoon" : `${n} mense`;
}

async function hk_paneel_wys(produk, vars) {
  const plek = document.getElementById("vorm-hk-wag");
  if (!plek) return;
  plek.hidden = true;
  plek.innerHTML = "";
  if (!produk || !produk.slug) return;

  const slug = produk.slug;
  const opsomming = await hk_laai_opsomming(vars);
  // Die vorm kan intussen 'n ander boek wys.
  const huidige = document.getElementById("vorm-slug");
  if (huidige && huidige.value && huidige.value !== slug) return;

  const info = opsomming[slug] || { wag: 0, gestuur: 0 };
  const aan = document.getElementById("vorm-vra-harde-kopie").checked;
  if (!info.wag && !info.gestuur) {
    if (!aan) return;
    plek.innerHTML = `<p class="paneel-hulp-teks" style="margin:0;">Nog niemand het ingeskryf nie.</p>`;
    plek.hidden = false;
    return;
  }

  const hk = produk.formate && produk.formate.harde_kopie;
  const beskikbaar = !!(hk && hk.beskikbaar);

  let html = `<div class="hk-paneel-kaart">
    <p class="hk-paneel-getal">${info.wag ? `<b>${hk_mense(info.wag)}</b> wag vir die harde kopie` : "Almal op die lys is reeds laat weet."}</p>`;
  if (info.jongste) html += `<p class="paneel-hulp-teks" style="margin:2px 0 0;">Jongste inskrywing: ${hk_datum(info.jongste)}</p>`;
  if (info.gestuur) html += `<p class="paneel-hulp-teks" style="margin:2px 0 0;">Reeds laat weet: ${hk_mense(info.gestuur)}${info.laaste_stuur ? `, laas op ${hk_datum(info.laaste_stuur)}` : ""}</p>`;
  html += `</div>`;

  if (info.wag > 0) {
    if (beskikbaar) {
      html += `<div class="hk-paneel-aksie">
        <button type="button" class="kaart-aksie paneel-voeg-by-knoppie hk-stuur">✉ Stuur kennisgewing aan ${hk_mense(info.wag)}</button>
        <button type="button" class="terug-skakel hk-kanselleer" hidden>Kanselleer</button>
      </div>`;
    } else {
      html += `<p class="paneel-hulp-teks" style="margin:8px 0 0;">Sodra jy die harde kopie hierbo as beskikbaar merk en die boek stoor, kan jy hulle met een knoppie per e-pos laat weet.</p>`;
    }
  }
  html += `<p class="hk-paneel-uitslag paneel-hulp-teks" role="status" style="margin:8px 0 0;"></p>`;
  plek.innerHTML = html;
  plek.hidden = false;

  const stuur = plek.querySelector(".hk-stuur");
  if (!stuur) return;
  const kanselleer = plek.querySelector(".hk-kanselleer");
  const uitslag = plek.querySelector(".hk-paneel-uitslag");
  let bevestig = false;

  kanselleer.addEventListener("click", () => {
    bevestig = false;
    stuur.textContent = `✉ Stuur kennisgewing aan ${hk_mense(info.wag)}`;
    kanselleer.hidden = true;
  });

  stuur.addEventListener("click", async () => {
    if (!bevestig) {
      bevestig = true;
      stuur.textContent = `Ja, stuur nou aan ${hk_mense(info.wag)}`;
      kanselleer.hidden = false;
      return;
    }
    stuur.disabled = true;
    kanselleer.hidden = true;
    stuur.textContent = "Besig om te stuur …";
    try {
      const resp = await fetch("/.netlify/functions/harde-kopie-belang-paneel", {
        method: "POST",
        headers: { ...kry_outorisasie_kop(), "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.fout || "Iets het fout gegaan.");
      await hk_paneel_wys(produk, true);
      const nuwe = document.querySelector("#vorm-hk-wag .hk-paneel-uitslag");
      if (nuwe) {
        let teks = `Gestuur aan ${hk_mense(data.gestuur)}.`;
        if (data.misluk) teks += ` ${hk_mense(data.misluk)} se e-pos het nie deurgegaan nie.`;
        if (data.oor) teks += ` Druk weer om die oorblywende ${hk_mense(data.oor)} te laat weet.`;
        nuwe.textContent = teks;
      }
    } catch (fout) {
      uitslag.textContent = fout.message;
      stuur.disabled = false;
      bevestig = false;
      stuur.textContent = `✉ Stuur kennisgewing aan ${hk_mense(info.wag)}`;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const merkie = document.getElementById("vorm-vra-harde-kopie");
  if (!merkie) return;
  merkie.addEventListener("change", () => {
    const slug = document.getElementById("vorm-slug").value;
    if (!slug || typeof produkte_kas === "undefined") return;
    const produk = (produkte_kas || []).find((p) => p.slug === slug);
    if (produk) hk_paneel_wys(produk);
  });
});
