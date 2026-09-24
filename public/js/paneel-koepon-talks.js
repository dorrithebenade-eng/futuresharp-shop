// paneel-koepon-talks.js — FutureSharp Talks: koepons vir talks in die
// paneelbord se bestaande Koepons-afdeling.
//
// Die boekvorm bly onaangeraak. Hierdie lêer voeg net by:
//   - die formaat-opsie "Talk (video)";
//   - wanneer dit gekies is: 'n keuse van talk en van spreker, in die plek
//     van die boek- en outeurkeuses;
//   - 'n eie indiening vir talk-koepons (dieselfde skep-koepon.js, met
//     formaat_beperking "video" en spreker_id).
// Vir 'n boek-koepon hardloop die bestaande paneelbord.js-kode soos altyd.
//
// Hang af van paneelbord.js (kry_outorisasie_kop, sluit_koepon_vorm,
// laai_koepons), wat vroeër laai.

const PKT = { talks: [], sprekers: [], gelaai: false };

function pkt_esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function pkt_etiket(id) {
  return document.querySelector(`label[for="${id}"]`);
}

function pkt_wys(id, sigbaar) {
  const veld = document.getElementById(id);
  const etiket = pkt_etiket(id);
  if (veld) veld.style.display = sigbaar ? "" : "none";
  if (etiket) etiket.style.display = sigbaar ? "" : "none";
}

async function pkt_laai() {
  if (PKT.gelaai) return;
  try {
    const kop = kry_outorisasie_kop();
    const [t, s] = await Promise.all([
      fetch("/.netlify/functions/kry-talks", { headers: kop }),
      fetch("/.netlify/functions/kry-sprekers", { headers: kop }),
    ]);
    PKT.talks = t.ok ? (await t.json()).talks || [] : [];
    PKT.sprekers = s.ok ? (await s.json()).sprekers || [] : [];
    PKT.gelaai = true;
  } catch (fout) {
    console.error("Kon nie talks of sprekers vir koepons laai nie:", fout);
  }
  const talk = document.getElementById("koepon-vorm-talk");
  const spreker = document.getElementById("koepon-vorm-spreker");
  talk.innerHTML = `<option value="">Enige talk</option>` +
    PKT.talks.map((x) => `<option value="${pkt_esc(x.slug)}">${pkt_esc(x.titel)}</option>`).join("");
  spreker.innerHTML = `<option value="">Enige spreker</option>` +
    PKT.sprekers.map((x) => `<option value="${pkt_esc(x.spreker_id)}">${pkt_esc(x.naam)}</option>`).join("");
}

function pkt_is_talk() {
  const formaat = document.getElementById("koepon-vorm-formaat");
  return formaat && formaat.value === "video";
}

function pkt_pas_vorm_aan() {
  const talk = pkt_is_talk();
  pkt_wys("koepon-vorm-produk", !talk);
  pkt_wys("koepon-vorm-outeur", !talk);
  document.getElementById("pkt-talk-velde").style.display = talk ? "block" : "none";
  if (talk) pkt_laai();
}

async function pkt_dien_in(e) {
  if (!pkt_is_talk()) return; // 'n boek-koepon: paneelbord.js hanteer dit
  e.preventDefault();
  e.stopImmediatePropagation();

  const fout = document.getElementById("paneel-koepon-vorm-foute");
  fout.style.display = "none";
  const liggaam = {
    kode: document.getElementById("koepon-vorm-kode").value.trim(),
    tipe: document.getElementById("koepon-vorm-tipe").value,
    afslag_tipe: document.getElementById("koepon-vorm-afslag-tipe").value,
    afslag_waarde: Number(document.getElementById("koepon-vorm-afslag-waarde").value),
    produk_slug: document.getElementById("koepon-vorm-talk").value || null,
    spreker_id: document.getElementById("koepon-vorm-spreker").value || null,
    formaat_beperking: "video",
    maks_gebruike: Number(document.getElementById("koepon-vorm-maks-gebruike").value) || 1,
    verval_op: document.getElementById("koepon-vorm-verval").value || null,
    outeur_id: null,
    nota: document.getElementById("koepon-vorm-nota").value.trim(),
  };

  const knoppie = document.getElementById("paneel-koepon-vorm-indien");
  const oud = knoppie.textContent;
  knoppie.disabled = true;
  try {
    const resp = await fetch("/.netlify/functions/skep-koepon", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...kry_outorisasie_kop() },
      body: JSON.stringify(liggaam),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      throw new Error((data && data.fout) || `Status ${resp.status}`);
    }
    sluit_koepon_vorm();
    laai_koepons();
  } catch (f) {
    fout.textContent = f.message;
    fout.style.display = "block";
  } finally {
    knoppie.disabled = false;
    knoppie.textContent = oud;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const vorm = document.getElementById("paneel-koepon-vorm");
  const formaat = document.getElementById("koepon-vorm-formaat");
  if (!vorm || !formaat) return;

  formaat.insertAdjacentHTML("beforeend", `<option value="video">Talk (video)</option>`);

  // Die talk- en sprekerkeuses, net ná die formaatkeuse.
  formaat.insertAdjacentHTML("afterend", `
    <div id="pkt-talk-velde" style="display:none;">
      <label class="veld-etiket" for="koepon-vorm-talk"><span>Talk</span></label>
      <select id="koepon-vorm-talk" class="veld-invoer"><option value="">Enige talk</option></select>
      <label class="veld-etiket" for="koepon-vorm-spreker"><span>Spreker</span> <span class="veld-opsioneel">(opsioneel: net die talks van hierdie spreker)</span></label>
      <select id="koepon-vorm-spreker" class="veld-invoer"><option value="">Enige spreker</option></select>
    </div>`);

  formaat.addEventListener("change", pkt_pas_vorm_aan);
  // open_koepon_vorm() roep reset(): dan is dit weer 'n boek-koepon.
  vorm.addEventListener("reset", () => setTimeout(pkt_pas_vorm_aan, 0));
  // Vang die indiening vóór paneelbord.js, maar net vir talk-koepons.
  vorm.addEventListener("submit", pkt_dien_in, true);
});
