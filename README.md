# Future Shop

Tweetalige (Afrikaans/Engels) e-boekwinkel-platform vir **Future Sharp**
(`futureshop.futuresharp.co.za`, ook bereikbaar op `futuresharp-shop.netlify.app`).
Verkoop e-boeke, harde kopieë en tydelike leen-toegang, met
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

`_rol-kontrole.js` het in Aug 2026 twee dinge bygekry: 'n **kort kas
(60s)** en **in-vlug-samevoeging**, sodat die paneelbord se ~10 gelyktydige
Functions saam één Identity-aanroep doen i.p.v. tien. Dit onderskei ook nou
tussen "token is ongeldig" (401/403 — moenie herprobeer nie) en "Identity
kon nou nie antwoord nie" (429/5xx — herprobeer een keer). Voorheen was
albei stilweg `null`, wat 'n koersbeperking presies soos 'n ongeldige token
laat lyk het.

*Kas-afweging:* 'n rol wat verwyder word, kan tot 60 sekondes lank nog
toegang gee. Bewus gekies — kort genoeg om onbelangrik te wees.

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

## Eie domein — en die slaggat wat dit meegebring het (Aug 2026)

Die winkel leef nou op **`futureshop.futuresharp.co.za`** (CNAME by
Afrihost → `futuresharp-shop.netlify.app`, Let's Encrypt-sertifikaat deur
Netlify uitgereik). Netlify merk 'n bygevoegde eie domein outomaties as
**Primary domain**, en dit het alles gebreek.

**Wat gebeur het:** `process.env.URL` is die *primêre* domein. `_rol-kontrole.js`
het daarheen teruggebel om die JWT te verifieer. Maar `futuresharp.co.za`
het 'n **wildcard-rekord** (`*.futuresharp.co.za`) wat na Afrihost se
bediener wys, en Netlify se Function-omgewing los die naam na die wildcard
op i.p.v. na die CNAME:

```
ERR_TLS_CERT_ALTNAME_INVALID
Host: futureshop.futuresharp.co.za is not in the cert's altnames:
DNS:bayek.aserv.co.za
```

Elke beskermde Function het 403 gegee. Die simptoom was **wisselvallig** —
sommige paneelbord-oortjies het gelaai, ander nie, en elke herlaai het 'n
ander mengsel gegee (DNS-kas per Function-instansie). Die blaaier los die
naam korrek op, dus het die winkel vir 'n gebruiker gewerk terwyl elke
Function gedruip het.

**Die reël hieruit:** 'n Function moet **nooit** oor die publieke internet
na sy eie werf terugbel via `process.env.URL` nie. `_rol-kontrole.js`
gebruik nou `https://${process.env.SITE_NAME}.netlify.app`, wat altyd na
Netlify oplos ongeag wat by die domeinverskaffer gebeur.

**Tweede gevolg:** 'n token wat op een oorsprong uitgereik is, word op 'n
ander geweier. Almal wat op `netlify.app` aangemeld was, moes een keer weer
aanmeld. Nie 'n voortdurende probleem nie, maar dit lyk soos 'n stukkende
winkel wanneer dit gebeur.

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

**Business-reël:** Future Sharp se hoofrekening moet altyd genoeg behou om
Paystack se transaksiekoste te dek, plus Hosting% — afgedwing in
`skep-produk.js`/`wysig-produk.js` by stoor-tyd, en as vangnet-klamp in
`begin-betaling.js`.

Die reël was aanvanklik 'n plat **3%**. Dit is verkeerd, en dit is in Aug
2026 by 'n R50-leen ontdek toe Paystack die transaksie geweier het met
*"Merchant share cannot be lower than zero"*. Paystack SA hef **2,9% + R1,
plus BTW** — dus `3,335% × bedrag + R1,15`. Die vaste deel is die probleem:
op R500 is 3% ruim, op R50 is 3% net R1,50 teenoor 'n werklike koste van
R2,82.

Die formule leef nou op één plek — **`_paystack-koste.js`** — en al drie
bogenoemde Functions gebruik dit. Die minimum is `3,5% + R1,30`, altyd net
bo die werklike fooi:

| Prys | Werklike fooi | Minimum behou |
|---|---|---|
| R50 | R2,82 | R3,06 (6,1%) |
| R100 | R4,49 | R4,81 (4,8%) |
| R250 | R9,49 | R10,06 (4,0%) |
| R500 | R17,83 | R18,81 (3,8%) |

**Gevolg vir prysstelling:** 'n 90%-outeursdeel is by lae pryse wiskundig
onmoontlik. 'n Boek teen R250+ dra dit gemaklik; 'n boek teen R50 nie.

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
4. `mandjie-opruiming.js` (Aug 2026) — padonafhanklike opruiming. Die
   mandjie is voorheen NET op `dankie.html` leeggemaak; 'n koper wat die
   venster toemaak of wegnavigeer voor daardie bladsy laai, sit met 'n
   item wat hy reeds besit — en kan dit 'n tweede keer betaal. Hierdie
   lêer (op `mandjie.html`, `my-boeke.html`, `voltooi-betaling.html`)
   vergelyk die mandjie met wat die koper werklik besit.
   **Die reëls is doelbewus eng:** 'n e-boek word slegs verwyder as die
   koper 'n PERMANENTE kopie het — nie by 'n aktiewe leen nie, want die
   leen-na-koop-opgradering sit juis 'n e-boek in die mandjie terwyl die
   leen loop. Harde kopieë word nooit verwyder nie ('n tweede eksemplaar
   as geskenk is wettig).

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
1. **Ooreenkoms/tekenstap** — formele terme+tariewe-tekening per rol,
   gekoppel aan die T&C-raamwerk hierbo. **Hoogste prioriteit:** dit is die
   enigste ontbrekende skakel in die outeurs-ketting, en bankbesonderhede
   word reeds sonder hierdie stap ingesamel.
2. **`vennoot`-Identity-rol** — Ignatius en Eugene kry lees-alleen toegang
   tot **slegs** Dokumente en die Verdeling-rekenaar. Geen produkte,
   verkope of koperdata nie. `skrap-dokument.js` moet 'n vennoot stééds
   weier, anders is dit nie meer lees-alleen nie. `_rol-kontrole.js`
   aanvaar reeds 'n lys rolle (`["personeel", "vennoot"]`) — die
   voorbereiding is gedoen.
3. **E-posdiens** — drie dinge wag hierop: outeur-kennisgewing by 'n
   verkoop, "jou leen verval binnekort", en dokumente wat vanaf
   `futureshop@futuresharp.co.za` uitgaan i.p.v. uit iemand se eie inpos.
   Die posbus bestaan by Afrihost; die SPF-rekord (`v=spf1
   include:spf.aserv.co.za +a +mx -all`) moet aangepas word, nie 'n tweede
   TXT bygevoeg nie. SMTP via daardie rekening vermy 'n nuwe verskaffer.
4. **ISBN-veld** op die produkbladsy — Future Shop reik nie ISBN's uit nie,
   maar wys dit as die outeur een het. Word in die outeursdokumente belowe.
5. **"My Leeskamer"** — hernoem van die koper se area, met "My Boeke"
   daarbinne. Naam nog nie finaal nie: dit moet later webinare kan huisves.
6. **Identity-e-possjabloon** — die herstelpos sê tans *"Reset your password
   for futuresharp-shop.netlify.app"* van `no-reply@netlify.com` af. Vir 'n
   koper wat pas op `futureshop.futuresharp.co.za` gekoop het, lyk dit soos
   phishing. Aanpasbaar in Netlify → Identity → Emails.
7. **"Sessie verval"-boodskap** op My Boeke gee geen knoppie om weer aan te
   meld nie — die koper moet self na `/aanmeld.html?terug=/my-boeke.html`.

**Huishouding:**
8. Kode-opruiming (ongebruikte CSS-reëls, oorbodige funksies)
9. Data-kennisgewing op die uitnodiging-vorm + tempo-beperking op
   `voltooi-uitnodiging.js` (POPIA-oorweging)
10. Periodieke Blobs-JSON-rugsteun-uittreksel
11. **Statistiek-teller-anomalie** (1 Aug): Totaal/Vandag/Week/Maand het nie
    ooreengestem nie. Nog nie ondersoek nie.
12. Die skakel op `futuresharp.co` na die winkel wys waarskynlik nog na
    `netlify.app` — kan na die nuwe adres verander.
13. Die twee PWA's is vanaf `netlify.app` geïnstalleer; hulle werk, maar dis
    netjieser om hulle vanaf die nuwe adres te herinstalleer.

**Verifikasie/toetse:**
14. Responsiewe ontwerp-deurgang — foon/tablet/rekenaar
15. End-tot-end koop-tot-leser-toets in 'n privaat venster

---

## Klein dinge wat in Aug 2026 bygekom het

- **`wagwoord-ogie.js`** — wys/versteek-knoppie op **elke** wagwoordveld.
  Dit spoor velde self op (met 'n `MutationObserver` vir vorms wat later
  sigbaar word, soos die registreer-blok), sodat 'n nuwe bladsy dit vanself
  kry. *Het 'n dooie lêer met dieselfde naam vervang:* die ou weergawe is
  vir Netlify se Identity-widget geskryf en het net Shadow DOM hanteer — die
  widget is lankal weg, en geen bladsy het die lêer nog gelaai nie. Die
  paneelbord se eie twee ogie-knoppies (in `paneelbord.html`, gedryf deur
  `paneelbord.js`) bly soos hulle is.
- **Verdeling-rekenaar** — die twee scenario's (A/B) is één geword. Hulle
  het bestaan om 68% teenoor 70% te vergelyk; Future Sharp werk nou
  uitsluitlik op 70/30, dus was hulle identies. Die 70% is 'n vaste anker,
  en 'n BTW-veld het bygekom (die ou berekening het R3,90 op R100 gegee
  waar Paystack werklik R4,49 hef).
