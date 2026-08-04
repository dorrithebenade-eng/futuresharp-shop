// netlify/functions/_outeur-aandeel.js
//
// BEDIENERLEER — geen blaaier-API's hier nie. Kom daar ooit 'n verwysing
// na `document` of `window` in hierdie lêer, is dit die verkeerde lêer.
//
// Een plek waar bereken word wat 'n outeur uit 'n item kry, en wie by 'n
// item betrokke is. Dit is dieselfde logika wat _kennisgewing-outeur.js
// reeds gebruik en wat teen werklike bestellings getoets is.
//
// WAAROM 'N EIE MODULE: die outeurspaneelbord moet presies dieselfde som
// maak as die kennisgewingspos. Wyk hulle uiteen, sien 'n outeur een bedrag
// op sy skerm en 'n ander in sy inkassie, en dan is daar geen manier om te
// sê watter een reg is nie.
//
// _kennisgewing-outeur.js hou voorlopig sy eie kopie — dit werk, en om dit
// nou te verander is 'n risiko sonder wins. Wanneer daar 'n rede is om
// daardie lêer in elk geval oop te maak, kan dit hierheen wys.

// Tel op wat hierdie een outeur uit hierdie een item kry.
//
// Die vangnet vir die ou skema ({ outeur_id } in plaas van { rol_tipe,
// entiteit_id }) bly nodig: ouer produkte in die katalogus is nooit
// oorgeskryf nie, en 'n boek wat sy verdeling voor die skema-verandering
// gekry het, sou andersins stilweg R0 wys.
//
// 'n Vaste bedrag word by die prys gekap. Verkoop 'n boek teen 'n koepon
// goedkoper as die vaste bedrag, kan die outeur nie meer kry as wat die
// koper betaal het nie.
function outeur_aandeel_sent(verdelings, outeur_id, prys_sent) {
  let som = 0;
  for (const v of verdelings || []) {
    if (!v) continue;
    const rol_tipe = v.rol_tipe || (v.outeur_id ? "outeur" : null);
    const entiteit_id = v.entiteit_id || v.outeur_id;
    if (rol_tipe !== "outeur" || entiteit_id !== outeur_id) continue;

    som +=
      v.tipe === "vaste_bedrag"
        ? Math.min(v.waarde, prys_sent)
        : Math.round((prys_sent * v.waarde) / 100);
  }
  return som;
}

// Wie is by hierdie item betrokke? Twee bronne, want hulle val nie saam
// nie: 'n outeur kan op die produk gekrediteer wees sonder 'n verdeling
// (hy skryf, maar die geld gaan elders heen), en hy kan 'n verdeling hê
// sonder om gekrediteer te wees (byvoorbeeld 'n vertaler wat as outeur
// betaal word).
function outeur_ids_vir_item(produk, formaat_data) {
  const ids = new Set();

  for (const id of (produk && produk.outeur_ids) || []) {
    if (id) ids.add(id);
  }
  for (const v of (formaat_data && formaat_data.verdelings) || []) {
    if (!v) continue;
    const rol_tipe = v.rol_tipe || (v.outeur_id ? "outeur" : null);
    const entiteit_id = v.entiteit_id || v.outeur_id;
    if (rol_tipe === "outeur" && entiteit_id) ids.add(entiteit_id);
  }
  return [...ids];
}

// Kom hierdie outeur enigsins by hierdie produk voor — in enige formaat?
//
// LET WEL: hier word ALLE drie formate gekyk, ook `leen`. kry-verslag.js
// kyk net na eboek en harde_kopie en mis dus 'n boek wat slegs geleen
// word. Dit is 'n bestaande fout in daardie lêer, nie hier nie.
function outeur_by_produk_betrokke(produk, outeur_id) {
  if (!produk) return false;

  if (Array.isArray(produk.outeur_ids) && produk.outeur_ids.includes(outeur_id)) {
    return true;
  }

  const formate = produk.formate || {};
  return ["eboek", "harde_kopie", "leen"].some((naam) =>
    ((formate[naam] && formate[naam].verdelings) || []).some((v) => {
      if (!v) return false;
      const rol_tipe = v.rol_tipe || (v.outeur_id ? "outeur" : null);
      const entiteit_id = v.entiteit_id || v.outeur_id;
      return rol_tipe === "outeur" && entiteit_id === outeur_id;
    })
  );
}

module.exports = {
  outeur_aandeel_sent,
  outeur_ids_vir_item,
  outeur_by_produk_betrokke,
};
