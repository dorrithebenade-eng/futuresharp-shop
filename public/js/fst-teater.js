// fst-teater.js — My Teater (/teater). FutureSharp Talks.
//
// Wys die aangemelde koper se talks: die gekose een op die skerm in die
// donker saal, die res as 'n program onderaan. Die video speel in Mux se
// speler met 'n kort-lewende getekende skakel (kry-kyk-token.js).
//
// Kom die koper van Paystack terug (?bestelnommer=…), word die betaling
// eers bevestig: die webhook doen dit gewoonlik binne sekondes, en
// bevestig-talk-betaling.js vang die gevalle waar hy nog nie het nie.
//
// Laai na taal.js, identiteit.js, fst-taal.js en fst-gedeel.js.

const fst_teater = { talks: [], huidig: null };

function fst_teater_boodskap(html) {
  const el = document.getElementById("fst-teater-boodskap");
  el.innerHTML = html || "";
  el.hidden = !html;
}

function fst_teater_param(naam) {
  return new URLSearchParams(window.location.search).get(naam);
}

async function fst_teater_bevestig(bestelnommer) {
  fst_teater_boodskap(`<p>${fst_esc(t("fst_bevestig"))}</p>`);
  for (let poging = 0; poging < 10; poging++) {
    try {
      const resp = await fetch("/.netlify/functions/bevestig-talk-betaling", {
        method: "POST",
        headers: await identiteit_kop({ "Content-Type": "application/json" }),
        body: JSON.stringify({ bestelnommer }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.stand === "betaal") {
          fst_teater_boodskap("");
          // Die bestelnommer hoort nie in 'n adres wat die koper later deel of
          // as boekmerk stoor nie.
          const skoon = new URL(window.location.href);
          skoon.searchParams.delete("bestelnommer");
          window.history.replaceState(null, "", skoon.pathname + skoon.search);
          return true;
        }
      }
    } catch { /* probeer weer */ }
    await new Promise((r) => setTimeout(r, 3000));
  }
  fst_teater_boodskap(`<p>${fst_esc(t("fst_bevestig_stadig"))}</p>`);
  return false;
}

function fst_teater_kaart(talk) {
  return `
    <button type="button" class="fst-program-kaart${fst_teater.huidig && talk.slug === fst_teater.huidig.slug ? " fst-program-aktief" : ""}" data-slug="${fst_esc(talk.slug)}">
      <span class="fst-omslag">${talk.omslag ? `<img src="${fst_esc(talk.omslag)}" alt="" loading="lazy">` : ""}</span>
      <span class="fst-kaart-titel">${fst_esc(talk.titel)}</span>
      <span class="fst-kaart-wie">${fst_esc(talk.spreker)}${talk.duur_sekondes ? ` · ${fst_esc(fst_duur(talk.duur_sekondes))}` : ""}</span>
    </button>`;
}

function fst_teater_teken_program() {
  const program = document.getElementById("fst-program");
  program.hidden = fst_teater.talks.length < 2;
  const strook = document.getElementById("fst-strook");
  strook.innerHTML = fst_teater.talks.map(fst_teater_kaart).join("");
  strook.querySelectorAll("[data-slug]").forEach((b) =>
    b.addEventListener("click", () => {
      const talk = fst_teater.talks.find((x) => x.slug === b.dataset.slug);
      if (talk) {
        fst_teater_kies(talk);
        window.history.replaceState(null, "", `/teater?talk=${encodeURIComponent(talk.slug)}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    })
  );
}

async function fst_teater_kies(talk) {
  fst_teater.huidig = talk;
  document.documentElement.style.setProperty("--fst-gloed", FST_KLEURE[talk.kategoriee[0]] || "#3FB6A4");

  const saal = document.getElementById("fst-saal");
  saal.innerHTML = `
    <div class="fst-saal-gloed"></div>
    <div class="fst-skerm" id="fst-skerm">
      ${talk.omslag ? `<img class="fst-skerm-voor" src="${fst_esc(talk.omslag)}" alt="">` : ""}
    </div>`;
  document.getElementById("fst-onder").innerHTML = `
    <h1>${fst_esc(talk.titel)}</h1>
    <p class="fst-onder-wie">${fst_esc(talk.spreker)}${talk.duur_sekondes ? ` · ${fst_esc(fst_duur(talk.duur_sekondes))}` : ""}</p>`;
  fst_teater_teken_program();

  try {
    const resp = await fetch(`/.netlify/functions/kry-kyk-token?slug=${encodeURIComponent(talk.slug)}`, {
      headers: await identiteit_kop(),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    if (fst_teater.huidig !== talk) return; // intussen 'n ander talk gekies

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
    const skerm = document.getElementById("fst-skerm");
    skerm.innerHTML = "";
    skerm.appendChild(speler);
  } catch (fout) {
    console.error("Kon nie die kykskakel kry nie:", fout);
    document.getElementById("fst-skerm").insertAdjacentHTML("beforeend", `<p class="fst-skerm-fout">${fst_esc(t("fst_speler_fout"))}</p>`);
  }
}

async function fst_teater_laai() {
  const sessie = await identiteit_kry_huidige_sessie().catch(() => null);
  if (!sessie) {
    const terug = window.location.pathname + window.location.search;
    window.location.href = `/aanmeld.html?terug=${encodeURIComponent(terug)}`;
    return;
  }

  const bestelnommer = fst_teater_param("bestelnommer");
  if (bestelnommer) await fst_teater_bevestig(bestelnommer);

  try {
    const resp = await fetch("/.netlify/functions/kry-my-talks", { headers: await identiteit_kop() });
    if (resp.status === 401) {
      window.location.href = `/aanmeld.html?terug=${encodeURIComponent("/teater")}`;
      return;
    }
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    fst_teater.talks = (await resp.json()).talks || [];
  } catch (fout) {
    console.error("Kon nie jou talks laai nie:", fout);
    fst_teater_boodskap(`<p>${fst_esc(t("fst_kon_nie_laai"))}</p>`);
    return;
  }

  if (!fst_teater.talks.length) {
    fst_teater_boodskap(`<p>${fst_esc(t("fst_teater_leeg"))}</p><p><a class="fst-knop fst-knop-inlyn" href="/talks">${fst_esc(t("fst_na_talks"))}</a></p>`);
    return;
  }

  const gevra = fst_teater_param("talk");
  const talk = fst_teater.talks.find((x) => x.slug === gevra) || fst_teater.talks[0];
  fst_teater_kies(talk);
}

document.getElementById("fst-kop-plek").outerHTML = fst_kop(true);
document.addEventListener("DOMContentLoaded", fst_teater_laai);
