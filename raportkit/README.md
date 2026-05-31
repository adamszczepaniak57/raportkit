# RaportKit — Instrukcja uruchomienia

## Szybki start (15 minut)

### 1. Pobierz klucz API z WooCommerce

1. Zaloguj się do panelu WordPress
2. Wejdź: **WooCommerce → Ustawienia → Zaawansowane → REST API**
3. Kliknij „Dodaj klucz"
4. Uprawnienia: **Odczyt** (Read only — bezpieczniej!)
5. Skopiuj Consumer Key i Consumer Secret

### 2. Skonfiguruj projekt

```bash
# Skopiuj plik konfiguracji
cp .env.example .env

# Edytuj .env — wpisz swoje dane
nano .env   # lub otwórz w edytorze
```

### 3. Zainstaluj zależności

```bash
npm install
npm install resend   # do wysyłki maili
```

### 4. Przetestuj lokalnie

```bash
# Raport tygodniowy (tylko generowanie HTML)
node src/report.js

# Raport miesięczny
node src/report.js monthly

# Wyślij mailem (po skonfigurowaniu Resend)
node src/mailer.js
```

Raport HTML zapisze się w folderze `reports/`.

---

## Deploy na Railway.app (darmowy hosting)

### 1. Utwórz konto na railway.app

### 2. Nowy projekt → Deploy from GitHub

```bash
# Lub przez CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

### 3. Zmienne środowiskowe w Railway

W panelu Railway → Variables — wklej zawartość swojego `.env`

### 4. Ustaw harmonogram (cron)

W Railway → Settings → Cron Schedule:

```
# Co poniedziałek o 7:00 — raport tygodniowy
0 7 * * 1  node src/mailer.js

# 1. każdego miesiąca o 7:00 — raport miesięczny  
0 7 1 * *  node src/mailer.js monthly
```

---

## Struktura projektu

```
raportkit/
├── src/
│   ├── report.js      ← główna logika + generowanie HTML
│   └── mailer.js      ← wysyłka przez Resend
├── reports/           ← wygenerowane raporty HTML (gitignore)
├── .env.example       ← szablon konfiguracji
├── .env               ← Twoja konfiguracja (NIE commituj!)
└── package.json
```

---

## Dodanie obsługi Shopify

Zamień klienta WooCommerce na Shopify Admin API:

```javascript
// npm install @shopify/shopify-api
const shopify = new Shopify.Clients.Rest(shop, accessToken);
const orders = await shopify.get({ path: 'orders', query: { status: 'any' } });
```

---

## Koszty

| Usługa      | Plan darmowy          | Kiedy płacisz         |
|-------------|----------------------|-----------------------|
| Railway     | $5 kredytu/mies.     | Przy dużym ruchu      |
| Resend      | 3 000 maili/mies.    | Po przekroczeniu      |
| WooCommerce | Zawsze darmowe API   | —                     |

**Całkowity koszt przy 50 klientach: ~0–20 zł/mies.**

---

## Wsparcie

Problemy? Napisz: kontakt@raportkit.pl
