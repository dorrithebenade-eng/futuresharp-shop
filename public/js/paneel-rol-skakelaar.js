// paneel-rol-skakelaar.js — "Outeurspaneel | Sprekerspaneel" bo-aan die
// paneel, net vir iemand wat albei is (soos Ignatius). FutureSharp Talks.
//
// Die kop kry so geen ekstra item nie: wie albei is, sien Outeurspaneel in
// die kop en skakel hier oor. Die skakelaar vra net of die ANDER rol
// bestaan; die huidige bladsy weet reeds wie hy is.
//
//   paneel_rol_skakelaar("outeur")   op outeur.html
//   paneel_rol_skakelaar("spreker")  op spreker.html
//
// Die houer is #paneel-rol-plek; bestaan dit nie, word die skakelaar net
// voor die band ingesit. Laai na taal.js en identiteit.js.

const PRS_WOORDE = {
  outeur: { af: "Outeurspaneel", en: "Author panel" },
  spreker: { af: "Sprekerspaneel", en: "Speaker panel" },
};

async function paneel_rol_skakelaar(huidig) {
  const ander = huidig === "outeur" ? "spreker" : "outeur";
  const eindpunt = ander === "spreker" ? "/.netlify/functions/kry-my-spreker?kort=1" : "/.netlify/functions/kry-my-outeur";
  try {
    const resp = await fetch(eindpunt, { headers: await identiteit_kop() });
    if (!resp.ok) return;
  } catch {
    return;
  }

  const taal = typeof kry_huidige_taal === "function" ? kry_huidige_taal() : "af";
  const knop = (rol) => rol === huidig
    ? `<span class="prs-knop prs-aan" aria-current="page">${PRS_WOORDE[rol][taal]}</span>`
    : `<a class="prs-knop" href="${rol === "outeur" ? "outeur.html" : "spreker.html"}">${PRS_WOORDE[rol][taal]}</a>`;

  const html = `<div class="prs"><div class="prs-seg" role="group" aria-label="Paneel">${knop("outeur")}${knop("spreker")}</div></div>`;
  const plek = document.getElementById("paneel-rol-plek");
  if (plek) {
    plek.innerHTML = html;
  } else {
    const band = document.querySelector(".outeur-band, .sp-band");
    if (band) band.insertAdjacentHTML("beforebegin", html);
  }

  if (!document.getElementById("prs-styl")) {
    const styl = document.createElement("style");
    styl.id = "prs-styl";
    styl.textContent = `
      .prs { max-width: 1100px; margin: 14px auto 12px; padding: 0 24px; }
      .prs-seg { display: inline-flex; background: #fff; border: 1px solid #e3e1db; border-radius: 999px; padding: 3px; }
      .prs-knop { border-radius: 999px; padding: 7px 16px; font-family: var(--font-liggaam); font-weight: 600; font-size: 13.5px; color: var(--grys-teks); text-decoration: none; }
      .prs-knop:hover { color: var(--swart); }
      .prs-aan { background: var(--swart); color: #fff; }
      .prs-aan:hover { color: #fff; }
    `;
    document.head.appendChild(styl);
  }
}
