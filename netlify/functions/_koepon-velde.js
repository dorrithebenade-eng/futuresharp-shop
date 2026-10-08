// Koepons — bou en valideer die velde wat personeel in die koeponvorm stel.
// Gedeel deur skep-koepon.js en wysig-koepon.js, sodat 'n nuwe en 'n
// gewysigde koepon presies dieselfde reëls volg.
//
// DIE VELDE WORD EEN VIR EEN GEBOU, nie met ...invoer nie. Die kode self,
// die gebruike, die geskiedenis, aktief en koper_id_beperking hoort nie
// hier nie: skep-koepon.js stel hulle by die skep, en wysig-koepon.js behou
// hulle uit die bestaande rekord.

const GELDIGE_FORMATE = ["eboek", "harde_kopie", "leen", "albei", "video"];

// Gee { velde } terug, of { fout } by 'n ongeldige invoer.
function bou_koepon_velde(invoer) {
  const tipe = invoer.tipe === "afslag" ? "afslag" : "gratis";
  // "video" = 'n FutureSharp Talks-koepon (sien _talk-koepon.js); die boeke
  // se betaling aanvaar dit nooit.
  const formaat_beperking = GELDIGE_FORMATE.includes(invoer.formaat_beperking) ? invoer.formaat_beperking : "albei";
  const produk_slug = invoer.produk_slug ? String(invoer.produk_slug).trim() : null; // null = enige boek/talk
  const outeur_id = invoer.outeur_id ? String(invoer.outeur_id).trim() : null;
  // Net vir talk-koepons: beperk tot die talks van een spreker.
  const spreker_id = formaat_beperking === "video" && invoer.spreker_id ? String(invoer.spreker_id).trim() : null;
  const nota = invoer.nota ? String(invoer.nota).trim().slice(0, 300) : "";

  const maks_gebruike = Number.isInteger(invoer.maks_gebruike) && invoer.maks_gebruike > 0 ? invoer.maks_gebruike : 1;

  let verval_op = null;
  if (invoer.verval_op) {
    const datum = new Date(invoer.verval_op);
    if (Number.isNaN(datum.getTime())) return { fout: "Ongeldige vervaldatum" };
    verval_op = datum.toISOString();
  }

  let afslag_tipe = null;
  let afslag_waarde = null;
  if (tipe === "afslag") {
    afslag_tipe = invoer.afslag_tipe === "vaste_bedrag" ? "vaste_bedrag" : "persentasie";
    afslag_waarde = Number(invoer.afslag_waarde);

    if (!Number.isFinite(afslag_waarde) || afslag_waarde <= 0) {
      return { fout: "Verpligte veld: afslag_waarde (groter as 0)" };
    }
    if (afslag_tipe === "persentasie" && afslag_waarde > 100) {
      return { fout: "Persentasie-afslag kan nie meer as 100 wees nie" };
    }

    // 'n Vaste bedrag word in RAND ingetik (die vorm se etiket lees
    // "Vaste bedrag (R)") maar moet in SENT gestoor word: die eenheid wat
    // begin-betaling.js, verifieer-koepon.js en _talk-koepon.js aftrek.
    // Dit gebeur bediener-kant sodat 'n versoek wat die paneelvorm omseil
    // dit nie kan misloop nie. 'n Persentasie bly 'n gewone getal.
    if (afslag_tipe === "vaste_bedrag") {
      afslag_waarde = Math.round(afslag_waarde * 100);
    }
  }

  return {
    velde: {
      tipe,
      afslag_tipe,
      afslag_waarde,
      produk_slug,
      formaat_beperking,
      maks_gebruike,
      verval_op,
      outeur_id,
      spreker_id,
      nota,
    },
  };
}

module.exports = { bou_koepon_velde };
