# Számlázz.hu Webflow Integráció – Műszaki Specifikáció

**v1.0 · 2026-03-12**

---

## Tartalomjegyzék

1. [Rendszer áttekintése](#1-rendszer-áttekintése)
2. [Backend – Netlify Function](#2-backend--netlify-function)
3. [Környezeti változók](#3-környezeti-változók)
4. [Webflow – HTML Form](#4-webflow--html-form)
5. [Webflow – Custom JavaScript](#5-webflow--custom-javascript)
6. [Netlify Deploy](#6-netlify-deploy)
7. [Hibakezelés és hibaelhárítás](#7-hibakezelés-és-hibaelhárítás)

---

## 1. Rendszer áttekintése

A rendszer egy Webflow oldalon lévő számlázási HTML form és a számlázz.hu Agent API közötti proxy backendből áll. A felhasználó kitölti a számlázási adatokat, a form elküldi azokat a Netlify Functions backendnek, amely összerakja a szükséges XML-t, beinjektálja az API kulcsot, elküldi a számlázz.hu-nak, majd visszaadja a vevői fiók URL-jét.

### Architektúra

```
Webflow oldal
└─ HTML <form> (Embed widget)
   └─ Custom JavaScript (submit handler)
      └─ POST /.netlify/functions/szamla  (JSON)
         └─ Netlify Function
            ├─ 1. XML összerakás + API kulcs injektálás
            ├─ 2. multipart POST → számlázz.hu/szamla/
            ├─ 3. XML válasz parse → vevoifiokurl
            └─ 4. JSON válasz → Webflow JS
```

### Adatfolyam összefoglalója

| Lépés | Szereplő | Leírás |
|-------|----------|--------|
| 1 | Felhasználó | Kitölti a Webflow form mezőit (személyes / céges adatok) |
| 2 | JavaScript | Megakadályozza a default submit-et, JSON payload-ot épít, POST kérést küld |
| 3 | Netlify Function | Fogadja a JSON-t, validálja a kötelező mezőket |
| 4 | Netlify Function | Összerakja az xmlszamla XML-t, beírja a `SZAMLAAGENT_KULCS`-ot |
| 5 | Netlify Function | `multipart/form-data` POST a számlázz.hu felé (`action-xmlagentxmlfile`) |
| 6 | Számlázz.hu | Feldolgozza, XML választ küld vissza (`valaszVerzio=2`) |
| 7 | Netlify Function | Parse-olja az `xmlszamlavalasz` XML-t, kiveszi a `vevoifiokurl`-t |
| 8 | JavaScript | Megnyitja a `vevoifiokurl`-t (ha sikeres), üzenetet jelenít meg |

---

## 2. Backend – Netlify Function

### 2.1 Fájlstruktúra

```
projekt-gyoker/
├── netlify/
│   └── functions/
│       └── szamla.ts          ← Netlify Function belépési pont
├── netlify.toml               ← Netlify konfig
├── package.json
└── tsconfig.json
```

### 2.2 Végpont

| Tulajdonság | Érték |
|-------------|-------|
| URL | `/.netlify/functions/szamla` |
| Metódus | `POST` |
| Content-Type (request) | `application/json` |
| Content-Type (response) | `application/json` |
| CORS | Netlify headers konfig kezeli |

### 2.3 Request payload (JSON)

| Mező | Típus | Kötelező | Leírás |
|------|-------|----------|--------|
| `vezeteknev` | string | ✅ | Vevő vezetékneve |
| `keresztnev` | string | ✅ | Vevő keresztneve |
| `email` | string | ✅ | E-mail cím (számlakézbesítés) |
| `irsz` | string | ✅ | Irányítószám |
| `telepules` | string | ✅ | Város / település |
| `cim` | string | ✅ | Utca, házszám |
| `orszag` | string | ✅ | Ország |
| `cegnev` | string | – | Cég neve (ha céges a számla) |
| `adoszam` | string | – | Adószám (pl. `12345678-2-42`) |
| `bankszamlaszam` | string | – | Bankszámlaszám |
| `megye` | string | – | Megye (megjegyzésbe kerül) |
| `telefon` | string | – | Telefonszám |
| `items` | array | – | Tételek (ld. 2.4 pont); ha üres, `DEFAULT_ITEMS` használatos |

### 2.4 Items tömb struktúrája

| Mező | Típus | Leírás |
|------|-------|--------|
| `megnevezes` | string | Tétel neve / leírása |
| `mennyiseg` | number | Mennyiség (pl. `1`, `2.5`) |
| `mennyisegiEgyseg` | string | Egység (pl. `"db"`, `"óra"`, `"alkalom"`) |
| `nettoEgysegar` | number | Nettó egységár HUF-ban |
| `afakulcs` | string | ÁFA kulcs – szám (pl. `"27"`, `"5"`, `"0"`) vagy speciális kód (`"TAM"`, `"AAM"`, `"EU"`, `"EUK"`, `"MAA"`, `"F.AFA"`, `"K.AFA"`, `"ÁKK"`, `"TAHK"`, `"TEHK"`) |
| `nettoErtek` | number | Nettó érték (mennyiség × nettó egységár) |
| `afaErtek` | number | ÁFA érték |
| `bruttoErtek` | number | Bruttó érték (nettó + ÁFA) |
| `megjegyzes` | string | Opcionális megjegyzés a tételhez |

> **Megjegyzés:** Ha az `items` mező nincs megadva a kérésben, a `NETLIFY_DEFAULT_ITEMS` környezeti változóból töltődik be az alapértelmezett tétel.

> ⚠️ **Fontos:** A Számlázz.hu API ellenőrzi, hogy `mennyiség × nettó egységár == nettó érték`, és hogy `nettó érték + ÁFA érték == bruttó érték`. Eltérés esetén hibaüzenetet küld (hibakódok: 57, 259–264), és NEM állítja ki a számlát.

### 2.5 Response payload

**Sikeres esetben (HTTP 200):**

```json
{
  "sikeres": true,
  "vevoifiokurl": "https://www.szamlazz.hu/szamla/fiok?token=abc123"
}
```

**Hiba esetén (HTTP 422):**

```json
{
  "sikeres": false,
  "hibakod": "3",
  "hibauzenet": "Bejelentkezési hiba – a megadott API kulcs érvénytelen"
}
```

**Szerver hiba esetén (HTTP 400 / 502 / 504):**

```json
{
  "error": "Hiányzó kötelező mezők: vezeteknev, email",
  "detail": "..."
}
```

### 2.6 XML összerakás logika

A backend a JSON payload alapján összerakja az `xmlszamla` névterű XML dokumentumot. Az alábbi mezők a konfig (env vars) alapján kerülnek be, **nem a formból**:

- `szamlaagentkulcs` – `SZAMLAAGENT_KULCS` env var (**soha nem kerül a frontendre!**)
- `eszamla` – mindig `true` (e-számla)
- `szamlaLetoltes` – `false` (csak URL kell, nem PDF)
- `valaszVerzio` – `2` (mindig XML válasz)
- `keltDatum`, `teljesitesDatum` – aktuális nap
- `fizetesiHataridoDatum` – aktuális nap + `PAYMENT_DUE_DAYS` (default: 8)
- `fizmod` – `FIZMOD` env var (default: `"Átutalás"`) — **kötelező** fejléc mező
- `penznem` – `PENZNEM` env var (default: `"HUF"`) — **kötelező** fejléc mező
- `szamlaNyelve` – `SZAMLA_NYELVE` env var (default: `"hu"`) — **kötelező** fejléc mező
- `szamlaszamElotag` – `SZAMLASZAM_ELOTAG` env var (ha megadva)
- `elado` adatok – `ELADO_*` env var-ok

> **Vevő `nev` mező:** A Számlázz.hu XML-ben egyetlen `<nev>` elem van. A backend a `vezeteknev` és `keresztnev` mezőket összefűzi (pl. `"Kovács János"`). Ha `cegnev` is meg van adva, az kerül a `<nev>` elembe.

> **Vevő `telefonszam`:** A form `telefon` mezője az XML `<telefonszam>` elembe kerül.

> **Vevő `sendEmail`:** Az XML `<sendEmail>` értéke mindig `true` (e-számla e-mailben kerül kiküldésre).

### 2.7 Számlázz.hu válasz feldolgozása

A számlázz.hu HTTP response két helyről adja vissza a `vevoifiokurl`-t:

1. **HTTP response header: `szlahu_vevoifiokurl`** – ez az elsődleges forrás
2. **XML body: `<vevoifiokurl>`** – fallback, ha a header üres lenne

> **Megjegyzés:** Hibás válasz esetén a `szlahu_error` és `szlahu_error_code` headerek szintén ki vannak olvasva fallback-ként, ha az XML body nem tartalmazná a hibainformációt.

---

## 3. Környezeti változók

> ⚠️ **Soha ne commitold az `.env` fájlt Git-be! A `SZAMLAAGENT_KULCS` titkos – csak a Netlify dashboardon add meg.**

| Változó | Kötelező | Default | Leírás |
|---------|----------|---------|--------|
| `SZAMLAAGENT_KULCS` | ✅ | – | Számlázz.hu Agent API kulcs |
| `ELADO_BANK` | ✅ | `OTP Bank` | Eladó bankjának neve |
| `ELADO_BANKSZAMLASZAM` | ✅ | – | Eladó bankszámlaszáma (`XX-XX-XX` formátum) |
| `ELADO_EMAIL_REPLYTO` | ✅ | – | Válaszcím az e-mail értesítőhöz |
| `ELADO_EMAIL_TARGY` | – | `Számla értesítő` | E-mail értesítő tárgya |
| `ELADO_EMAIL_SZOVEG` | – | `Mellékletben találja…` | E-mail szövege |
| `FIZMOD` | – | `Átutalás` | Fizetési mód (`Átutalás` / `Bankkártya` / `Készpénz`) |
| `PENZNEM` | – | `HUF` | Pénznem (`HUF`, `EUR`, `USD`…) |
| `SZAMLA_NYELVE` | – | `hu` | Számla nyelve (`hu`, `en`, `de`, `it`, `ro`, `sk`, `hr`, `fr`, `es`, `cz`, `pl`, `bg`, `nl`, `ru`, `si`) |
| `SZAMLASZAM_ELOTAG` | – | *(üres)* | Számlaszám prefix (pl. `DIJ` → `DIJ-2026-0001`) |
| `PAYMENT_DUE_DAYS` | – | `8` | Fizetési határidő napokban |
| `ALLOWED_ORIGINS` | ✅ | – | Webflow domain(ek), CORS whitelist |

### Netlify dashboard beállítás

Netlify → Site → Site configuration → Environment variables → Add a variable

```env
# .env.example – csak referencia, ne commitold a valódi értékekkel!
SZAMLAAGENT_KULCS=ide_ird_az_api_kulcsot
ELADO_BANK=OTP Bank
ELADO_BANKSZAMLASZAM=11111111-22222222-33333333
ELADO_EMAIL_REPLYTO=hello@ceged.hu
FIZMOD=Átutalás
PAYMENT_DUE_DAYS=8
ALLOWED_ORIGINS=https://sajatoldalad.webflow.io
```

---

## 4. Webflow – HTML Form

### 4.1 Embed widget elhelyezése

- Webflow Editor → az oldalon a kívánt helyre kattints
- Add Element → **Embed** (HTML Embed widget)
- Az alábbi teljes HTML kódot illeszd be

> **Megjegyzés:** A form nem használja a Webflow saját form-rendszerét (Netlify Forms sem kell hozzá). Teljesen custom JavaScript kezeli a küldést.

### 4.2 Form mezők – `name` attribútumok

Az input mezők `name` attribútuma pontosan meg kell egyezzen az alábbi értékekkel, mert a JavaScript ezek alapján olvassa ki az adatokat:

| `name` attribútum | Típus | Label | Kötelező |
|-------------------|-------|-------|----------|
| `vezeteknev` | `text` | Vezetéknév | ✅ |
| `keresztnev` | `text` | Keresztnév | ✅ |
| `email` | `email` | E-mail cím | ✅ |
| `irsz` | `text` | Irányítószám | ✅ |
| `telepules` | `text` | Város | ✅ |
| `cim` | `text` | Utca, házszám | ✅ |
| `orszag` | `text` | Ország | ✅ |
| `cegnev` | `text` | Cég neve | – |
| `adoszam` | `text` | Adószám | – |
| `bankszamlaszam` | `text` | Bankszámlaszám | – |
| `megye` | `text` | Megye | – |
| `telefon` | `tel` | Telefonszám | – |

### 4.3 Teljes Embed HTML kód

```html
<style>
  #szamlazz-form { font-family: inherit; max-width: 540px; }
  #szamlazz-form .form-group { margin-bottom: 14px; }
  #szamlazz-form label {
    display: block; font-size: 13px;
    font-weight: 600; margin-bottom: 4px; color: #374151;
  }
  #szamlazz-form input {
    width: 100%; padding: 10px 12px;
    border: 1px solid #D1D5DB; border-radius: 6px;
    font-size: 15px; box-sizing: border-box;
  }
  #szamlazz-form input:focus {
    outline: none;
    border-color: #1A56DB; box-shadow: 0 0 0 3px #E5F0FF;
  }
  .szamla-submit {
    width: 100%; padding: 12px;
    background: #1A56DB; color: #fff; border: none;
    border-radius: 6px; font-size: 16px; font-weight: 600;
    cursor: pointer; margin-top: 8px;
  }
  .szamla-submit:disabled { opacity: .6; cursor: not-allowed; }
  .szamla-msg {
    padding: 12px 16px; border-radius: 6px;
    margin-top: 16px; display: none; font-size: 14px;
  }
  .szamla-success { background: #D1FAE5; color: #065F46; }
  .szamla-error   { background: #FEE2E2; color: #B91C1C; }
</style>

<form id="szamlazz-form" novalidate>

  <!-- Személyes adatok -->
  <div class="form-group">
    <label>Vezetéknév *</label>
    <input name="vezeteknev" type="text" required>
  </div>
  <div class="form-group">
    <label>Keresztnév *</label>
    <input name="keresztnev" type="text" required>
  </div>
  <div class="form-group">
    <label>E-mail cím *</label>
    <input name="email" type="email" required>
  </div>

  <!-- Céges adatok (opcionális) -->
  <div class="form-group">
    <label>Cég neve</label>
    <input name="cegnev" type="text">
  </div>
  <div class="form-group">
    <label>Adószám</label>
    <input name="adoszam" type="text" placeholder="12345678-2-42">
  </div>

  <!-- Számlázási cím -->
  <div class="form-group">
    <label>Ország *</label>
    <input name="orszag" type="text" value="Magyarország" required>
  </div>
  <div class="form-group">
    <label>Irányítószám *</label>
    <input name="irsz" type="text" required>
  </div>
  <div class="form-group">
    <label>Város *</label>
    <input name="telepules" type="text" required>
  </div>
  <div class="form-group">
    <label>Megye</label>
    <input name="megye" type="text">
  </div>
  <div class="form-group">
    <label>Utca, házszám *</label>
    <input name="cim" type="text" required>
  </div>
  <div class="form-group">
    <label>Telefonszám</label>
    <input name="telefon" type="tel">
  </div>

  <button type="submit" class="szamla-submit">
    Számla generálása
  </button>

  <div class="szamla-msg szamla-success"></div>
  <div class="szamla-msg szamla-error"></div>

</form>
```

---

## 5. Webflow – Custom JavaScript

### 5.1 Elhelyezés

- Webflow → **Project Settings → Custom Code → Footer Code** szekcióba
- VAGY az adott oldal **Page Settings → Before `</body>` tag** mezőbe
- A `<script>` tag-ek közé illeszd be a kódot

> ⚠️ **Fontos:** A `PROXY_URL` értékét cseréld le a valódi Netlify Function URL-re a deploy után.

### 5.2 Teljes JavaScript kód

```html
<script>
(function () {
  // ── Beállítások ──────────────────────────────────────────────────────
  const PROXY_URL = "https://YOUR-SITE.netlify.app/.netlify/functions/szamla";

  const form = document.getElementById("szamlazz-form");
  if (!form) return;

  // ── Submit handler ───────────────────────────────────────────────────
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (!validateForm()) return;

    const btn = form.querySelector(".szamla-submit");
    setLoading(btn, true);
    hideMessages();

    const payload = {
      vezeteknev:     getVal("vezeteknev"),
      keresztnev:     getVal("keresztnev"),
      email:          getVal("email"),
      cegnev:         getVal("cegnev"),
      adoszam:        getVal("adoszam"),
      bankszamlaszam: getVal("bankszamlaszam"),
      orszag:         getVal("orszag"),
      irsz:           getVal("irsz"),
      telepules:      getVal("telepules"),
      megye:          getVal("megye"),
      cim:            getVal("cim"),
      telefon:        getVal("telefon"),
      // items: []  // Ha fix tételeket küldesz, add hozzá itt
    };

    try {
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.sikeres) {
        if (data.vevoifiokurl) {
          window.open(data.vevoifiokurl, "_blank");
        }
        showSuccess(
          "✅ Számla sikeresen kiállítva! " +
          "Hamarosan e-mailben is megkapja."
        );
        form.reset();
      } else {
      const msg = data.hibauzenet || data.error
          || "Hiba történt. Kérjük, próbálja újra.";
        const code = data.hibakod
          ? " (hibakód: " + data.hibakod + ")" : "";
        showError("⚠ " + msg + code);
      }
    } catch (err) {
      console.error("Hálózati hiba:", err);
      showError("⚠ Hálózati hiba. Kérjük, próbálja újra.");
    } finally {
      setLoading(btn, false);
    }
  });

  // ── Validáció ────────────────────────────────────────────────────────
  function validateForm() {
    const required = [
      "vezeteknev", "keresztnev", "email",
      "irsz", "telepules", "cim", "orszag"
    ];
    let ok = true;
    required.forEach(name => {
      const el = form.querySelector(`[name="${name}"]`);
      if (!el || !el.value.trim()) {
        el && el.classList.add("input-error");
        ok = false;
      } else {
        el.classList.remove("input-error");
      }
    });
    if (!ok) showError("⚠ Kérjük, töltse ki az összes kötelező mezőt.");
    return ok;
  }

  // ── Segédfüggvények ──────────────────────────────────────────────────
  function getVal(name) {
    const el = form.querySelector(`[name="${name}"]`);
    return el ? el.value.trim() : "";
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? "Feldolgozás..." : "Számla generálása";
  }

  function showSuccess(msg) {
    const el = form.querySelector(".szamla-success");
    if (el) { el.textContent = msg; el.style.display = "block"; }
  }

  function showError(msg) {
    const el = form.querySelector(".szamla-error");
    if (el) { el.textContent = msg; el.style.display = "block"; }
  }

  function hideMessages() {
    form.querySelectorAll(".szamla-msg")
      .forEach(el => el.style.display = "none");
  }
}());
</script>
```

---

## 6. Netlify Deploy

### 6.1 `netlify.toml` konfig

```toml
[build]
  command   = "npm run build"
  functions = "netlify/functions"

[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin  = "https://sajatoldalad.webflow.io"
    Access-Control-Allow-Methods = "POST, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type"
```

### 6.2 Deploy lépések

1. GitHub repóba push-old a kódot
2. Netlify → Add new site → Import from Git → repo kiválasztás
3. Site configuration → Environment variables → összes változó megadása
4. Deploy → kapsz egy `https://your-site.netlify.app` URL-t
5. Webflow JS-ben a `PROXY_URL`-t frissítsd erre az URL-re

### 6.3 Ingyenes tier korlátok

| Erőforrás | Ingyenes limit | Várható felhasználás |
|-----------|---------------|----------------------|
| Function invocation | 125 000 / hó | Napi ~5 számla = ~150/hó → ✅ |
| Execution time | 100 óra / hó | Kérésenkét ~2s → ~0.3 perc/hó → ✅ |
| Response méret | 6 MB | XML válasz ~1–5 KB → ✅ |
| Timeout | 60 másodperc (szinkron function) | Számlázz.hu általában <3s → ✅ |

> **Megjegyzés:** Netlify Functions (AWS Lambda) esetén előfordulhat minimális cold start, de jellemzően másodpercek alatt elindul – jelentősen gyorsabb, mint a Render ingyenes tiere.

---

## 7. Hibakezelés és hibaelhárítás

### 7.1 Hibakódok

| HTTP státusz | Forrás | Ok | Teendő |
|-------------|--------|----|--------|
| `400` | Netlify Fn | Érvénytelen JSON a requestben | JS oldal ellenőrzése |
| `422` | Netlify Fn | Hiányzó kötelező mező | Form validáció ellenőrzése |
| `422` | Számlázz.hu | `sikeres=false` az XML válaszban | `hibakod` + `hibauzenet` megjelenítése |
| `502` | Számlázz.hu | Érvénytelen XML válasz / HTTP hiba | Netlify function log ellenőrzése |
| `504` | Számlázz.hu | Timeout (>30s) | Számlázz.hu status oldal ellenőrzése |

### 7.2 Netlify Function logok

Netlify Dashboard → Functions → `szamla` → Logs fülön látható minden log bejegyzés valós időben.

```bash
# Helyi tesztelés Netlify CLI-vel:
npm install -g netlify-cli
netlify dev
# → http://localhost:8888/.netlify/functions/szamla
```

### 7.3 CORS hibák

Ha a Webflow oldal CORS hibát dob a böngészőben, ellenőrizd:

- `netlify.toml` → `Access-Control-Allow-Origin` tartalmazza-e a Webflow domaint
- A Webflow oldalad URL-je pontosan egyezik-e (http vs https, trailing slash)
- Netlify deploy után újra lett-e deployolva a konfig
