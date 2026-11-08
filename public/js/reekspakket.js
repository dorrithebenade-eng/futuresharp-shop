// reekspakket.js
//
// REEKSPAKKETTE (Oktober 2026). Wie al die e-boeke van 'n reeks in die
// mandjie het, betaal die pakketprys (bv. die 6 Speel-Slim-boeke vir R1 000).
// Die bediener bereken die prys (kry-mandjie-prys, begin-betaling); hierdie
// lêer wys dit net:
//
//   produk.html          -> 'n blok onder die koop-knoppies met
//                           "Sit die hele reeks in my mandjie"
//   mandjie.html         -> 'n reël "Reekspakket: ..." met die afslag, en die
//                           regte totaal
//   voltooi-betaling.html-> gebruik reekspakket_kry_mandjie_prys() (sien
//                           voltooi-betaling.js)

(function () {
  const PAKKETTE_ENDPOINT = "/.netlify/functions/reekspakkette";
  const MANDJIE_PRYS_ENDPOINT = "/.netlify/functions/kry-mandjie-prys";

  const formateer = (sent) => `R${(sent / 100).toFixed(2)}`;
  // R1 000, sonder sent, vir opskrifte.
  const formateer_rond = (sent) => "R" + Math.round(sent / 100).toLocaleString("en-ZA").replace(/,/g, " ");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const taal = () => (typeof kry_huidige_taal === "function" ? kry_huidige_taal() : "af");
  const naam = (p) => (taal() === "en" ? p.naam_en || p.naam_af : p.naam_af);
  const tt = (sleutel, terugval) => (typeof t === "function" ? t(sleutel) : terugval) || terugval;

  function datum_kort(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(taal() === "en" ? "en-ZA" : "af-ZA", {
        day: "numeric",
        month: "long",
        timeZone: "Africa/Johannesburg",
      });
    } catch (_) {
      return "";
    }
  }

  // Vir voltooi-betaling.js en die mandjie: die bediener se berekening.
  async function kry_mandjie_prys(items) {
    if (!items || !items.length) return null;
    const resp = await fetch(MANDJIE_PRYS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ produk_slug: i.produk_slug, formaat: i.formaat, ...(i.opsie ? { opsie: i.opsie } : {}), ...(i.geskenk ? { geskenk: true } : {}) })),
      }),
    });
    if (!resp.ok) return null;
    return resp.json();
  }

  function pakket_lyne_html(pakkette, klas) {
    return (pakkette || [])
      .map(
        (p) => `
      <div class="${klas} reekspakket-ry">
        <span>${esc(tt("pakket_reel", "Reekspakket"))}: ${esc(naam(p))}${p.geskenk ? " 🎁" : ""}</span>
        <span>−${formateer(p.afslag_sent)}</span>
      </div>`
      )
      .join("");
  }

  // WENKE (November 2026): die winkel keer niemand nie, maar wys wat 'n
  // ekstra boek of die basisboek (bv. Grondslag) sou beteken.
  function wenke_html(wenke) {
    const vul = (s, w) => String(s).replace("%titel%", esc(w.titel || "")).replace("%n%", w.nodig).replace("%prys%", formateer_rond(w.prys_per_boek_sent || w.prys_sent || 0));
    return (wenke || [])
      .map((w) => {
        if (w.soort === "basis") {
          return `<div class="reekspakket-wenk">💡 ${vul(tt("wenk_basis", "%titel% vorm die basis van die reeks."), w)}
            ${w.prys_sent ? `<button type="button" class="terug-skakel reekspakket-wenk-voeg" data-slug="${esc(w.slug)}" data-titel="${esc(w.titel)}" data-prys="${w.prys_sent}">${vul(tt("wenk_basis_knoppie", "Voeg %titel% by"), w)}</button>` : ""}</div>`;
        }
        const sleutel = `wenk_${w.soort}_${w.nodig === 1 ? "een" : "meer"}`;
        return `<div class="reekspakket-wenk">💡 ${vul(tt(sleutel, ""), w)}</div>`;
      })
      .join("");
  }

  function koppel_wenke(wrap, na) {
    wrap.querySelectorAll(".reekspakket-wenk-voeg").forEach((b) =>
      b.addEventListener("click", () => {
        if (typeof voeg_by_mandjie !== "function") return;
        voeg_by_mandjie({ produk_slug: b.dataset.slug, titel: b.dataset.titel, formaat: "eboek", prys_sent: Number(b.dataset.prys) || 0 });
        if (typeof na === "function") na();
      })
    );
  }

  window.reekspakket_wenke_html = wenke_html;
  window.reekspakket_koppel_wenke = koppel_wenke;
  window.reekspakket_kry_mandjie_prys = kry_mandjie_prys;
  window.reekspakket_lyne_html = pakket_lyne_html;

  // ----------------------------------------------------------- produkbladsy

  async function produkbladsy() {
    const wrap = document.getElementById("produk-wrap");
    if (!wrap) return;
    const slug = new URLSearchParams(location.search).get("produk");
    if (!slug) return;

    let pakkette = [];
    try {
      const resp = await fetch(PAKKETTE_ENDPOINT);
      if (resp.ok) pakkette = (await resp.json()).pakkette || [];
    } catch (_) {
      return;
    }
    const pakket = pakkette.find((p) => p.slugs.includes(slug));
    if (!pakket || !(pakket.prys_sent < pakket.los_sent)) return;

    const teken = () => {
      const aksies = wrap.querySelector(".produk-aksies");
      if (!aksies || wrap.querySelector(".reekspakket-blok")) return;
      // Wie die boek reeds besit, kan nie die hele reeks vir homself koop nie,
      // maar wel as geskenk gee.
      const besit_reeds = !!aksies.querySelector(".produk-alreeds-eie-knoppie");

      // Die prys wat die koper werklik betaal: met die vrystellingskode as daar
      // een op die hele reeks geld (pakket.aanbod, sien reekspakkette.js).
      const aanbod = pakket.aanbod;
      const betaal = aanbod ? aanbod.prys_sent : pakket.prys_sent;
      const tot = datum_kort(aanbod && aanbod.tot ? aanbod.tot : pakket.tot);
      const hk = pakket.harde_kopie;
      const blok = document.createElement("div");
      blok.className = "reekspakket-blok";
      // Een keuse (e-boek of gedruk), een prys, een knoppie. Die gewone prys
      // is die pakket se prys sonder die vrystellingskode.
      const pryse = {
        eboek: { betaal, gewoon: pakket.prys_sent },
        harde_kopie: hk ? { betaal: betaal + hk.druk_sent, gewoon: pakket.prys_sent + hk.druk_sent } : null,
      };
      let formaat = "eboek";
      blok.innerHTML = `
        ${tot ? `<span class="reekspakket-etiket">${esc(aanbod ? tt("pakket_aanbod_tot", "Vrystellingsaanbod tot") : tt("pakket_tot", "Tot"))} ${esc(tot)}</span>` : ""}
        <p class="reekspakket-kop">${esc(naam(pakket))}</p>
        <p class="reekspakket-sub">${esc(tt("pakket_al", "Al"))} ${pakket.slugs.length} ${esc(tt("pakket_boeke", "boeke"))}</p>
        ${hk ? `<div class="reekspakket-formaat" role="radiogroup">
          <button type="button" data-f="eboek" class="aan">${esc(tt("eboek_etiket", "E-boek"))}</button>
          <button type="button" data-f="harde_kopie">${esc(tt("hardekopie_etiket", "Harde kopie"))}</button>
        </div>` : ""}
        <p class="reekspakket-prys"><b></b> <s></s></p>
        ${besit_reeds ? "" : `<button type="button" class="kaart-aksie reekspakket-knoppie">${esc(tt("pakket_knoppie", "Sit die hele reeks in my mandjie"))}</button>`}
        <button type="button" class="reekspakket-geskenk-skakel">🎁 ${esc(tt("pakket_geskenk_knoppie", "Gee die hele reeks as geskenk"))}</button>
      `;
      aksies.insertAdjacentElement("afterend", blok);

      const wys = () => {
        const p = pryse[formaat];
        blok.querySelector(".reekspakket-prys b").textContent = formateer_rond(p.betaal);
        blok.querySelector(".reekspakket-prys s").textContent = p.betaal < p.gewoon ? formateer_rond(p.gewoon) : "";
        blok.querySelectorAll(".reekspakket-formaat button").forEach((k) => k.classList.toggle("aan", k.dataset.f === formaat));
        // Geskenke is net e-boeke.
        blok.querySelector(".reekspakket-geskenk-skakel").hidden = formaat !== "eboek";
      };
      blok.querySelectorAll(".reekspakket-formaat button").forEach((k) =>
        k.addEventListener("click", () => {
          formaat = k.dataset.f;
          wys();
        })
      );
      wys();

      const sit_in = (geskenk, formaat) => {
        for (const boek of pakket.boeke) {
          if (typeof voeg_by_mandjie === "function") {
            voeg_by_mandjie({
              produk_slug: boek.slug,
              titel: boek.titel,
              formaat,
              prys_sent: formaat === "harde_kopie" ? boek.hk_prys_sent || boek.prys_sent : boek.prys_sent,
              ...(geskenk ? { geskenk: true } : {}),
            });
          }
        }
        // Die vrystellingskode gaan saam na die betaalbladsy (voltooi-betaling.js).
        if (aanbod && aanbod.kode) {
          try {
            localStorage.setItem("future_shop_koepon", JSON.stringify({ kode: aanbod.kode, op: Date.now() }));
          } catch (_) {
            /* die koper kan die kode self intik */
          }
        }
        window.location.href = "mandjie.html";
      };
      const self_knoppie = blok.querySelector(".reekspakket-knoppie");
      if (self_knoppie) self_knoppie.addEventListener("click", () => sit_in(false, formaat));
      blok.querySelector(".reekspakket-geskenk-skakel").addEventListener("click", () => sit_in(true, "eboek"));
    };

    teken();
    new MutationObserver(teken).observe(wrap, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------- mandjie

  let mandjie_besig = false;
  async function mandjiebladsy() {
    const wrap = document.getElementById("mandjie-inhoud");
    if (!wrap) return;

    const werk_by = async () => {
      if (mandjie_besig) return;
      const totaal_ry = wrap.querySelector(".mandjie-totaal-ry");
      if (!totaal_ry || wrap.querySelector(".reekspakket-ry") || totaal_ry.dataset.nagegaan) return;
      mandjie_besig = true;
      totaal_ry.dataset.nagegaan = "1";
      try {
        const prys = await kry_mandjie_prys(typeof kry_mandjie === "function" ? kry_mandjie() : []);
        if (prys && prys.pakkette && prys.pakkette.length && wrap.contains(totaal_ry)) {
          totaal_ry.insertAdjacentHTML("beforebegin", pakket_lyne_html(prys.pakkette, "mandjie-totaal-ry"));
          const bedrag = totaal_ry.querySelector(".mandjie-totaal-bedrag");
          if (bedrag) bedrag.textContent = formateer(prys.totaal_sent);
        }
        if (prys && prys.wenke && prys.wenke.length && wrap.contains(totaal_ry) && !wrap.querySelector(".reekspakket-wenke")) {
          totaal_ry.insertAdjacentHTML("afterend", `<div class="reekspakket-wenke">${wenke_html(prys.wenke)}</div>`);
          koppel_wenke(wrap, () => {
            if (typeof wys_mandjie === "function") wys_mandjie();
          });
        }
      } catch (_) {
        /* die gewone totaal bly staan */
      } finally {
        mandjie_besig = false;
      }
    };

    werk_by();
    new MutationObserver(werk_by).observe(wrap, { childList: true, subtree: true });
  }

  function styl() {
    if (document.getElementById("reekspakket-styl")) return;
    const s = document.createElement("style");
    s.id = "reekspakket-styl";
    s.textContent = `
      .reekspakket-blok{margin-top:16px;border:2px dashed var(--teal,#479F91);border-radius:12px;padding:14px 16px;background:#eef7f5}
      .reekspakket-etiket{display:inline-block;background:#171717;color:#fff;font-size:11px;font-weight:700;letter-spacing:.1em;padding:4px 8px;border-radius:4px;text-transform:uppercase}
      .reekspakket-teks{margin:8px 0 10px;font-size:15px;line-height:1.45}
      .reekspakket-teks s{color:#999}
      .reekspakket-knoppie{width:100%;background:var(--teal,#479F91);border-color:var(--teal,#479F91)}
      .reekspakket-kop{margin:10px 0 0;font-weight:700;font-size:17px}
      .reekspakket-sub{margin:2px 0 10px;font-size:14px;color:#6b6b6b}
      .reekspakket-formaat{display:flex;gap:6px;margin:0 0 10px}
      .reekspakket-formaat button{flex:1;padding:9px 10px;border-radius:999px;border:2px solid var(--teal,#479F91);background:#fff;color:var(--teal,#479F91);font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}
      .reekspakket-formaat button.aan{background:var(--teal,#479F91);color:#fff}
      .reekspakket-prys{margin:0 0 12px;font-size:15px;color:#8A877E}
      .reekspakket-prys b{font-size:28px;color:#1B1B19}
      .reekspakket-geskenk-skakel{display:block;margin:10px auto 0;background:none;border:0;color:var(--teal,#479F91);font-weight:700;font-size:14px;text-decoration:underline;cursor:pointer;font-family:inherit}
      .reekspakket-geskenk-knoppie{width:100%;margin-top:8px;background:#fff;color:var(--teal,#479F91);border:2px solid var(--teal,#479F91)}
      .reekspakket-ry{color:var(--teal,#479F91);font-weight:700}
      .reekspakket-wenke{margin:10px 0 14px;display:flex;flex-direction:column;gap:8px}
      .reekspakket-wenk{background:#FDF6E3;border:1px solid #F0DFA8;border-radius:10px;padding:10px 14px;font-size:14px;line-height:1.45}
      .reekspakket-wenk-voeg{margin-left:6px;font-weight:700}
    `;
    document.head.appendChild(s);
  }

  document.addEventListener("DOMContentLoaded", () => {
    styl();
    produkbladsy();
    mandjiebladsy();
  });
})();
