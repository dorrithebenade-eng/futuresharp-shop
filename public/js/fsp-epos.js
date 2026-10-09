// public/js/fsp-epos.js
//
// 'N E-POS MET DIE REGISTRASIESKAKEL, in die Future Sharp-paneel. Eie lêer:
// dit voeg self 'n blok onder die registrasievorm-skakel in, sonder dat
// futuresharp-paneel.js hoef te verander.
//
// Twee knoppies per taal:
//   Kopieer e-pos  die teks na die knipbord, om in 'n antwoord op iemand se
//                  e-posnavraag te plak (die gewone geval).
//   Nuwe e-pos     maak die toestel se e-posprogram oop met die onderwerp en
//                  teks reeds ingevul (mailto:).
// Die e-pos gaan altyd uit jou eie e-posadres. Die skakel kom uit die paneel
// self, sodat dit altyd dieselfde is as wat daar gewys word.

(function () {
  const $ = (s, r = document) => r.querySelector(s);

  const TEKS = {
    af: {
      knop: "Afrikaans",
      onderwerp: "Registrasie vir 'n studievaardigheidskonsultasie by Future Sharp",
      lyf: (skakel) =>
        "Goeiedag\n\n" +
        "Dankie vir jou belangstelling in 'n studievaardigheidskonsultasie.\n\n" +
        "Voltooi asseblief die registrasievorm by die skakel hieronder. Dit neem sowat vyf minute, en jy sien daar ook hoe die konsultasie werk en wat dit kos.\n\n" +
        skakel + "\n\n" +
        "Sodra jy geregistreer het, kontak ons jou om 'n datum te reël.\n\n" +
        "Vriendelike groete\nFuture Sharp",
    },
    en: {
      knop: "English",
      onderwerp: "Registration for a study skills consultation with Future Sharp",
      lyf: (skakel) =>
        "Good day\n\n" +
        "Thank you for your interest in a study skills consultation.\n\n" +
        "Please complete the registration form at the link below. It takes about five minutes, and it also explains how the consultation works and what it costs.\n\n" +
        skakel + "\n\n" +
        "Once you have registered, we will contact you to arrange a date.\n\n" +
        "Kind regards\nFuture Sharp",
    },
  };

  function skakel_vir(taal) {
    const el = $(taal === "en" ? "#fsp-reg-skakel-en" : "#fsp-reg-skakel");
    const s = el ? el.textContent.trim() : "";
    return /^https?:\/\//.test(s) ? s : "";
  }

  function kennis(teks) {
    const k = $("#fsp-kennis");
    if (!k) return;
    k.textContent = teks;
    k.classList.add("wys");
    clearTimeout(kennis.t);
    kennis.t = setTimeout(() => k.classList.remove("wys"), 2600);
  }

  async function kopieer(teks) {
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      const t = document.createElement("textarea");
      t.value = teks;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
  }

  function bou() {
    const strook = $("#fsp-reg-skakel-en") && $("#fsp-reg-skakel-en").closest(".fsp-strook");
    if (!strook || $("#fsp-epos")) return;
    const blok = document.createElement("div");
    blok.className = "fsp-epos";
    blok.id = "fsp-epos";
    blok.innerHTML =
      '<div class="fsp-epos-titel">E-pos met die skakel</div>' +
      '<p class="fsp-epos-hulp">Kopieer die e-pos om dit in jou antwoord op iemand se navraag te plak, of begin \'n nuwe e-pos.</p>' +
      ["af", "en"].map((t) =>
        '<div class="fsp-epos-ry"><span class="fsp-strook-taal">' + TEKS[t].knop + "</span>" +
        '<button type="button" class="fsp-knop fsp-knop-lig" data-epos-kopieer="' + t + '">Kopieer e-pos</button>' +
        '<button type="button" class="fsp-knop fsp-knop-lig" data-epos-nuut="' + t + '">Nuwe e-pos</button></div>'
      ).join("");
    strook.insertAdjacentElement("afterend", blok);

    blok.addEventListener("click", async (e) => {
      const k = e.target.closest("[data-epos-kopieer]");
      const n = e.target.closest("[data-epos-nuut]");
      const taal = (k && k.dataset.eposKopieer) || (n && n.dataset.eposNuut);
      if (!taal) return;
      const skakel = skakel_vir(taal);
      if (!skakel) return kennis("Die skakel is nog nie gelaai nie");
      const t = TEKS[taal];
      if (k) {
        await kopieer(t.lyf(skakel));
        kennis("E-pos gekopieer");
      } else {
        location.href = "mailto:?subject=" + encodeURIComponent(t.onderwerp) + "&body=" + encodeURIComponent(t.lyf(skakel));
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bou);
})();
