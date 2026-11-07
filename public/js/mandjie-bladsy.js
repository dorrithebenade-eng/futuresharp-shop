function formateer_prys_sent(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

function etiket_vir_formaat(formaat) {
  if (formaat === "harde_kopie") return t("hardekopie_etiket");
  if (formaat === "leen") return t("leen_etiket");
  return t("eboek_etiket");
}

function bou_mandjie_ry(item) {
  return `
    <div class="mandjie-ry">
      <div class="mandjie-ry-info">
        <span class="mandjie-ry-titel">${item.titel}</span>
        <span class="mandjie-ry-formaat">${item.opsie_naam || etiket_vir_formaat(item.formaat)}${item.geskenk ? ` <span class="mandjie-geskenk-merk">🎁 ${t("geskenk_merk")}</span>` : ""}</span>
      </div>
      <span class="mandjie-ry-prys">${formateer_prys_sent(item.prys_sent)}</span>
      <button class="mandjie-verwyder" data-slug="${item.produk_slug}" data-formaat="${item.formaat}" data-geskenk="${item.geskenk ? "1" : ""}" data-opsie="${item.opsie || ""}"
        aria-label="${t("verwyder")} ${item.titel} (${etiket_vir_formaat(item.formaat)})">
        ${t("verwyder")}
      </button>
    </div>
  `;
}

function wys_mandjie() {
  const wrap = document.getElementById("mandjie-inhoud");
  const items = kry_mandjie();

  if (!items.length) {
    wrap.innerHTML = `
      <p class="stelsel-boodskap">
        ${t("mandjie_leeg")} <a href="index.html">${t("blaai_katalogus")}</a>.
      </p>
    `;
    return;
  }

  const totaal = kry_mandjie_totaal_sent();

  wrap.innerHTML = `
    <div class="mandjie-lys">
      ${items.filter((i) => !i.geskenk).map(bou_mandjie_ry).join("")}
      ${items.some((i) => i.geskenk)
        ? `<div class="mandjie-geskenk-kop">🎁 ${t("geskenk_groep")}</div>
           <p class="mandjie-geskenk-nota">${t("geskenk_mandjie_nota")}</p>
           ${items.filter((i) => i.geskenk).map(bou_mandjie_ry).join("")}`
        : ""}
    </div>
    <div class="mandjie-totaal-ry">
      <span>${t("totaal")}</span>
      <span class="mandjie-totaal-bedrag">${formateer_prys_sent(totaal)}</span>
    </div>
    <button class="kaart-aksie mandjie-vb-knoppie" id="gaan-na-vb">
      ${t("voltooi_betaling_knoppie")}
    </button>
  `;

  wrap.querySelectorAll(".mandjie-verwyder").forEach((knoppie) => {
    knoppie.addEventListener("click", () => {
      verwyder_uit_mandjie(knoppie.dataset.slug, knoppie.dataset.formaat, knoppie.dataset.geskenk === "1", knoppie.dataset.opsie || "");
      wys_mandjie();
    });
  });

  document.getElementById("gaan-na-vb").addEventListener("click", () => {
    window.location.href = "voltooi-betaling.html";
  });
}

// Die geskenkgroep se voorkoms (GESKENKE, November 2026).
(function () {
  const styl = document.createElement("style");
  styl.textContent = `
    .mandjie-geskenk-merk{display:inline-block;background:#FDE8E1;color:#EC5832;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;margin-left:4px}
    .mandjie-geskenk-kop{font-weight:700;color:#479F91;margin:18px 0 2px;letter-spacing:.03em}
    .mandjie-geskenk-nota{font-size:13px;color:#6b6b6b;margin:0 0 6px}
  `;
  document.head.appendChild(styl);
})();

document.addEventListener("DOMContentLoaded", wys_mandjie);
