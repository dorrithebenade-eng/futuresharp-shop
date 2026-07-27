// leser-aflyn.js
// Hanteer plaaslike (aflyn) berging van e-boek-PDF's binne die blaaiser
// self, via IndexedDB — sodat 'n koper 'n boek kan bly lees in ONS eie
// leser (leser.html) selfs sonder internet, ná hulle dit een keer met
// data oopgemaak het. Geen aparte lêer-aflaai na 'n ander PDF-toepassing
// toe nie — die boek bly heeltemal binne hierdie leser.
//
// Werking: die eerste keer wat 'n koper 'n boek oopmaak (met internet),
// stoor ons die PDF se rou grepe plaaslik. Elke volgende keer (met of
// sonder internet) word eers hier gekyk of die boek reeds plaaslik is —
// as wel, word GEEN netwerk-versoek gemaak nie (geen token, geen
// data-gebruik). Dit gebeur outomaties, sonder dat die koper enigiets
// hoef te doen.

const AFLYN_DB_NAAM = "future_shop_aflyn_boeke";
const AFLYN_DB_WEERGAWE = 1;
const AFLYN_STORE_NAAM = "boeke";

function aflyn_open_db() {
  return new Promise((resolve, reject) => {
    const versoek = indexedDB.open(AFLYN_DB_NAAM, AFLYN_DB_WEERGAWE);

    versoek.onupgradeneeded = () => {
      const db = versoek.result;
      if (!db.objectStoreNames.contains(AFLYN_STORE_NAAM)) {
        db.createObjectStore(AFLYN_STORE_NAAM); // sleutel = produk_slug
      }
    };

    versoek.onsuccess = () => resolve(versoek.result);
    versoek.onerror = () => reject(versoek.error);
  });
}

// Gee die boek se PDF-grepe (ArrayBuffer) terug indien dit reeds plaaslik
// gestoor is, of null as dit nog nie afgelaai is nie (of IndexedDB nie
// beskikbaar is nie — bv. privaat/inkognito-modus in sommige blaaiers).
async function aflyn_kry_boek(produk_slug) {
  try {
    const db = await aflyn_open_db();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(AFLYN_STORE_NAAM, "readonly");
      const versoek = tx.objectStore(AFLYN_STORE_NAAM).get(produk_slug);
      versoek.onsuccess = () => resolve(versoek.result || null);
      versoek.onerror = () => reject(versoek.error);
    });
  } catch (fout) {
    console.warn("Kon nie plaaslike boek-berging lees nie:", fout);
    return null;
  }
}

// Stoor die boek se PDF-grepe plaaslik — "beste-poging": as dit misluk
// (bv. blaaiser-bergingslimiet bereik, of privaat-modus), word die fout
// net stilweg aangeteken; die koper kan steeds normaal aanlyn lees, hulle
// verloor net die aflyn-gemak vir hierdie boek.
async function aflyn_stoor_boek(produk_slug, pdf_grepe) {
  try {
    const db = await aflyn_open_db();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(AFLYN_STORE_NAAM, "readwrite");
      tx.objectStore(AFLYN_STORE_NAAM).put(pdf_grepe, produk_slug);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (fout) {
    console.warn(`Kon nie "${produk_slug}" plaaslik stoor vir aflyn-lees nie:`, fout);
  }
}

// Verwyder 'n spesifieke boek se plaaslike kopie (bv. as personeel die
// e-boek-lêer vervang het, of as die koper berging wil vrymaak).
async function aflyn_verwyder_boek(produk_slug) {
  try {
    const db = await aflyn_open_db();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(AFLYN_STORE_NAAM, "readwrite");
      tx.objectStore(AFLYN_STORE_NAAM).delete(produk_slug);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (fout) {
    console.warn(`Kon nie "${produk_slug}" se plaaslike kopie verwyder nie:`, fout);
  }
}
