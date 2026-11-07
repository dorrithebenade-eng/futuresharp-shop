// Die drie produkvelde vir 'n boek met 'n eie webblad (November 2026).
// Gedeel deur skep-produk.js en wysig-produk.js, sodat albei dieselfde
// reëls toepas.
//
//   ongelys            true: te koop deur 'n direkte skakel, maar nie in
//                      die winkel se lyste nie (sien kry-katalogus.js).
//   eie_webblad        https-adres. produk.html stuur besoekers soontoe.
//   kaartjie_boodskap  true: die betaalbladsy vra 'n opsionele boodskap
//                      vir die kaartjie (byvoorbeeld 'n geskenkboks).

function kry_geldige_webblad(waarde) {
  const teks = String(waarde || "").trim();
  if (!teks) return "";
  try {
    const url = new URL(teks);
    if (url.protocol !== "https:") return "";
    return url.toString().slice(0, 300);
  } catch {
    return "";
  }
}

// invoer: die versoek se velde. bestaande: die huidige rekord (of null by
// skep). 'n Veld wat nie in die invoer is nie, behou sy huidige waarde.
function kry_webblad_velde(invoer, bestaande) {
  const ou = bestaande || {};
  return {
    ongelys: "ongelys" in invoer ? invoer.ongelys === true : ou.ongelys === true,
    eie_webblad: "eie_webblad" in invoer ? kry_geldige_webblad(invoer.eie_webblad) : ou.eie_webblad || "",
    kaartjie_boodskap: "kaartjie_boodskap" in invoer
      ? invoer.kaartjie_boodskap === true
      : ou.kaartjie_boodskap === true,
  };
}

module.exports = { kry_webblad_velde, kry_geldige_webblad };
