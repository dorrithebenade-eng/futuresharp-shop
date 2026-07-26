// Publieke Function — enigiemand wat die tuisblad oopmaak, haal die
// huidige winkel-wye bannier (indien enige) op. Geen aanmelding nodig nie.

const { kry_store } = require("./_blob-store");

const KENNISGEWING_SLEUTEL = "winkel-kennisgewing";

exports.handler = async () => {
  try {
    const store = kry_store("instellings");
    const kennisgewing = await store.get(KENNISGEWING_SLEUTEL, { type: "json" });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aktief: Boolean(kennisgewing && kennisgewing.aktief && kennisgewing.teks),
        teks: (kennisgewing && kennisgewing.teks) || "",
      }),
    };
  } catch (fout) {
    console.error("kry-kennisgewing fout:", fout);
    // Val gragvol terug — 'n winkel-bannier wat nie laai nie, moet nooit
    // die res van die tuisblad saam met dit breek nie.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktief: false, teks: "" }),
    };
  }
};
