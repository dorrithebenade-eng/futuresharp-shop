// paneel-uitnodigings.js — hanteer die "Uitnodigings"-oortjie in die
// personeel-paneelbord: genereer nuwe skakels per rol, en wys 'n rekord
// van alle hangende/voltooide uitnodigings.
// kry_outorisasie_kop() kom van paneelbord.js, wat eerste laai.

const ROL_ETIKETTE_PANEEL = {
  outeur: "Outeur",
  vennoot: "Vennoot",
  ontwerp_admin: "Ontwerp/Admin",
  printing: "Printing",
  aflewering: "Aflewering",
};

async function paneel_uitnodiging_genereer() {
  const rol_tipe = document.getElementById("uitnodiging-rol-kieser").value;
  const knoppie = document.getElementById("uitnodiging-genereer-knoppie");
  knoppie.disabled = true;
  knoppie.textContent = "Besig …";

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
    knoppie.textContent = "Gekopieer!";
    setTimeout(() => (knoppie.textContent = oorspronklike), 1500);
  });
}

function formateer_datum_kort(iso_string) {
  if (!iso_string) return "—";
  const d = new Date(iso_string);
  return d.toLocaleDateString("af-ZA", { year: "numeric", month: "short", day: "numeric" });
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
      wrap.innerHTML = `<p class="stelsel-boodskap">Nog geen uitnodigings gestuur nie.</p>`;
      return;
    }

    wrap.innerHTML = lys
      .map((u) => {
        const is_voltooi = u.status === "voltooi";
        return `
          <div class="paneel-produk-ry">
            <div class="paneel-produk-inligting">
              <strong>${ROL_ETIKETTE_PANEEL[u.rol_tipe] || u.rol_tipe}</strong>
              <span class="paneel-produk-outeur">
                ${is_voltooi
                  ? `<span class="paneel-status-merker paneel-status-merker--voltooi">Voltooi — ${formateer_datum_kort(u.voltooi_op)}</span>`
                  : `<span class="paneel-status-merker paneel-status-merker--wag">Hangend sedert ${formateer_datum_kort(u.geskep_op)}</span>`
                }
              </span>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (fout) {
    console.error("Kon nie uitnodigings laai nie:", fout);
    wrap.innerHTML = `<p class="stelsel-boodskap">Kon nie uitnodigings laai nie.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("uitnodiging-genereer-knoppie").addEventListener("click", paneel_uitnodiging_genereer);
  document.getElementById("uitnodiging-kopieer-knoppie").addEventListener("click", paneel_uitnodiging_kopieer);
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
