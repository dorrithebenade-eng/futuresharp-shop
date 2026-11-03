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
  const net_koepon = !!v.net_koepon;
  const nota = net_koepon ? (kry_huidige_taal() === "en" ? v.koepon_nota_en : v.koepon_nota_af) || "" : "";
  const epos_onderwerp = encodeURIComponent(`FutureSharp Talks: ${talk.titel}`);
  const knop_teks = toekoms ? `${t("fst_beskikbaar_vanaf")} ${fst_datum(v.vrystelling_datum)}` : t("fst_binnekort");

  document.getElementById("fst-talk").innerHTML = `
    <div class="fst-profiel">
      <div class="fst-profiel-hoof">
        <div class="fst-omslag fst-omslag-groot">
          ${talk.omslag ? `<img src="${fst_esc(talk.omslag)}" alt="">` : ""}
        </div>
        <h1 class="fst-profiel-titel">${fst_esc(talk.titel)}</h1>
        <p class="fst-profiel-wie">${fst_esc(talk.spreker)}</p>
        ${beskrywing.replace(/<p><\/p>/g, "").trim() ? `
          <h2>${fst_esc(t("fst_oor_talk"))}</h2>
          <div class="fst-teks">${beskrywing}</div>` : ""}
        ${fst_sleutelwoorde(talk).length ? `
          <h2>${fst_esc(t("fst_sleutelwoorde"))}</h2>
          <div class="fst-sleutels">${fst_sleutelwoorde(talk).map((w) => `<a href="/talks?soek=${encodeURIComponent(w)}">${fst_esc(w)}</a>`).join("")}</div>` : ""}
      </div>
      <aside class="fst-koop">
        <div class="fst-koop-meta">${fst_esc(kat)}${v.duur_sekondes ? ` · ${fst_esc(fst_duur(v.duur_sekondes))}` : ""}</div>
        ${net_koepon || v.prys_sent > 0
          ? `<div class="fst-koop-prys${net_koepon ? " fst-koop-prys-koepon" : ""}">${fst_esc(net_koepon ? t("fst_net_koepon") : fst_prys(v.prys_sent))}</div>`
          : "" /* 'n Gratis talk wys geen prys nie */}
        ${net_koepon ? `
          <div class="fst-koepon-nota" id="fst-koepon-nota">
            ${nota ? `<p>${fst_esc(nota)}</p>` : ""}
            <p><a href="mailto:admin@futuresharp.co.za?subject=${epos_onderwerp}">admin@futuresharp.co.za</a></p>
          </div>` : ""}
        <button type="button" class="fst-knop" id="fst-koop-knop" disabled${net_koepon && talk.koopbaar ? " hidden" : ""}>${fst_esc(knop_teks)}</button>
        <p class="fst-koop-fout" id="fst-koop-fout" hidden></p>
        <button type="button" class="fst-koepon-skakel" id="fst-koepon-skakel" hidden>${fst_esc(t("fst_koepon_vraag"))}</button>
        <div class="fst-koepon-ry" id="fst-koepon-ry" hidden>
          <input type="text" id="fst-koepon-kode" maxlength="24" autocomplete="off" placeholder="${fst_esc(t(net_koepon ? "fst_toegangskode_plek" : "fst_koepon_plek"))}" aria-label="${fst_esc(t(net_koepon ? "fst_toegangskode_plek" : "fst_koepon_vraag"))}">
          <button type="button" id="fst-koepon-toe">${fst_esc(t(net_koepon ? "fst_koepon_ontsluit" : "fst_koepon_pas_toe"))}</button>
        </div>
        <p class="fst-koepon-stand" id="fst-koepon-stand" hidden></p>
      </aside>
    </div>`;
}

// ------------------------------------------------------------ koop (Fase 4)

// Die koepon wat die koper toegepas het (Fase 4c). Die bediener toets dit
// weer by die betaling; hier is dit net vir die prys op die knoppie.
const fst_talk_koepon = { kode: null, prys_na_sent: null };

function fst_talk_knop_teks(talk) {
  const lys = (talk.video && talk.video.prys_sent) || 0;
  const prys = fst_talk_koepon.kode ? fst_talk_koepon.prys_na_sent : lys;
  return prys ? `${t("fst_koop_vir")} ${fst_prys(prys)}` : t("fst_kry_gratis");
}

function fst_talk_koepon_opstel(talk, knop) {
  const skakel = document.getElementById("fst-koepon-skakel");
  const ry = document.getElementById("fst-koepon-ry");
  const invoer = document.getElementById("fst-koepon-kode");
  const stand = document.getElementById("fst-koepon-stand");
  const prys_el = document.querySelector(".fst-koop-prys");
  if (!skakel) return;
  skakel.hidden = false;
  skakel.onclick = () => { skakel.hidden = true; ry.hidden = false; invoer.focus(); };

  const pas_toe = async () => {
    const kode = invoer.value.trim().toUpperCase();
    if (!kode) return;
    stand.hidden = true;
    stand.classList.remove("fst-koepon-fout");

    const sessie = await identiteit_kry_huidige_sessie().catch(() => null);
    if (!sessie) {
      window.location.href = `/aanmeld.html?terug=${encodeURIComponent(`/talks/${talk.slug}`)}`;
      return;
    }
    try {
      const resp = await fetch("/.netlify/functions/verifieer-talk-koepon", {
        method: "POST",
        headers: await identiteit_kop({ "Content-Type": "application/json" }),
        body: JSON.stringify({ slug: talk.slug, kode }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.geldig) {
        fst_talk_koepon.kode = null;
        stand.textContent = t(`fst_koepon_${data.fout_kode || "ONBEKEND"}`);
        stand.classList.add("fst-koepon-fout");
        stand.hidden = false;
      } else {
        fst_talk_koepon.kode = data.kode;
        fst_talk_koepon.prys_na_sent = data.prys_na_sent;
        stand.textContent = t("fst_koepon_aanvaar");
        stand.hidden = false;
        if (prys_el) {
          prys_el.innerHTML = `${fst_esc(fst_prys(data.prys_na_sent))} <span class="fst-koop-prys-oud">${fst_esc(fst_prys(data.oorspronklik_sent))}</span>`;
        }
      }
      knop.textContent = fst_talk_knop_teks(talk);
    } catch (e) {
      console.error("Kon nie koepon toets nie:", e);
    }
  };
  document.getElementById("fst-koepon-toe").onclick = pas_toe;
  invoer.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); pas_toe(); } };
}

// Net met 'n koepon (geen prys, geen koopknoppie): die koeponveld staan
// dadelik oop, en 'n geldige kode voeg die talk in een stap by My Teater.
// Die bediener aanvaar vir so 'n talk net 'n koepon wat dit na R0 bring.
function fst_talk_net_koepon_opstel(talk) {
  const ry = document.getElementById("fst-koepon-ry");
  const invoer = document.getElementById("fst-koepon-kode");
  const knop = document.getElementById("fst-koepon-toe");
  const stand = document.getElementById("fst-koepon-stand");
  ry.hidden = false;

  const ontsluit = async () => {
    const kode = invoer.value.trim().toUpperCase();
    if (!kode) return;
    stand.hidden = true;
    stand.classList.remove("fst-koepon-fout");

    const sessie = await identiteit_kry_huidige_sessie().catch(() => null);
    if (!sessie) {
      window.location.href = `/aanmeld.html?terug=${encodeURIComponent(`/talks/${talk.slug}`)}`;
      return;
    }
    const oud = knop.textContent;
    knop.disabled = true;
    knop.textContent = t("fst_besig");
    try {
      const resp = await fetch("/.netlify/functions/begin-talk-betaling", {
        method: "POST",
        headers: await identiteit_kop({ "Content-Type": "application/json" }),
        body: JSON.stringify({ slug: talk.slug, koepon_kode: kode }),
      });
      if (resp.status === 401) {
        window.location.href = `/aanmeld.html?terug=${encodeURIComponent(`/talks/${talk.slug}`)}`;
        return;
      }
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.teater) {
        window.location.href = data.teater;
        return;
      }
      stand.textContent = t(`fst_kode_${data.fout_kode || "ONBEKEND"}`);
      stand.classList.add("fst-koepon-fout");
      stand.hidden = false;
    } catch (e) {
      console.error("Kon nie die koepon toepas nie:", e);
      stand.textContent = t("fst_koop_fout");
      stand.classList.add("fst-koepon-fout");
      stand.hidden = false;
    }
    knop.disabled = false;
    knop.textContent = oud;
  };
  knop.onclick = ontsluit;
  invoer.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); ontsluit(); } };
}

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

// 'n Gratis talk (prys R0, sonder toegangskode) speel reg hier op die
// bladsy, vir enigiemand, ook sonder 'n profiel (November 2026).
function fst_talk_is_gratis(talk) {
  const v = talk.video || {};
  return !!talk.koopbaar && !v.net_koepon && !v.prys_sent;
}

let fst_mux_laai = null;
function fst_laai_mux_speler() {
  if (customElements.get("mux-player")) return Promise.resolve();
  if (!fst_mux_laai) {
    fst_mux_laai = new Promise((klaar, fout) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@mux/mux-player";
      s.onload = () => customElements.whenDefined("mux-player").then(klaar);
      s.onerror = fout;
      document.head.appendChild(s);
    });
  }
  return fst_mux_laai;
}

async function fst_talk_speel(talk, knop) {
  const skerm = document.querySelector(".fst-omslag-groot");
  const fout = document.getElementById("fst-koop-fout");
  fout.hidden = true;
  const oud = knop.textContent;
  knop.disabled = true;
  knop.textContent = t("fst_besig");
  try {
    const [resp] = await Promise.all([
      fetch(`/.netlify/functions/kry-kyk-token?slug=${encodeURIComponent(talk.slug)}`, { headers: await identiteit_kop() }),
      fst_laai_mux_speler(),
    ]);
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    const speler = document.createElement("mux-player");
    speler.setAttribute("playback-id", data.playback_id);
    speler.setAttribute("playback-token", data.tokens.playback);
    speler.setAttribute("thumbnail-token", data.tokens.thumbnail);
    speler.setAttribute("storyboard-token", data.tokens.storyboard);
    speler.setAttribute("stream-type", "on-demand");
    speler.setAttribute("accent-color", "#F1BD43");
    speler.setAttribute("primary-color", "#FFFFFF");
    speler.setAttribute("metadata-video-title", talk.titel);
    speler.setAttribute("metadata-video-id", talk.slug);
    speler.setAttribute("title", talk.titel);
    speler.setAttribute("autoplay", "");
    skerm.innerHTML = "";
    skerm.classList.add("fst-omslag-speel");
    skerm.appendChild(speler);
    skerm.scrollIntoView({ behavior: "smooth", block: "center" });
    knop.hidden = true;
  } catch (e) {
    console.error("Kon nie die video laai nie:", e);
    fout.textContent = t("fst_speler_fout");
    fout.hidden = false;
    knop.disabled = false;
    knop.textContent = oud;
  }
}

async function fst_talk_knoppie(talk) {
  const knop = document.getElementById("fst-koop-knop");
  if (!knop) return;

  if (fst_talk_is_gratis(talk)) {
    knop.disabled = false;
    knop.textContent = t("fst_kyk_nou");
    knop.onclick = () => fst_talk_speel(talk, knop);
    const omslag = document.querySelector(".fst-omslag-groot");
    if (omslag) {
      omslag.classList.add("fst-omslag-klik");
      omslag.insertAdjacentHTML("beforeend", `<span class="fst-speel-ikoon" aria-hidden="true"></span>`);
      omslag.onclick = () => { if (!knop.hidden && !knop.disabled) fst_talk_speel(talk, knop); };
    }
    knop.insertAdjacentHTML("beforebegin", `<div class="fst-koop-prys">${fst_esc(t("fst_gratis"))}</div>`);
    knop.insertAdjacentHTML("afterend", `<p class="fst-gratis-nota">${fst_esc(t("fst_gratis_nota"))}</p>`);
    return;
  }

  if (await fst_talk_besit(talk.slug)) {
    knop.disabled = false;
    knop.textContent = t("fst_kyk_in_teater");
    knop.onclick = () => { window.location.href = `/teater?talk=${encodeURIComponent(talk.slug)}`; };
    knop.hidden = false;
    const prys = document.querySelector(".fst-koop-prys");
    if (prys) prys.hidden = true;
    const nota = document.getElementById("fst-koepon-nota");
    if (nota) nota.hidden = true;
    return;
  }

  if (!talk.koopbaar) return;

  if (talk.video && talk.video.net_koepon) {
    fst_talk_net_koepon_opstel(talk);
    return;
  } // bly "Binnekort beskikbaar" of "Beskikbaar vanaf …"

  knop.disabled = false;
  knop.textContent = fst_talk_knop_teks(talk);
  knop.onclick = () => fst_talk_koop(talk, knop);
  fst_talk_koepon_opstel(talk, knop);
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
      body: JSON.stringify({ slug: talk.slug, koepon_kode: fst_talk_koepon.kode }),
    });
    if (resp.status === 401) {
      window.location.href = `/aanmeld.html?terug=${encodeURIComponent(`/talks/${talk.slug}`)}`;
      return;
    }
    if (!resp.ok) {
      // 'n Koepon wat intussen verval of opgebruik is: sê presies wat.
      const data = await resp.json().catch(() => null);
      if (data && data.fout_kode) {
        const stand = document.getElementById("fst-koepon-stand");
        stand.textContent = t(`fst_koepon_${data.fout_kode}`);
        stand.classList.add("fst-koepon-fout");
        stand.hidden = false;
        fst_talk_koepon.kode = null;
        knop.disabled = false;
        knop.textContent = fst_talk_knop_teks(talk);
        return;
      }
      throw new Error("Status " + resp.status);
    }
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
