// public/js/dankie-stand.js
//
// Wat het met die betaling gebeur? Vra dit, en sê dit.
//
// WAAROM DIT 'N EIE LÊER IS
//
// dankie.html het sy logika in 'n <script>-blok onderaan gedra. Daardie blok
// het by ELKE uitkoms "Dankie vir jou bestelling" gesê en die mandjie
// leeggemaak — ook wanneer die koper op Paystack se bladsy gekanselleer het.
// Hy het dan niks betaal, niks gekoop, en sy mandjie was weg.
//
// Hierdie lêer neem daardie werk oor. Die HTML-blok val weg; die bestaande
// opskrif- en teks-elemente bly presies waar hulle is en word hier gevul.
//
// DIE MANDJIE IS DIE MANDJIE
//
// Dit is hoe elke aanlynwinkel met onmiddellike betaling werk: kanselleer jy,
// kom jy terug en jou mandjie is soos jy hom gelos het. begin-betaling.js is
// reeds daarvoor gebou — kry_of_skep_bestelnommer() in voltooi-betaling.js
// hergebruik die bestelnommer uit sessionStorage, en die Function tel dan 'n
// tweede POGING op DIESELFDE bestelling. Geen tweede rekord, geen wees-
// bestelling wat vir ewig op "Wag vir betaling" lê.
//
// Dit werk net as die bestelnommer bly staan. Daarom word hy — saam met die
// mandjie — slegs uitgevee wanneer daar werklik 'n transaksie by die bank is.
//
//   betaal    mandjie leeg, bestelnommer weg. Die bestelling is klaar.
//   loop      mandjie leeg, bestelnommer weg. 'n Instant EFT wat by die bank
//             hang, kan nog deurgaan; 'n vol mandjie sou 'n tweede bestelling
//             vir dieselfde boeke uitnooi, en die module het geen terugbetaling
//             nie. Die boodskap sê waarom, sodat dit soos 'n beskerming lyk.
//   oop       ALBEI BLY. Niks is afgetrek nie en niks het gebeur nie.
//   onbekend  ALBEI BLY. Ons weet nie, en 'n leë mandjie op grond van 'n
//             raaiskoot is die duurder fout.
//
// DIE TERUGVAL IS ALTYD "onbekend". Verval die sessie terwyl die koper op
// Paystack was, antwoord die Function 401. Dit mag nie soos 'n mislukte
// betaling lyk nie — dus onbekend, en die mandjie bly.

const DS_BESTELNOMMER_SLEUTEL = "future_shop_bestelnommer_konsep";
const DS_MANDJIE_SLEUTEL = "future_shop_mandjie";

// Watter uitkomste 'n transaksie by die bank beteken. Alles hier maak die
// mandjie leeg; alles anders laat hom staan.
const DS_BY_DIE_BANK = ["betaal", "loop"];

function ds_lees_mandjie() {
  try {
    const ruwe = localStorage.getItem(DS_MANDJIE_SLEUTEL);
    const items = ruwe ? JSON.parse(ruwe) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function ds_maak_leeg() {
  localStorage.removeItem(DS_MANDJIE_SLEUTEL);
  sessionStorage.removeItem(DS_BESTELNOMMER_SLEUTEL);
  // Die teller in die kop lees uit localStorage en word nie vanself herteken
  // nie — sonder hierdie oproep bly "3" langs 'n leë mandjie staan.
  if (typeof wys_mandjie_teller === "function") wys_mandjie_teller();
}

function ds_stel(id, teks) {
  const el = document.getElementById(id);
  if (el) el.textContent = teks;
}

function ds_wys_knoppie(id, wys) {
  const el = document.getElementById(id);
  if (el) el.hidden = !wys;
}

// Die opskrif en die teks per uitkoms. Die MANDJIE bepaal watter woord by
// "betaal" gebruik word: 'n suiwer e-boekmandjie is 'n AANKOOP wat klaar is;
// enigiets met 'n harde kopie is 'n BESTELLING waarop 'n druk- en
// afleweringsproses volg. Daardie onderskeid het in die ou blok gestaan en
// bly hier behoue.
function ds_teken(stand, items) {
  const bevat_harde_kopie = items.some((i) => i && i.formaat === "harde_kopie");
  const bevat_eboek = items.some((i) => i && i.formaat === "eboek");

  const kaart = document.getElementById("dankie-kaart");
  if (kaart) kaart.className = "dankie-kaart ds-t-" + stand;

  ds_stel("dankie-merkie", t("ds_merk_" + stand));

  if (stand === "betaal") {
    if (bevat_eboek && !bevat_harde_kopie) {
      ds_stel("dankie-titel", t("dankie_titel_aankoop"));
      ds_stel("dankie-teks", t("dankie_teks_eboek_alleen"));
    } else if (bevat_harde_kopie) {
      ds_stel("dankie-titel", t("dankie_titel"));
      ds_stel("dankie-teks", t("dankie_teks_bevat_harde_kopie"));
    } else {
      // Die mandjie was reeds leeg toe die bladsy laai — 'n blaaier se
      // terugknoppie, of 'n tweede besoek. Die betaling is steeds deur, dus
      // is 'n generiese bevestiging korrek en 'n foutboodskap nie.
      ds_stel("dankie-titel", t("dankie_titel"));
      ds_stel("dankie-teks", t("ds_teks_betaal"));
    }
    ds_wys_knoppie("dankie-my-boeke-knoppie", true);
    ds_wys_knoppie("dankie-mandjie-knoppie", false);
    return;
  }

  ds_stel("dankie-titel", t("ds_kop_" + stand));
  ds_stel("dankie-teks", t("ds_teks_" + stand));

  // By "loop" is die bestelling by die bank en die koper wag op sy boeke —
  // My Boeke is die regte plek. By "oop" en "onbekend" is die mandjie nog
  // vol en is dít waarheen hy moet gaan.
  const na_my_boeke = stand === "loop";
  ds_wys_knoppie("dankie-my-boeke-knoppie", na_my_boeke);
  ds_wys_knoppie("dankie-mandjie-knoppie", !na_my_boeke);
}

// Die mandjiereël onder die knoppies. Sy taak is om 'n verlies in 'n feit te
// verander: 'n koper wat sien sy mandjie is leeg, moet weet waarom.
function ds_teken_mandjie(stand, aantal) {
  const el = document.getElementById("dankie-mandjie-nota");
  if (!el) return;
  if (stand === "loop") el.textContent = t("ds_mandjie_loop");
  else if (stand === "betaal") el.textContent = t("ds_mandjie_leeg");
  else if (aantal > 0) el.textContent = t("ds_mandjie_behou").replace("{n}", aantal);
  else el.textContent = "";
}

async function ds_begin() {
  const params = new URLSearchParams(window.location.search);
  const bestelnommer =
    params.get("bestelnommer") || params.get("reference") || "";

  ds_stel(
    "dankie-bestelnommer",
    bestelnommer ? `${t("bestelnommer_etiket")}: ${bestelnommer}` : ""
  );

  // LEES DIE MANDJIE VOORDAT ENIGIETS HOM KAN LEEGMAAK. Die inhoud bepaal
  // watter woorde gebruik word, en by "betaal" is hy 'n oomblik later weg.
  const items = ds_lees_mandjie();

  let stand = "onbekend";

  if (bestelnommer) {
    try {
      const sessie =
        typeof identiteit_kry_huidige_sessie === "function"
          ? await identiteit_kry_huidige_sessie()
          : null;

      if (sessie && sessie.access_token) {
        const resp = await fetch(
          "/.netlify/functions/kry-bestelstand?bestelnommer=" +
            encodeURIComponent(bestelnommer),
          { headers: { Authorization: `Bearer ${sessie.access_token}` } }
        );
        if (resp.ok) {
          const uitslag = await resp.json();
          if (uitslag && uitslag.stand) stand = uitslag.stand;
        }
      }
    } catch (fout) {
      console.error("Kon nie die bestelstand kry nie:", fout);
    }
  }

  if (DS_BY_DIE_BANK.includes(stand)) ds_maak_leeg();

  ds_teken(stand, items);
  ds_teken_mandjie(stand, DS_BY_DIE_BANK.includes(stand) ? 0 : items.length);
}

document.addEventListener("DOMContentLoaded", ds_begin);
