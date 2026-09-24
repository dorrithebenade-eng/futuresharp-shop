// public/js/fsp-foto.js
//
// DIE LEERDER SE FOTO IN DIE FUTURE SHARP-PANEEL. Eie lêer: dit haak self in
// by die leerder se kop sodra die paneel 'n leerder oopmaak, sonder dat
// futuresharp-paneel.js hoef te verander.
//
// Net vir Dorrithé en Ignatius, om die kind te onthou. Die foto word op die
// toestel klein gemaak (hoogstens 600 pixels, JPEG) voordat dit oplaai, en
// geënkripteer in die portaal gestoor.

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const MAKS = 600;
  const kas = new Map(); // nommer -> data-URL of null, sodat heen-en-weer blaai nie weer laai nie

  async function roep(liggaam) {
    const r = await fetch("/.netlify/functions/portaal-foto", {
      method: "POST",
      headers: await identiteit_kop({ "Content-Type": "application/json" }),
      body: JSON.stringify(liggaam),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.fout || "Fout " + r.status);
    return data;
  }

  function kennis(teks) {
    const k = $("#fsp-kennis");
    if (!k) return;
    k.textContent = teks;
    k.classList.add("wys");
    clearTimeout(kennis.t);
    kennis.t = setTimeout(() => k.classList.remove("wys"), 2600);
  }

  // Maak die foto klein op die toestel self.
  function verklein(lêer) {
    return new Promise((klaar, fout) => {
      const img = new Image();
      const url = URL.createObjectURL(lêer);
      img.onload = () => {
        const s = Math.min(1, MAKS / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        klaar(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); fout(new Error("Kon nie die foto lees nie")); };
      img.src = url;
    });
  }

  function voorletters() {
    const h = $("#fsp-een .fsp-kop-ry h2");
    return (h ? h.textContent : "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  function teken(slot, no) {
    const data = kas.get(no);
    slot.innerHTML = "";
    if (data) {
      const img = document.createElement("img");
      img.src = data;
      img.alt = "Foto";
      slot.appendChild(img);
      slot.title = "Sien die foto";
    } else {
      const s = document.createElement("span");
      s.className = "fsp-foto-leeg";
      s.innerHTML = '<b></b><small>+ Foto</small>';
      s.querySelector("b").textContent = voorletters();
      slot.appendChild(s);
      slot.title = "Laai 'n foto op";
    }
  }

  function kies_lêer(no, slot) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = async () => {
      const lêer = inp.files && inp.files[0];
      if (!lêer) return;
      slot.classList.add("besig");
      try {
        const data = await verklein(lêer);
        await roep({ aksie: "stoor", no, data });
        kas.set(no, data);
        teken(slot, no);
        kennis("Foto gestoor");
      } catch (f) {
        kennis("Kon nie stoor nie: " + f.message);
      } finally {
        slot.classList.remove("besig");
      }
    };
    inp.click();
  }

  function wys_groot(no, slot) {
    const agter = document.createElement("div");
    agter.className = "fsp-foto-groot";
    agter.innerHTML = '<div class="fsp-foto-houer"><img alt="Foto"><div class="fsp-aksies">' +
      '<button type="button" class="fsp-knop fsp-knop-hoof" data-d="vervang">Vervang</button>' +
      '<button type="button" class="fsp-knop fsp-knop-lig" data-d="verwyder">Verwyder</button>' +
      '<button type="button" class="fsp-knop fsp-knop-lig" data-d="toe">Maak toe</button></div></div>';
    agter.querySelector("img").src = kas.get(no);
    const toe = () => agter.remove();
    agter.addEventListener("click", async (e) => {
      const d = e.target.dataset && e.target.dataset.d;
      if (e.target === agter || d === "toe") return toe();
      if (d === "vervang") { toe(); kies_lêer(no, slot); }
      if (d === "verwyder") {
        if (!confirm("Verwyder die foto?")) return;
        try { await roep({ aksie: "verwyder", no }); kas.set(no, null); teken(slot, no); toe(); kennis("Foto verwyder"); }
        catch (f) { kennis("Kon nie verwyder nie: " + f.message); }
      }
    });
    document.body.appendChild(agter);
  }

  async function haak_in() {
    const kop = $("#fsp-een .fsp-kop-ry");
    const nr = $("#fsp-een .fsp-ry-no");
    if (!kop || !nr || kop.querySelector(".fsp-foto")) return;
    const no = nr.textContent.trim();
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "fsp-foto";
    kop.insertBefore(slot, kop.firstChild);
    slot.addEventListener("click", () => (kas.get(no) ? wys_groot(no, slot) : kies_lêer(no, slot)));
    if (!kas.has(no)) {
      teken(slot, no);
      slot.classList.add("besig");
      try { kas.set(no, (await roep({ aksie: "kry", no })).data || null); } catch { kas.set(no, null); }
      slot.classList.remove("besig");
    }
    if (slot.isConnected) teken(slot, no);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const een = document.getElementById("fsp-een");
    if (!een) return;
    new MutationObserver(() => { haak_in(); }).observe(een, { childList: true, subtree: true });
  });
})();
