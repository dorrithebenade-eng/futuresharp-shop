function formateer_prys_sent(sent) {
  return `R${(sent / 100).toFixed(2)}`;
}

function etiket_vir_formaat(formaat) {
  return formaat === "harde_kopie" ? t("hardekopie_etiket") : t("eboek_etiket");
}

function bou_mandjie_ry(item) {
  return `
    <div class="mandjie-ry">
      <div class="mandjie-ry-info">
        <span class="mandjie-ry-titel">${item.titel}</span>
        <span class="mandjie-ry-formaat">${etiket_vir_formaat(item.formaat)}</span>
      </div>
      <span class="mandjie-ry-prys">${formateer_prys_sent(item.prys_sent)}</span>
      <button class="mandjie-verwyder" data-slug="${item.produk_slug}" data-formaat="${item.formaat}"
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
      ${items.map(bou_mandjie_ry).join("")}
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
      verwyder_uit_mandjie(knoppie.dataset.slug, knoppie.dataset.formaat);
      wys_mandjie();
    });
  });

  document.getElementById("gaan-na-vb").addEventListener("click", () => {
    window.location.href = "voltooi-betaling.html";
  });
}

document.addEventListener("DOMContentLoaded", wys_mandjie);
