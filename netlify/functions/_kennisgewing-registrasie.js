// netlify/functions/_kennisgewing-registrasie.js
//
// Die pos wat die admin kry wanneer iemand sy inligting via 'n
// uitnodigingskakel voltooi het.
//
// DIE POS BEVAT NET DIE NAAM, DIE ROL EN DIE SKAKEL. Die ingediende
// inligting (bankbesonderhede, ID-nommer, adres) hoort nie in 'n posbus
// nie; wie dit wil sien, maak die paneelbord oop.
//
// WAARHEEN: REGISTRASIE_EPOS as dit in Netlify gestel is, anders
// dorrithe@futuresharp.co.za. 'n Ander adres is later net 'n instelling.
//
// DIE POS MAG NOOIT DIE REGISTRASIE LAAT MISLUK NIE. Teen die tyd dat dit
// gestuur word, is die inskrywing reeds gestoor. Hierdie module gooi
// nooit en gee { gestuur, rede } terug.

const { stuur_epos, ontsnap } = require("./_stuur-epos");

const WERF_URL = "https://futureshop.futuresharp.co.za";
const VERSTEK_ADRES = "dorrithe@futuresharp.co.za";

const ROL_ETIKETTE = {
  outeur: "outeur",
  spreker: "spreker",
  vennoot: "vennoot",
  ontwerp_admin: "ontwerp-admin",
  printing: "drukker",
  aflewering: "afleweringsdiens",
};

function admin_adres() {
  return process.env.REGISTRASIE_EPOS || VERSTEK_ADRES;
}

function bou_registrasie_pos(naam, rol_tipe) {
  const rol = ROL_ETIKETTE[rol_tipe] || rol_tipe || "persoon";
  return {
    onderwerp: `Nuwe ${rol} geregistreer: ${naam}`,
    opskrif: `Nuwe ${rol} geregistreer`,
    reels: [
      `<b>${ontsnap(naam)}</b> het die uitnodigingskakel gebruik en sy inligting as ${ontsnap(rol)} voltooi.`,
    ],
    knoppie: { teks: "Maak die paneelbord oop", url: `${WERF_URL}/paneelbord.html` },
  };
}

async function stuur_registrasie_kennisgewing(naam, rol_tipe) {
  try {
    const aan = admin_adres();
    const { onderwerp, opskrif, reels, knoppie } = bou_registrasie_pos(naam, rol_tipe);

    const uitslag = await stuur_epos({ aan, onderwerp, opskrif, reels, knoppie });
    if (!uitslag.ok) {
      console.error(`Registrasie-pos vir "${naam}" het misluk:`, uitslag.fout);
      return { gestuur: false, rede: uitslag.fout };
    }
    return { gestuur: true, rede: null };
  } catch (fout) {
    console.error("Registrasie-pos het gestort:", fout && fout.message);
    return { gestuur: false, rede: (fout && fout.message) || "onbekende fout" };
  }
}

module.exports = { stuur_registrasie_kennisgewing, bou_registrasie_pos };
