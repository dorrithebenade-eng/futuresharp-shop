// fst-blad.js — die FST-blad (/talks): alle talks, met kategorie en soek.
// FutureSharp Talks. Laai na taal.js, fst-taal.js en fst-gedeel.js.

const fst_blad = { talks: [], kategoriee: [], kategorie: "alles", soek: "" };

function fst_blad_kaart(talk) {
  const v = talk.video || {};
  const kat = fst_kategorie_naam(fst_blad.kategoriee, talk.kategoriee[0]);
  const etiket = talk.etiket
    ? `<span class="fst-etiket fst-etiket-${fst_esc(talk.etiket.kleur)}">${fst_esc(kry_huidige_taal() === "en" ? talk.etiket.teks_en : talk.etiket.teks_af)}</span>`
    : "";
  return `
    <a class="fst-kaart" href="/talks/${encodeURIComponent(talk.slug)}">
      <span class="fst-omslag">
        ${talk.omslag ? `<img src="${fst_esc(talk.omslag)}" alt="" loading="lazy">` : ""}
        ${etiket}
        ${v.duur_sekondes ? `<span class="fst-duur">${fst_esc(fst_duur(v.duur_sekondes))}</span>` : ""}
      </span>
      <span class="fst-kaart-titel">${fst_esc(talk.titel)}</span>
      <span class="fst-kaart-wie">${fst_esc(talk.spreker)}</span>
      <span class="fst-kaart-meta">${fst_esc(kat)}${kat ? " · " : ""}${fst_esc(fst_prys(v.prys_sent))}</span>
    </a>`;
}

function fst_blad_filter() {
  const wrap = document.getElementById("fst-filter-pille");
  const pille = [{ id: "alles", naam: t("fst_alles") }].concat(
    fst_blad.kategoriee.map((k) => ({ id: k.id, naam: fst_kategorie_naam(fst_blad.kategoriee, k.id) }))
  );
  wrap.innerHTML = pille
    .map((p) => `<button type="button" class="fst-pil" data-kat="${p.id}" aria-pressed="${p.id === fst_blad.kategorie}">${fst_esc(p.naam)}</button>`)
    .join("");
  wrap.querySelectorAll("[data-kat]").forEach((b) =>
    b.addEventListener("click", () => {
      fst_blad.kategorie = b.dataset.kat;
      fst_blad_filter();
      fst_blad_rooster();
    })
  );
}

function fst_blad_pas(talk) {
  if (fst_blad.kategorie !== "alles" && !talk.kategoriee.includes(fst_blad.kategorie)) return false;
  const s = fst_blad.soek.trim().toLowerCase();
  if (!s) return true;
  const kat_name = talk.kategoriee.map((id) => fst_kategorie_naam(fst_blad.kategoriee, id));
  return [talk.titel, talk.spreker, ...talk.sleutelwoorde, ...kat_name].join(" ").toLowerCase().includes(s);
}

function fst_blad_rooster() {
  const rooster = document.getElementById("fst-rooster");
  if (!fst_blad.talks.length) {
    rooster.innerHTML = `<p class="fst-boodskap">${fst_esc(t("fst_leeg"))}</p>`;
    return;
  }
  const lys = fst_blad.talks.filter(fst_blad_pas);
  rooster.innerHTML = lys.length
    ? lys.map(fst_blad_kaart).join("")
    : `<p class="fst-boodskap">${fst_esc(t("fst_geen_passing"))}</p>`;
}

async function fst_blad_laai() {
  try {
    const resp = await fetch(FST_KATALOGUS);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    fst_blad.talks = data.talks || [];
    fst_blad.kategoriee = data.kategoriee || [];
    fst_blad_filter();
    fst_blad_rooster();
  } catch (fout) {
    console.error("Kon nie talks laai nie:", fout);
    document.getElementById("fst-rooster").innerHTML = `<p class="fst-boodskap">${fst_esc(t("fst_kon_nie_laai"))}</p>`;
  }
}

// Die kop gaan in VOOR DOMContentLoaded, sodat taal.js se wisselaar hom vind.
document.getElementById("fst-kop-plek").outerHTML = fst_kop(false);
document.getElementById("fst-held-merk").innerHTML =
  document.getElementById("fst-held-merk").innerHTML.replace("<!--KAMERA-->", fst_kamera()).replace("<!--KLAPBORD-->", fst_klapbord());
document.getElementById("fst-soek").addEventListener("input", (e) => {
  fst_blad.soek = e.target.value;
  fst_blad_rooster();
});
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fst-soek").placeholder = t("fst_soek");
  // 'n Sleutelwoord op 'n talk-bladsy skakel hierheen met ?soek=
  const vooraf = new URLSearchParams(window.location.search).get("soek");
  if (vooraf) {
    fst_blad.soek = vooraf;
    document.getElementById("fst-soek").value = vooraf;
  }
  fst_blad_laai();
});
