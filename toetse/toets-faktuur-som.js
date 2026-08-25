// toets-faktuur-som.js
//
// Toetslopie vir faktuur-som.js nÃ¡ die oorgang na verdeling per lynitem.
//
// LOOP HOM SO:   node toets-faktuur-som.js
//
// DIE BELANGRIKSTE TOETS IS DIE KONTROLE, nie een van die verwagte getalle
// nie. Vir ELKE geval moet geld:
//
//     totaal âˆ’ fooi âˆ’ uitbetaal âˆ’ hosting âˆ’ oorskot = 0
//
// Niks word bygetel en niks kan wegraak nie. Wys 'n toets 'n ander getal as
// verwag, is dit dalk 'n beter getal. Wys die kontrole iets anders as nul,
// is die som stukkend.

const { fs_bereken, fs_invoer_uit_faktuur } = require("../public/js/faktuur-som.js");

let geslaag = 0;
let gedruip = 0;

function sent(r) {
  return Math.round(r * 100);
}

function loop(naam, faktuur, verwag) {
  const uit = fs_bereken(fs_invoer_uit_faktuur(faktuur, () => true));

  const totaal = sent(uit.P);
  const fooi = sent(uit.paystack);
  const hosting = sent(uit.hosting);
  const uitbetaal = sent(uit.uitbetaal);
  const oorskot = sent(uit.oorskot);
  const kontrole = totaal - fooi - uitbetaal - hosting - oorskot;

  const foute = [];
  if (kontrole !== 0) foute.push(`KONTROLE ${(kontrole / 100).toFixed(2)}`);

  Object.keys(verwag || {}).forEach((sleutel) => {
    const gekry = { totaal, fooi, hosting, uitbetaal, oorskot }[sleutel];
    if (gekry !== verwag[sleutel]) {
      foute.push(
        `${sleutel}: verwag ${(verwag[sleutel] / 100).toFixed(2)}, gekry ${(
          gekry / 100
        ).toFixed(2)}`
      );
    }
  });

  if (foute.length) {
    gedruip += 1;
    console.log(`DRUIP  ${naam}`);
    foute.forEach((f) => console.log(`         ${f}`));
  } else {
    geslaag += 1;
    console.log(`ok     ${naam}`);
  }
  return uit;
}

// LET OP: in die REKORD staan 'n vaste verdelingswaarde in SENT â€” die
// vertaler deel deur 100. 'n Toets wat `waarde: 1000` skryf en R1 000 bedoel,
// toets R10,00. Dit het hier gebeur en die oorbestee-toets stilweg laat slaag.
function reel(beskrywing, randbedrag, verdeling, opsies) {
  return Object.assign(
    {
      beskrywing,
      hoeveelheid: 1,
      prys_pp_sent: sent(randbedrag),
      soort: "verkoop",
      hosting_pct: 5,
      verdeling: verdeling || [],
    },
    opsies || {}
  );
}

// â”€â”€ Die eenvoudige gevalle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

loop("een reÃ«l, geen verdeling â€” alles bly oor", {
  reels: [reel("Werkswinkel", 1000, [], { hosting_pct: 0 })],
  afslag_sent: 0,
});

loop("een reÃ«l, 70% aan een persoon", {
  reels: [reel("Werkswinkel", 10000, [{ ontvanger: "Eugene", tipe: "pct", waarde: 70 }])],
  afslag_sent: 0,
});

loop("nul rand â€” niks mag ontplof nie", {
  reels: [reel("Gratis", 0, [{ ontvanger: "Eugene", tipe: "pct", waarde: 70 }])],
  afslag_sent: 0,
});

loop("geen reÃ«ls hoegenaamd", { reels: [], afslag_sent: 0 }, {
  totaal: 0,
  fooi: 0,
  uitbetaal: 0,
  oorskot: 0,
});

// â”€â”€ Verdeling per reÃ«l â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const drie = {
  reels: [
    reel("Aanbieding", 12000, [{ ontvanger: "Eugene", tipe: "pct", waarde: 70 }]),
    reel("Vraelys", 5000, [{ ontvanger: "Ignatius", tipe: "pct", waarde: 90 }]),
    reel("Verslag", 3000, [{ ontvanger: "Eugene", tipe: "pct", waarde: 50 }]),
  ],
  afslag_sent: 0,
};

const u_drie = loop("drie reÃ«ls, drie verdelings", drie);

(function eugene_word_opgetel() {
  const eugene = u_drie.ontvangers.filter((o) => o.naam === "Eugene");
  if (eugene.length !== 2) {
    gedruip += 1;
    console.log(`DRUIP  Eugene moet TWEE rye hÃª (een per reÃ«l), gekry ${eugene.length}`);
  } else {
    geslaag += 1;
    console.log("ok     Eugene se twee dele bly apart in ontvangers[]");
  }
})();

// â”€â”€ Die soort van 'n reÃ«l â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

loop("uitgawereÃ«l dra geen hosting nie", {
  reels: [
    reel("Werkswinkel", 10000, [{ ontvanger: "Eugene", tipe: "pct", waarde: 50 }]),
    reel("Reiskoste", 880.83, [{ ontvanger: "Eugene", tipe: "vas", waarde: sent(850) }], {
      soort: "koste",
      hosting_pct: 0,
    }),
  ],
  afslag_sent: 0,
});

(function nul_hosting_oorleef() {
  const inv = fs_invoer_uit_faktuur(
    { reels: [reel("Reiskoste", 1000, [], { soort: "koste", hosting_pct: 0 })], afslag_sent: 0 },
    () => true
  );
  const het = (inv.reels[0].verdeling || []).some((v) => v.ontvanger === "Hosting");
  if (het) {
    gedruip += 1;
    console.log("DRUIP  'n doelbewuste hosting van 0 het 'n Hosting-ry geskep");
  } else {
    geslaag += 1;
    console.log("ok     hosting_pct 0 oorleef die rondreis â€” geen Hosting-ry");
  }
})();

// â”€â”€ Die afslag â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

(function afslag_word_presies_toegeken() {
  const inv = fs_invoer_uit_faktuur(
    {
      reels: [reel("A", 1000, []), reel("B", 333.33, []), reel("C", 66.67, [])],
      afslag_sent: sent(100),
    },
    () => true
  );
  const som = inv.reels.reduce((s, r) => s + sent(r.bedrag), 0);
  const verwag = sent(1000 + 333.33 + 66.67) - sent(100);
  if (som !== verwag) {
    gedruip += 1;
    console.log(
      `DRUIP  afslag: reÃ«ls tel op tot ${(som / 100).toFixed(2)}, verwag ${(
        verwag / 100
      ).toFixed(2)}`
    );
  } else {
    geslaag += 1;
    console.log("ok     die afslag word tot die laaste sent oor die reÃ«ls versprei");
  }
})();

loop("afslag groter as die faktuur â€” mag nie negatief word nie", {
  reels: [reel("Werkswinkel", 1000, [])],
  afslag_sent: sent(5000),
}, { totaal: 0 });

// â”€â”€ Die gevalle wat vanaand uitgekom het â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

loop("opgeloste reiskoste skiet vyf sent oor â€” dit is nie 'n fout nie", {
  reels: [
    reel("Werkswinkel", 20000, [{ ontvanger: "Eugene", tipe: "pct", waarde: 60 }]),
    reel("Reiskoste", 880.83, [{ ontvanger: "Eugene", tipe: "vas", waarde: sent(850) }], {
      soort: "koste",
      hosting_pct: 0,
    }),
  ],
  afslag_sent: 0,
});

const u_oorbestee = loop("'n reÃ«l vra meer as wat die faktuur inbring", {
  reels: [
    reel("Klein werkie", 200, [{ ontvanger: "Eugene", tipe: "vas", waarde: sent(1000) }], {
      soort: "koste",
      hosting_pct: 0,
    }),
  ],
  afslag_sent: 0,
});

(function oorbestee_word_gemerk() {
  if (!u_oorbestee.oorbestee) {
    gedruip += 1;
    console.log("DRUIP  oorbestee moet waar wees");
  } else {
    geslaag += 1;
    console.log("ok     oorbestee word gemerk");
  }
})();

loop("net uitgawes â€” die fooi mag nie verdwyn nie", {
  reels: [
    reel("Reiskoste", 850, [{ ontvanger: "Eugene", tipe: "vas", waarde: sent(850) }], {
      soort: "koste",
      hosting_pct: 0,
    }),
  ],
  afslag_sent: 0,
});

loop("hoeveelheid Ã— eenheidsprys, nie 'n gestoorde bedrag nie", {
  reels: [
    {
      beskrywing: "Vraelyste",
      hoeveelheid: 120,
      prys_pp_sent: sent(40),
      soort: "verkoop",
      hosting_pct: 5,
      verdeling: [{ ontvanger: "Ignatius", tipe: "pct", waarde: 60 }],
    },
  ],
  afslag_sent: 0,
}, { totaal: sent(4800) });

// â”€â”€ Hosting per reÃ«l â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

loop("verskillende hosting per reÃ«l", {
  reels: [
    reel("Aanbieding", 10000, [{ ontvanger: "Eugene", tipe: "pct", waarde: 60 }], {
      hosting_pct: 5,
    }),
    reel("Aanlynkursus", 10000, [{ ontvanger: "Eugene", tipe: "pct", waarde: 60 }], {
      hosting_pct: 15,
    }),
  ],
  afslag_sent: 0,
});

// â”€â”€ Uitslag â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

console.log("");
console.log(`${geslaag} geslaag, ${gedruip} gedruip`);
process.exit(gedruip ? 1 : 0);
