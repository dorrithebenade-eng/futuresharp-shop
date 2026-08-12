// paneel-uitnodigings.js — hanteer die "Uitnodigings"-oortjie in die
// personeel-paneelbord: genereer nuwe skakels per rol, en wys 'n rekord
// van alle hangende/voltooide uitnodigings.
// kry_outorisasie_kop() kom van paneelbord.js, wat eerste laai.

function kry_rol_etiket_paneel(rol_tipe) {
  const sleutels = {
    outeur: "rol_outeur",
    vennoot: "rol_vennoot",
    ontwerp_admin: "rol_ontwerp_admin",
    printing: "rol_printing",
    aflewering: "rol_aflewering",
  };
  return sleutels[rol_tipe] ? t(sleutels[rol_tipe]) : rol_tipe;
}

async function paneel_uitnodiging_genereer() {
  const rol_tipe = document.getElementById("uitnodiging-rol-kieser").value;
  const knoppie = document.getElementById("uitnodiging-genereer-knoppie");
  knoppie.disabled = true;
  knoppie.textContent = t("besig");

  try {
    const resp = await fetch("/.netlify/functions/skep-uitnodiging", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ rol_tipe }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    const uitnodiging = await resp.json();
    const skakel = `${window.location.origin}/uitnodiging.html?token=${uitnodiging.token}`;

    const skakelblok = document.getElementById("uitnodiging-nuwe-skakel-blok");
    const skakelveld = document.getElementById("uitnodiging-nuwe-skakel-veld");
    skakelveld.value = skakel;
    skakelblok.style.display = "block";

    paneel_uitnodigings_laai();
  } catch (fout) {
    console.error("Kon nie uitnodiging genereer nie:", fout);
    alert(`Kon nie skakel genereer nie: ${fout.message}`);
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = "+ Genereer skakel";
  }
}

function paneel_uitnodiging_kopieer() {
  const skakelveld = document.getElementById("uitnodiging-nuwe-skakel-veld");
  skakelveld.select();
  navigator.clipboard.writeText(skakelveld.value).then(() => {
    const knoppie = document.getElementById("uitnodiging-kopieer-knoppie");
    const oorspronklike = knoppie.textContent;
    knoppie.textContent = t("uitnodiging_gekopieer");
    setTimeout(() => (knoppie.textContent = oorspronklike), 1500);
  });
}

function formateer_datum_kort(iso_string) {
  if (!iso_string) return "—";
  const d = new Date(iso_string);
  return d.toLocaleDateString("af-ZA", { year: "numeric", month: "short", day: "numeric" });
}

// KALENDERDAE tot die vervaldatum, in die leser se eie tydsone. Nie
// verstreke ure nie: 'n skakel wat vandag geskep is, moet "14 dae" wys
// en nie "13" omdat daar 'n uur verby is nie. Die TYDPERK self leef net
// op die bediener — hier word slegs verval_op gelees, wat saamkom.
function dae_tot_verval(iso_string) {
  if (!iso_string) return null;
  const verval = new Date(iso_string);
  if (isNaN(verval.getTime())) return null;

  const middernag = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((middernag(verval) - middernag(new Date())) / (24 * 60 * 60 * 1000));
}

// Word slegs geroep vir 'n skakel wat NOG leef — 'n verstreke een sê dit
// in sy merker.
function uitnodiging_verval_teks(u) {
  const dae = dae_tot_verval(u.verval_op);
  if (dae === null) return "";
  if (dae <= 0) return t("uitnodiging_verval_vandag");
  if (dae === 1) return t("uitnodiging_verval_more");
  return `${t("uitnodiging_verval_oor")} ${dae} ${t("uitnodiging_dae")}`;
}

function bou_uitnodiging_ry(u) {
  const is_voltooi = u.status === "voltooi";

  const merker = is_voltooi
    ? `<span class="paneel-status-merker paneel-status-merker--voltooi">${t("uitnodiging_status_voltooi")} — ${formateer_datum_kort(u.voltooi_op)}</span>`
    : u.is_verval
      ? `<span class="paneel-status-merker paneel-status-merker--verstreke">${t("uitnodiging_status_verstreke")} — ${formateer_datum_kort(u.verval_op)}</span>`
      : `<span class="paneel-status-merker paneel-status-merker--wag">${t("uitnodiging_status_hangend")} ${formateer_datum_kort(u.geskep_op)}</span>`;

  // 'n Verstreke skakel het reeds sy datum in die merker; 'n tweede
  // reëltjie langsaan sou dieselfde ding twee keer sê.
  const verval = is_voltooi || u.is_verval
    ? ""
    : `<span class="pu-verval">${uitnodiging_verval_teks(u)}</span>`;

  // Die skrap-knoppie verskyn NET by 'n hangende (of verstreke) skakel.
  // 'n Voltooide inskrywing is die rekord van wie wanneer aangesluit het
  // en het geen knoppie nie — die bediener weier dit ook.
  const skrap = is_voltooi
    ? ""
    : `<button type="button" class="pu-skrap" data-token="${u.token}">${t("uitnodiging_skrap")}</button>`;

  return `
    <div class="paneel-produk-ry" data-uitnodiging="${u.token}">
      <div class="paneel-produk-inligting">
        <strong>${kry_rol_etiket_paneel(u.rol_tipe)}</strong>
        <span class="paneel-produk-outeur">${merker}${verval}</span>
      </div>
      ${skrap}
    </div>
  `;
}

async function paneel_uitnodiging_skrap(token, knoppie) {
  if (!confirm(t("uitnodiging_skrap_bevestig"))) return;

  knoppie.disabled = true;

  try {
    const resp = await fetch("/.netlify/functions/skrap-uitnodiging", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify({ token }),
    });

    if (!resp.ok) {
      const teks = await resp.text();
      throw new Error(teks || `Status ${resp.status}`);
    }

    // Werk die lys PLAASLIK by. list() is eventueel konsekwent, dus sou
    // 'n herlaai die pas geskrapte ry dalk nog wys — en dan lyk dit of
    // die knoppie niks gedoen het nie.
    const ry = document.querySelector(`[data-uitnodiging="${token}"]`);
    if (ry) ry.remove();

    const wrap = document.getElementById("paneel-uitnodigings-lys");
    if (wrap && !wrap.querySelector(".paneel-produk-ry")) {
      wrap.innerHTML = `<p class="stelsel-boodskap">${t("uitnodiging_geen_gestuur")}</p>`;
    }
  } catch (fout) {
    console.error("Kon nie uitnodiging skrap nie:", fout);
    alert(`${t("uitnodiging_skrap_fout")}: ${fout.message}`);
    knoppie.disabled = false;
  }
}

async function paneel_uitnodigings_laai() {
  const wrap = document.getElementById("paneel-uitnodigings-lys");

  try {
    const resp = await fetch("/.netlify/functions/kry-alle-uitnodigings", {
      headers: kry_outorisasie_kop(),
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    const lys = data.uitnodigings || [];

    if (!lys.length) {
      wrap.innerHTML = `<p class="stelsel-boodskap">${t("uitnodiging_geen_gestuur")}</p>`;
      return;
    }

    wrap.innerHTML = lys.map(bou_uitnodiging_ry).join("");
  } catch (fout) {
    console.error("Kon nie uitnodigings laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">${t("uitnodiging_kon_nie_laai")}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("uitnodiging-genereer-knoppie").addEventListener("click", paneel_uitnodiging_genereer);
  document.getElementById("uitnodiging-kopieer-knoppie").addEventListener("click", paneel_uitnodiging_kopieer);

  // Op die HOUER, nie op elke knoppie nie — die rye word herbou elke
  // keer as die lys laai, en 'n hanteerder per knoppie sou saam met hulle
  // verdwyn.
  const lys = document.getElementById("paneel-uitnodigings-lys");
  if (lys) {
    lys.addEventListener("click", (gebeurtenis) => {
      const knoppie = gebeurtenis.target.closest(".pu-skrap");
      if (!knoppie) return;
      paneel_uitnodiging_skrap(knoppie.dataset.token, knoppie);
    });
  }
});

// Selfde "wag totdat paneel-inhoud sigbaar raak" patroon as paneel-registers.js
(function paneel_uitnodigings_waarnemer() {
  const teiken = document.getElementById("paneel-inhoud");
  if (!teiken) return;

  let reeds_gelaai = false;
  const waarnemer = new MutationObserver(() => {
    if (!reeds_gelaai && teiken.style.display !== "none") {
      reeds_gelaai = true;
      paneel_uitnodigings_laai();
    }
  });
  waarnemer.observe(teiken, { attributes: true, attributeFilter: ["style"] });

  if (teiken.style.display !== "none") {
    reeds_gelaai = true;
    paneel_uitnodigings_laai();
  }
})();
