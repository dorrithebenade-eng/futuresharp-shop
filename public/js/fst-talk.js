// fst-talk.js — die talk-bladsy (/talks/<slug>). FutureSharp Talks.
// Laai na taal.js, fst-taal.js en fst-gedeel.js.
//
// Die bladsy word deur talk-bladsy.js bedien, wat die voorskou vir gedeelde
// skakels in die kop sit. Hier word die inhoud gebou.
//
// Koop (Fase 4): die knoppie sê "Koop vir R…" as die talk koopbaar is,
// "Kyk in My Teater" as die koper dit reeds besit, en andersins
// "Binnekort beskikbaar".

function fst_talk_slug() {
  const q = new URLSearchParams(window.location.search).get("slug");
  if (q) return q.toLowerCase();
  const passing = /\/talks\/([^/?#]+)/.exec(window.location.pathname);
  return passing ? decodeURIComponent(passing[1]).toLowerCase() : "";
}

function fst_talk_teken(talk, kategoriee) {
  const v = talk.video || {};
  const hoof = talk.kategoriee[0];
  document.documentElement.style.setProperty("--fst-gloed", FST_KLEURE[hoof] || "#3FB6A4");

  const kat = talk.kategoriee.map((id) => fst_kategorie_naam(kategoriee, id)).filter(Boolean).join(" · ");
  const beskrywing = (talk.vol_beskrywing || talk.oorsig || "")
    .split(/\n{2,}/)
    .map((p) => `<p>${fst_esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  // Die knoppie begin afgeskakel en kry sy werklike stand in
  // fst_talk_knoppie(), sodra ons weet of die koper dit reeds besit.
  const toekoms = talk.nie_koopbaar_nie === "nog_nie_vrygestel";
  const knop_teks = toekoms ? `${t("fst_beskikbaar_vanaf")} ${fst_datum(v.vrystelling_datum)}` : t("fst_binnekort");

  document.getElementById("fst-talk").innerHTML = `
    <div class="fst-profiel">
      <div class="fst-profiel-hoof">
        <div class="fst-omslag fst-omslag-groot">
          ${talk.omslag ? `<img src="${fst_esc(talk.omslag)}" alt="">` : ""}
        </div>
        <h1 class="fst-profiel-titel">${fst_esc(talk.titel)}</h1>
        <p class="fst-profiel-wie">${fst_esc(talk.spreker)}</p>
        <h2>${fst_esc(t("fst_oor_talk"))}</h2>
        <div class="fst-teks">${beskrywing}</div>
        ${talk.sleutelwoorde.length ? `
          <h2>${fst_esc(t("fst_sleutelwoorde"))}</h2>
          <div class="fst-sleutels">${talk.sleutelwoorde.map((w) => `<a href="/talks?soek=${encodeURIComponent(w)}">${fst_esc(w)}</a>`).join("")}</div>` : ""}
      </div>
      <aside class="fst-koop">
        <div class="fst-koop-meta">${fst_esc(kat)}${v.duur_sekondes ? ` · ${fst_esc(fst_duur(v.duur_sekondes))}` : ""}</div>
        <div class="fst-koop-prys">${fst_esc(fst_prys(v.prys_sent))}</div>
        <button type="button" class="fst-knop" id="fst-koop-knop" disabled>${fst_esc(knop_teks)}</button>
        <p class="fst-koop-fout" id="fst-koop-fout" hidden></p>
      </aside>
    </div>`;
}

// ------------------------------------------------------------ koop (Fase 4)

async function fst_talk_besit(slug) {
  if (typeof identiteit_kry_huidige_sessie !== "function") return false;
  const sessie = await identiteit_kry_huidige_sessie().catch(() => null);
  if (!sessie) return false;
  try {
    const resp = await fetch("/.netlify/functions/kry-my-talks", { headers: await identiteit_kop() });
    if (!resp.ok) return false;
    const data = await resp.json();
    return (data.talks || []).some((x) => x.slug === slug);
  } catch {
    return false;
  }
}

async function fst_talk_knoppie(talk) {
  const knop = document.getElementById("fst-koop-knop");
  if (!knop) return;

  if (await fst_talk_besit(talk.slug)) {
    knop.disabled = false;
    knop.textContent = t("fst_kyk_in_teater");
    knop.onclick = () => { window.location.href = `/teater?talk=${encodeURIComponent(talk.slug)}`; };
    const prys = document.querySelector(".fst-koop-prys");
    if (prys) prys.hidden = true;
    return;
  }

  if (!talk.koopbaar) return; // bly "Binnekort beskikbaar" of "Beskikbaar vanaf …"

  const prys_sent = (talk.video && talk.video.prys_sent) || 0;
  knop.disabled = false;
  knop.textContent = prys_sent ? `${t("fst_koop_vir")} ${fst_prys(prys_sent)}` : t("fst_kry_gratis");
  knop.onclick = () => fst_talk_koop(talk, knop);
}

async function fst_talk_koop(talk, knop) {
  const fout = document.getElementById("fst-koop-fout");
  fout.hidden = true;

  const sessie = await identiteit_kry_huidige_sessie().catch(() => null);
  if (!sessie) {
    const terug = `/talks/${encodeURIComponent(talk.slug)}`;
    window.location.href = `/aanmeld.html?terug=${encodeURIComponent(terug)}`;
    return;
  }

  const oud = knop.textContent;
  knop.disabled = true;
  knop.textContent = t("fst_besig");
  try {
    const resp = await fetch("/.netlify/functions/begin-talk-betaling", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify({ slug: talk.slug }),
    });
    if (resp.status === 401) {
      window.location.href = `/aanmeld.html?terug=${encodeURIComponent(`/talks/${talk.slug}`)}`;
      return;
    }
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    window.location.href = data.authorization_url || data.teater;
  } catch (e) {
    console.error("Kon nie die betaling begin nie:", e);
    fout.textContent = t("fst_koop_fout");
    fout.hidden = false;
    knop.disabled = false;
    knop.textContent = oud;
  }
}

async function fst_talk_laai() {
  const slug = fst_talk_slug();
  const plek = document.getElementById("fst-talk");
  if (!slug) {
    window.location.replace("/talks");
    return;
  }
  try {
    const resp = await fetch(`${FST_KATALOGUS}?slug=${encodeURIComponent(slug)}`);
    if (resp.status === 404) {
      plek.innerHTML = `<p class="fst-boodskap">${fst_esc(t("fst_nie_gevind"))} <a href="/talks">${fst_esc(t("fst_alle_talks"))}</a></p>`;
      return;
    }
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const data = await resp.json();
    fst_talk_teken(data.talk, data.kategoriee || []);
    fst_talk_knoppie(data.talk);
    // Tel die besoek op die agtergrond; 'n fout hier raak die bladsy nie.
    fetch("/.netlify/functions/tel-talk-besigtiging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch(() => {});
  } catch (fout) {
    console.error("Kon nie die talk laai nie:", fout);
    plek.innerHTML = `<p class="fst-boodskap">${fst_esc(t("fst_kon_nie_laai"))}</p>`;
  }
}

document.getElementById("fst-kop-plek").outerHTML = fst_kop(true);
document.addEventListener("DOMContentLoaded", fst_talk_laai);
