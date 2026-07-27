# Future Shop

Tweetalige (Afrikaans/Engels) e-boekwinkel-platform vir **Future Sharp**
(`futuresharp-shop.netlify.app`). Verkoop e-boeke en harde kopieë, met
outeurs/vennote/dienverskaffers wat via omset-verdeling vergoed word.

> **Let wel oor hierdie README:** die projek is oor baie sessies in stappe
> gebou. Vorige weergawes van hierdie lêer het elke fase ("Fase 1", "Fase
> 2", ens.) as 'n aparte, chronologiese plan gedokumenteer. Hierdie
> weergawe herorganiseer dit as 'n **huidige-stand-verwysing** — wat
> *bestaan*, hoe dit werk, en wat nog oop is — eerder as 'n historiese
> logboek. Belangrike ontwerp-rasionaal uit die ou weergawe is behou waar
> dit steeds relevant is.

---

## Argitektuur op 'n oogopslag

| Laag | Tegnologie |
|---|---|
| Hosting + CD | Netlify, gekoppel aan GitHub (`dorrithebenade-eng/futuresharp-shop`) — elke `git push` na `main` ontplooi outomaties |
| Bediener-logika | Netlify Functions (`netlify/functions/*.js`) |
| Databerging | Netlify Blobs — geen tradisionele databasis nie, alles as JSON-rekords per "store" |
| Aanmelding | Netlify Identity (GoTrue), via 'n **eie** kliënt (`identiteit.js`) — sien "Aanmelding" hieronder |
| Betalings | Paystack — Transaction Splits vir outeur-/vennoot-verdeling |
| E-boek-leser | PDF.js 2.6.347 (cdnjs) in die blaaier, met `pdf-lib` vir onsigtbare watermerking |
| Tale | `taal.js` + `data-i18n`-stelsel, AF/EN — net die **koppelvlak**, nooit boek-inhoud self nie |

Twee heeltemal aparte "kante":
- **Winkelfront** (`index.html`, `produk.html`, `mandjie.html`, `my-boeke.html`, `leser.html`, ens.) — publiek, kopers meld self aan/registreer
- **Personeel-paneelbord** (`paneelbord.html`) — intern, net vir rekeninge met die `"personeel"`-Identity-rol

Die twee gebruik **aparte sessie-sleutels** in blaaier-storage
(`future_shop_identiteit_sessie_winkel` vs. `..._paneel`), sodat 'n
personeellid wat per ongeluk via die winkel se aanmeld-vorm aanmeld,
eenvoudig as 'n gewone koper behandel word in daardie konteks.

---

## Twee bekende Netlify-omgewingskwessies (en die omwegte)

Netlify se **outomatiese** konteks-inspuiting het herhaaldelik gefaal op
hierdie werf (Julie 2026, bekende/erkende Netlify-kwessies) — nie 'n fout
in ons kode nie, maar iets wat elders ook gerapporteer is:

1. **Blobs:** `MissingBlobsEnvironmentError`, selfs op vars, korrek-
   gekoppelde werwe. **Omweg** (`_blob-store.js`): siteID + token word
   HANDMATIG verskaf via twee omgewingveranderlikes
   (`FUTURE_SHOP_BLOBS_SITE_ID`, `FUTURE_SHOP_BLOBS_TOKEN`), val terug op
   gewone `getStore()` as dié nie gestel is nie.
2. **Identity:** `context.clientContext.user` word soms nie ingespuit
   nie. **Omweg** (`_rol-kontrole.js`): elke beskermde Function verifieer
   die JWT self, direk teen `/.netlify/identity/user`.

Albei omwegte is intussen **in produksie bewys** en behoort onafhanklik
van Netlify se eie herstel te bly werk. **Bygewerkte risiko-status (Jul
2026):** Netlify het in Feb 2025 aangekondig hulle gaan Identity afskaf,
maar dít **omgekeer in Feb 2026** — Identity bly amptelik ondersteun,
geen migrasie nodig nie. Sien
https://www.netlify.com/blog/auth0-extension-identity-changes/.

**Sou Netlify ons ooit "laat val" (algehele kontinuïteitsrisiko):**
Hosting/CD en Functions is redelik maklik oordraagbaar (Vercel/Cloudflare
Pages/Render). **Blobs is die grootste vasgevang-risiko** — 'n eiesoortige
stoorformaat wat 'n regte migrasie sou verg na iets soos Cloudflare
KV/R2 of 'n databasis. 'n Eenvoudige periodieke JSON-uitvoer-rugsteun van
al die stores sou die goedkoopste versekering wees hierteen (nog nie
gebou nie — op die huishouding-lysie).

---

## Aanmelding — eie kliënt i.p.v. Netlify se Identity-widget

`public/js/identiteit.js` praat **direk** met die onderliggende
Identity-API (GoTrue) via `fetch` — nie Netlify se
`netlify-identity-widget.js` nie. Dié widget het herhaaldelik gebreek
wanneer blaaier-uitbreidings (Adobe Acrobat, Google Docs Offline) hul eie
skrips op dieselfde bladsy inspuit. Dis 'n suiwer front-end-verandering —
die JWT wat teruggegee word, is presies dieselfde tipe wat die widget sou
gegee het.

`identiteit.js` bied: aanmeld, registreer, wagwoord-herstel, token-
verwerking (uitnodiging/bevestiging), sessie-lees (met outo-verfris), en
afmeld. "Bly aangemeld"-keuseblokkie op beide aanmeld-vorms bepaal of
`localStorage` (aanhoudend) of `sessionStorage` (skoon by oortjie-toemaak)
gebruik word.

---

## Sekuriteitsgrens — personeel vs. publiek

Die skeiding tussen winkelfront en paneelbord berus **nooit** op
URL-obskuriteit nie. Twee dinge, altyd saam:

1. **Elke** personeel-beskermde Function roep
   `kry_gebruiker_en_kontroleer_rol(event, context, "personeel")` aan die
   begin van sy handler aan — gee `null` terug (en die Function stuur
   dan self 401/403) as die rol ontbreek. Dít is die werklike grens, nie
   die front-end nie.
2. **Geen kode-pad ken ooit "personeel" outomaties toe nie.** Selfregistrasie
   (koper-kant) ken altyd net `"koper"` toe. Die enigste manier om
   "personeel" te word, is 'n **handmatige** stap in Netlify se eie
   Identity-kontrolepaneel (Users → rol byvoeg).

Uitsondering wat dieselfde beginsel op 'n ander manier volg: die nuwe
**uitnodigings-stelsel** (sien onder) laat 'n vreemdeling toe om **sonder**
enige aanmelding 'n register-inskrywing te skep — maar net binne die noue
grense van 'n vooraf-deur-personeel-gegenereerde, eenmalige token. Geen
publieke Function ken ooit 'n Identity-rol toe nie.

---

## Katalogus & produkte

Boeke leef **nie as JSON-lêers in Git nie** — alles gaan via die
paneelbord se "Voeg produk by"/"Wysig"-vorm, wat na Netlify Blobs
("katalogus"-store) skryf en onmiddellik op die winkelfront verskyn,
sonder herontplooi.

**Sleutelbesluite:**
- Pryse in **sent**, nie rand nie (`prys_sent`) — vermy afrondingsfoute
- Harde kopie se afwesigheid = `beskikbaar: false`, knoppie verskyn eenvoudig nie
- `vrystelling_datum` per formaat = voorbestelling ("betaal nou, ontvang later"); `null` = normale, dadelik-beskikbare produk
- **Boek-etikette** (sterretjie-plakkers): 5 voorafingestelde tweetalige opsies (Nuut!/New!, Topverkoper/Bestseller, ens.) + pasgemaak, 4 kleure (amber/koraal/teal/swart)
- Omslag-beeld-oplaai: `laai-omslag-op.js`/`kry-omslag.js`, aparte "omslae"-Blobs-store

### Verdeling-argitektuur (5 registers, uitgebrei van oorspronklike enkele-outeur-model)

Elke `formaat`-blok (`eboek`/`harde_kopie`) dra 'n `verdelings`-lys (nie
meer net een `verdeling` nie) — elke ry: `{ rol_tipe, entiteit_id, tipe,
waarde }`. `rol_tipe` is een van: `outeur`, `vennoot`, `ontwerp_admin`,
`printing`, `aflewering`. Plus 'n aparte `hosting`-veld (dokumentasie-
doeleindes — bedrag bly by die hoofrekening).

**5 registers**, elk met volledige CRUD (`kry-*`/`skep-*`/`wysig-*`/
`skrap-*`), presies dieselfde patroon: Outeurs, Vennote, Ontwerp/Admin,
Printing, Aflewering. Elke register-rekord:

```json
{
  "outeur_id": "johan-smith",
  "naam": "Johan Smith",
  "subrekening_kode": "ACCT_xxxxx",
  "status": "aktief",
  "kontak_inligting": {
    "epos": "...", "selfoon": "...", "id_nommer": "...",
    "bank_naam": "...", "bank_rekeningnommer": "...", "bank_tak_kode": "..."
  },
  "geskep_op": "...", "geskep_deur": "..."
}
```

`subrekening_kode` is **opsioneel** — 'n nuwe persoon wat via 'n
uitnodigings-skakel self aansluit, het nog geen Paystack-subrekening nie;
status word outomaties `"wag_vir_subrekening"` totdat personeel dit self
by Paystack opstel en later invoer (via "Wysig"). `kontak_inligting` is 'n
wit-lys-gesaniteerde objek (nie elke veld geld vir elke rol nie).

**Business-reël:** Future Sharp se hoofrekening moet altyd ≥3% + Hosting%
behou (dek Paystack-transaksiekoste) — afgedwing in `skep-produk.js`/
`wysig-produk.js`.

**Paystack Transaction Splits** word dinamies per bestelling geskep
("op die vlug") in `begin-betaling.js` — nooit die kliënt se prys/
verdeling vertrou nie, altyd van die katalogus-store herbou.

---

## Uitnodigings-stelsel (nuut — self-diens aansluiting)

Personeel genereer 'n **rol-gebonde, eenmalige skakel** (token) in die
paneelbord se "Uitnodigings"-oortjie. Die persoon (nuwe outeur/vennoot/
ens.) maak dit **sonder enige aanmelding** oop op `uitnodiging.html`,
voltooi 'n rol-spesifieke vorm (kontak + bank), en dien in — dit skep
outomaties 'n register-inskrywing (met `status: "wag_vir_subrekening"`).

- `skep-uitnodiging.js` (personeel-beskermd) — genereer token, stoor in "uitnodigings"-store
- `kry-uitnodiging.js` (publiek) — token → rol_tipe + status, vir die vorm om te weet watter velde te wys
- `voltooi-uitnodiging.js` (publiek) — skep die register-inskrywing, merk token `"voltooi"` (nooit weer herbruikbaar nie)
- `kry-alle-uitnodigings.js` (personeel-beskermd) — rekord-lys (hangend/voltooi) vir die paneelbord

**Bewustelike skopus-beperking:** hierdie stelsel versamel net
**inligting**. Dit ken nooit outeurs aan boeke toe nie, en daar's nog
**geen formele ooreenkoms-/tekenstap** voor die bankbesonderhede ingevoer
word nie — dis 'n oop item (sien "Oop items" onder), belangrik vir POPIA-
nakoming aangesien persoonlike inligting van derdepartye reeds ingesamel
word.

`uitnodiging.html` het sy eie, groter/grafies-ryker stylblok (los van
`styl.css`) — groter teks, ikone per veld, ontwerp vir minder
tegnologies-gemaklike gebruikers.

---

## Betaalvloei (Paystack)

1. `begin-betaling.js` — herbou mandjie-pryse/verdelings vanuit die
   katalogus-store (nooit die kliënt vertrou nie), skep 'n konsep-
   bestelling in Blobs (status "Wag vir betaling"), skep dinamies 'n
   Transaction Split indien nodig, roep Paystack se Initialize
   Transaction aan
2. `paystack-webhook.js` — **gesaghebbende** bevestiging; Paystack roep
   dit direk aan, verifieer handtekening + bedrag, werk status na "Nuut"
   op
3. `dankie.html` — vriendelike terugkeerbladsy, NIE gesaghebbend nie, wys
   e-boek vs. harde-kopie-boodskap, ruim mandjie op

⚠️ Onthou: Paystack Live Webhook URL was op 'n stadium leeg (verklaar
waarom aankope nie in "My Boeke" verskyn het nie) — reeds reggestel,
maar 'n goeie ding om na 'n Paystack-herkonfigurasie altyd te verifieer.

**Voorbestellings:** `vrystelling_datum` bepaal of 'n item 'n
voorbestelling is; koper betaal nou, ontvang later. Ontsluiting/POD-
drukwerk-plasing gebeur **per item**, nie per hele bestelling nie.

---

## "My Boeke" en die e-boek-leser

- Aankope vereis 'n aangemelde koper-rekening — Identity-ID gekoppel aan
  bestelling, nie net 'n e-posadres nie
- `kry-my-boeke.js` (koper-beskermd) — lys gekoopte boeke vir die
  aangemelde koper
- **Geen harde DRM nie** (te omslagtig vir 'n klein katalogus, frustreer
  eerlike kopers meer as dit skelms stop). In plaas daarvan: **sagte
  watermerking**
  — koper se e-pos + bestelnommer as **onsigbare PDF-metadata**
  (dokument-eienskappe), plus 'n koraal fynskrif-kennisgewing in die
  leser-koppelvlak self (nie 'n sigbare watermerk-bladsy nie)
- **Aanlyn-leser** (`leser.html`, PDF.js-gebaseer): canvas-weergawe,
  bladsy-navigasie, soek-in-boek, zoem, aflyn-lees via IndexedDB (silent
  cache ná eerste laai — geen data nodig vir herhaalde lees nie)
- "My Boeke"-bladsy: klikbare boek-omslag-rooster, amber "Alreeds
  joune"-lint op reeds-gekoopte boeke
- Tweetalige leser-koppelvlak (knoppies, foutboodskappe) via `taal.js` —
  raak **nooit** die boek se inhoud self aan nie

---

## PWA's (Progressive Web Apps) — twee aparte, installeerbare apps

**Koper-kant ("Future Shop"):**
- `manifest.json`, `sw.js` (minimale service worker, net vir
  installeerbaarheid — geen kasering/aflyn-logika, dis reeds deur
  IndexedDB in die leser gedek)
- Ikone: `ikoon-192.png`, `ikoon-512.png`, `ikoon-maskable-512.png`,
  `apple-touch-ikoon.png`
- `start_url`/`scope`: `/my-boeke.html` — maak direk oop na die koper se
  boeke, nie die tuisblad nie
- Koppel in `my-boeke.html` + `leser.html`
- **Eie installeer-balk** (`installeer-app.js`) bo-aan "My Boeke" —
  Android kry 'n regte "Installeer"-knoppie (via `beforeinstallprompt`);
  iOS kry 'n "Tik Deel → Voeg by Tuisskerm"-instruksie (Apple laat geen
  programmatiese installasie toe nie). Verdwyn outomaties as reeds
  geïnstalleer, of vir 14 dae ná toemaak

**Personeel-kant ("Future Shop Paneelbord")** — heeltemal aparte PWA:
- `paneel-manifest.json`, `paneel-sw.js` — eie, **noue** omvang
  (`/paneelbord.html`) sodat dit nie met die koper-PWA se breër omvang
  bots nie
- Eie ikoon-stel (`paneel-ikoon-*.png`), swart tema-kleur (vs. koper se
  teal) om dit visueel te onderskei
- Eie installeer-balk (`paneelbord-installeer-app.js`), sigbaar **net**
  op `paneelbord.html`

---

## Personeel-paneelbord (`paneelbord.html`)

Sy-kieslys-navigasie (`paneel-kieslys.js`), sticky op rekenaar, hamburger-
laai op foon (≤640px). Oortjies: Katalogus (verstek), Outeurs, Vennote,
Ontwerp/Admin, Printing, Aflewering, Koepons, **Uitnodigings** (nuut).

`paneel-registers.js` — generiese CRUD-patroon vir al 5 registers via 'n
`PANEEL_REGISTERS`-konfigurasie-lys (nie 5x herhaalde kode nie, wel 5x
identiese `skep-*.js`/`wysig-*.js`-Functions agter die skerms — sien
"Kode-opruiming" onder). Skrap-vloei waarsku (nie blokkeer nie) as 'n
inskrywing reeds op 'n boek se verdeling gebruik word.

---

## Dokumentasie

`Future-Sharp-TC-Raamwerk.docx` — 'n **beginpunt-raamwerk** (nie finale
regsadvies nie) vir terme/voorwaardes/tarief-ooreenkomste, met Future
Sharp se branding (logo's, kleure, Montserrat/Poppins-fonte). Nog nie aan
enige tegniese stelsel gekoppel nie — dis presies waarvoor die oop
"Ooreenkoms/tekenstap"-item hieronder is.

---

## Werkvloei (hoe veranderinge ontplooi word)

Geen `netlify deploy --prod` nie — GitHub-CD doen dit outomaties:

1. Claude bou/wysig lêers, gee dit as aflaaibare lêers
2. Dorrithé: `Copy-Item` (PowerShell) na die korrekte gids
   (`public/`, `public/js/`, `public/css/`, `public/icons/`,
   `netlify/functions/`)
3. `git status` → bevestig al die verwagte lêers wys
4. `git add .` → `git commit -m "..."` → `git push`
5. Netlify ontplooi outomaties binne 'n minuut of twee

**Elke PowerShell-opdrag apart** (kombinasie op een reël het herhaaldelik
foute veroorsaak). **Verifieer altyd voor commit** — lêers het al
suksesvol plaaslik gekopieer maar nie in die repo weerspieël nie; gebruik
`git show HEAD:<pad> | Select-String "<patroon>"` om te bevestig.

**Bekende hik:** OneDrive vergrendel soms 'n lêer wat Git se agtergrond
`git gc`-opruiming probeer skoonmaak, wat 'n lusagtige "Deletion of
directory"-prompt veroorsaak. Fix: `Ctrl+C`, dan gewone `git push` weer
(die werklike stoot na GitHub het byna altyd reeds voor die gc-lus
geslaag).

---

## Oop items (nie afgehandel nie)

**Nuwe bou-werk:**
1. **Ooreenkoms/tekenstap** — formele terme+tariewe-tekening (naam +
   datum + akkoord-blokkie, onveranderlik gestoor) per rol, gekoppel aan
   die T&C-raamwerk hierbo. Prioriteit — bankbesonderhede word reeds
   sonder hierdie stap ingesamel.
2. **Besoekteller** — eenvoudige, privaatheidsvriendelike telling
   (totaal/vandag/week/maand) vir tuisblad-besoeke, later uitgebrei na
   per-produk-belangstelling (gekoppel aan 'n moontlike korter-oorsig-
   plus-"Lees meer"-herontwerp van die katalogus-kaarte)
3. **Kategorieë + filter** op die katalogus (voorheen bespreek, nog nie gebou nie)
4. **Skakel terug na futuresharp.co** (LearnWorlds-kursusplatform) — in
   winkel-nav, moontlik ook "My Boeke"/app

**Huishouding:**
5. Kode-opruiming (ongebruikte CSS-reëls, oorbodige funksies)
6. Data-kennisgewing op die uitnodiging-vorm + tempo-beperking op
   `voltooi-uitnodiging.js` (POPIA-oorweging — sien "Uitnodigings" bo)
7. Periodieke Blobs-JSON-rugsteun-uittreksel (kontinuïteitsversekering, nie dringend nie)

**Verifikasie/toetse (nie nuwe bou-werk nie):**
8. Responsiewe ontwerp-deurgang — stelselmatig oor foon/tablet/rekenaar
9. End-tot-end koop-tot-leser-toets — volle koper-vloei in een sitting,
   privaat/inkognito-venster
