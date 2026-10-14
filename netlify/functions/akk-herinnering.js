// netlify/functions/akk-herinnering.js
//
// GESKEDULEER (netlify.toml): elke oggend. Soek oop Akkreditasie-sperdatums en
// stuur EEN e-pos met alles wat vandag 'n herinnering moet kry.
//
// DIE DREMPELS. Elke sperdatum dra sy eie keuse: 30 en 7 dae vooraf, 14 en 3
// dae vooraf, of geen. Daarby kom altyd die dag self (0): 'n sperdatum wat
// vandag verval of reeds verby is, kry een laaste herinnering.
//
// EEN KEER PER DREMPEL. herinner_gestuur onthou watter drempels reeds gestuur
// is. Die toets is "binne die drempel en nog nie gestuur nie", nie "presies
// op die drempel nie": loop die skedule een oggend nie, kom die herinnering
// die volgende oggend steeds. Is meer as een drempel gelyk verby (byvoorbeeld
// 'n sperdatum wat binne 5 dae geskep is), gaan net een e-pos uit en word
// almal as gestuur gemerk.
//
// ONTVANGERS: AKK_HERINNER_AAN indien gestel (komma-geskeide adresse), anders
// ADMIN_EPOS, anders die admin-posbus self.
//
// Die e-pos gaan uit die admin-posbus (merk "faktuur", Future Sharp NPC).

const { kry_store } = require("./_blob-store");
const { stuur_epos, ontsnap } = require("./_stuur-epos");
const G = require("./_akk");

const DREMPELS = { "30_7": [30, 7, 0], "14_3": [14, 3, 0], geen: [] };
const BLADSY = "https://futureshop.futuresharp.co.za/akkreditasies.html";

function ontvangers() {
  return process.env.AKK_HERINNER_AAN || process.env.ADMIN_EPOS || process.env.EPOS_ADMIN_GEBRUIKER || "";
}

function datum_af(d) {
  return String(d || "").replace(/-/g, "/");
}

function wanneer(n) {
  if (n < 0) return Math.abs(n) + (Math.abs(n) === 1 ? " dag oorsy" : " dae oorsy");
  if (n === 0) return "vandag";
  return "oor " + n + (n === 1 ? " dag" : " dae");
}

exports.handler = async () => {
  const aan = ontvangers();
  if (!aan) {
    console.error("akk-herinnering: geen ontvanger gestel nie (AKK_HERINNER_AAN of ADMIN_EPOS).");
    return { statusCode: 200, body: "geen ontvanger" };
  }

  const vandag = G.vandag_sa();
  const [sperdatums, vouers] = await Promise.all([G.lees_alles(G.STORE.sperdatums), G.kry_vouers()]);

  const nou_stuur = [];
  for (const s of sperdatums) {
    if (s.klaar || !G.is_datum(s.datum)) continue;
    const drempels = DREMPELS[s.herinner] || DREMPELS["30_7"];
    if (!drempels.length) continue;
    const n = G.dae_tussen(vandag, s.datum);
    const gestuur = Array.isArray(s.herinner_gestuur) ? s.herinner_gestuur : [];
    const verby = drempels.filter((t) => n <= t && !gestuur.includes(t));
    if (!verby.length) continue;
    nou_stuur.push({ s, n, verby });
  }

  if (!nou_stuur.length) return { statusCode: 200, body: "niks om te stuur nie" };

  nou_stuur.sort((a, b) => a.n - b.n);

  const reels = [
    "Die volgende Akkreditasie-sperdatums vra aandag:",
    nou_stuur
      .map(({ s, n }) =>
        "<b>" + ontsnap(s.naam) + "</b><br>" +
        datum_af(s.datum) + " (" + wanneer(n) + ") · " + ontsnap(G.vouer_naam(vouers, s.vouer)))
      .join("<br><br>"),
  ];

  const eerste = nou_stuur[0];
  const onderwerp = nou_stuur.length === 1
    ? "Sperdatum " + wanneer(eerste.n) + ": " + eerste.s.naam
    : nou_stuur.length + " sperdatums vra aandag";

  const uitslag = await stuur_epos({
    aan,
    onderwerp,
    opskrif: "Akkreditasie-sperdatums",
    reels,
    knoppie: { url: BLADSY, teks: "Maak Akkreditasies oop" },
    merk: "faktuur",
  });

  if (!uitslag || !uitslag.ok) {
    // Niks word as gestuur gemerk nie: môre word weer probeer.
    console.error("akk-herinnering: e-pos het misluk:", uitslag && uitslag.fout);
    return { statusCode: 500, body: "e-pos het misluk" };
  }

  const store = kry_store(G.STORE.sperdatums);
  for (const { s, verby } of nou_stuur) {
    s.herinner_gestuur = Array.from(new Set([...(s.herinner_gestuur || []), ...verby]));
    await store.setJSON(s.id, s);
  }

  return { statusCode: 200, body: nou_stuur.length + " herinnering(s) gestuur" };
};
