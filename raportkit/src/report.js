/**
 * RaportKit — WooCommerce Report Generator
 * Pobiera dane ze sklepu, generuje raport HTML → PDF, wysyła mailem.
 *
 * Użycie:
 *   node src/report.js              → raport za ostatnie 7 dni
 *   node src/report.js monthly      → raport za ostatnie 30 dni
 */

require('dotenv').config();
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const fs = require('fs');
const path = require('path');

// ─── KONFIGURACJA ────────────────────────────────────────────────────────────
const config = {
  storeUrl:     process.env.WC_STORE_URL     || 'https://twojsklep.pl',
  consumerKey:  process.env.WC_CONSUMER_KEY  || 'ck_XXXX',
  consumerSecret: process.env.WC_CONSUMER_SECRET || 'cs_XXXX',
  storeName:    process.env.STORE_NAME       || 'Mój Sklep',
  emailTo:      process.env.REPORT_EMAIL     || 'wlasciciel@sklep.pl',
};

// ─── WOOCOMMERCE CLIENT ──────────────────────────────────────────────────────
const api = new WooCommerceRestApi({
  url: config.storeUrl,
  consumerKey: config.consumerKey,
  consumerSecret: config.consumerSecret,
  version: 'wc/v3',
  queryStringAuth: true,
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function dateRange(days) {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    after:  start.toISOString(),
    before: end.toISOString(),
    startLabel: start.toLocaleDateString('pl-PL'),
    endLabel:   end.toLocaleDateString('pl-PL'),
  };
}

function fmt(n) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
}

function pct(a, b) {
  if (b === 0) return '—';
  const diff = ((a - b) / b) * 100;
  return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
}

// ─── POBIERZ ZAMÓWIENIA ──────────────────────────────────────────────────────
async function fetchOrders(after, before) {
  const orders = [];
  let page = 1;

  while (true) {
    const res = await api.get('orders', {
      after, before,
      status: 'completed,processing',
      per_page: 100,
      page,
    });

    orders.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }

  return orders;
}

// ─── OBLICZ STATYSTYKI ───────────────────────────────────────────────────────
function calcStats(orders) {
  const revenue   = orders.reduce((s, o) => s + parseFloat(o.total), 0);
  const count     = orders.length;
  const avgBasket = count > 0 ? revenue / count : 0;

  // Top produkty
  const productMap = {};
  for (const order of orders) {
    for (const item of order.line_items) {
      const id = item.product_id;
      if (!productMap[id]) {
        productMap[id] = { name: item.name, qty: 0, revenue: 0 };
      }
      productMap[id].qty     += item.quantity;
      productMap[id].revenue += parseFloat(item.subtotal);
    }
  }

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Przychód dzienny (dla wykresu)
  const dailyMap = {};
  for (const order of orders) {
    const day = order.date_created.slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + parseFloat(order.total);
  }

  const dailyData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rev]) => ({ date, rev }));

  return { revenue, count, avgBasket, topProducts, dailyData };
}

// ─── GENERUJ HTML RAPORTU ────────────────────────────────────────────────────
function generateHTML(current, previous, range, periodLabel) {
  const { revenue, count, avgBasket, topProducts, dailyData } = current;
  const maxRev = Math.max(...dailyData.map(d => d.rev), 1);

  const bars = dailyData.map(d => {
    const h = Math.round((d.rev / maxRev) * 100);
    const day = new Date(d.date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' });
    return `<div class="bar-wrap">
      <div class="bar" style="height:${h}%" title="${day}: ${fmt(d.rev)}"></div>
      <div class="bar-label">${day.split(' ')[0]}</div>
    </div>`;
  }).join('');

  const topRows = topProducts.map((p, i) =>
    `<tr>
      <td class="rank">${i + 1}</td>
      <td>${p.name}</td>
      <td class="num">${p.qty} szt.</td>
      <td class="num">${fmt(p.revenue)}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Instrument Sans',sans-serif;background:#fafaf8;color:#0a0a0a;font-size:14px;line-height:1.5;padding:40px}
.page{max-width:800px;margin:0 auto}
.header{background:#0a0a0a;color:#fafaf8;border-radius:12px;padding:28px 32px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start}
.header-store{font-family:'DM Serif Display',serif;font-size:22px}
.header-period{font-family:'DM Mono',monospace;font-size:11px;color:#888;margin-top:6px}
.header-badge{background:#1a7a4a;color:#e8f5ee;font-size:11px;font-family:'DM Mono',monospace;padding:4px 12px;border-radius:100px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.kpi{background:#fff;border:1px solid #e0dfd8;border-radius:10px;padding:18px}
.kpi-label{font-family:'DM Mono',monospace;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.kpi-value{font-family:'DM Serif Display',serif;font-size:26px;line-height:1.1}
.kpi-delta{font-size:11px;font-family:'DM Mono',monospace;margin-top:4px}
.delta-up{color:#1a7a4a}.delta-down{color:#c0392b}.delta-neutral{color:#888}
.chart-box{background:#fff;border:1px solid #e0dfd8;border-radius:10px;padding:20px;margin-bottom:24px}
.box-title{font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:16px}
.chart{display:flex;align-items:flex-end;gap:6px;height:100px}
.bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%}
.bar{width:100%;background:#0a0a0a;border-radius:3px 3px 0 0;min-height:4px;transition:opacity .2s}
.bar-label{font-family:'DM Mono',monospace;font-size:10px;color:#aaa}
table{width:100%;border-collapse:collapse}
.table-box{background:#fff;border:1px solid #e0dfd8;border-radius:10px;padding:20px}
th{font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;padding:0 8px 10px;text-align:left;border-bottom:1px solid #e0dfd8}
td{padding:10px 8px;border-bottom:1px solid #f0efeb;font-size:13px}
tr:last-child td{border-bottom:none}
.rank{color:#aaa;font-family:'DM Mono',monospace;font-size:11px;width:24px}
.num{text-align:right;font-family:'DM Mono',monospace}
.footer{text-align:center;font-family:'DM Mono',monospace;font-size:10px;color:#aaa;margin-top:24px;padding-top:16px;border-top:1px solid #e0dfd8}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="header-store">${config.storeName}</div>
      <div class="header-period">Raport ${periodLabel} · ${range.startLabel} – ${range.endLabel}</div>
    </div>
    <div class="header-badge">RaportKit</div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Przychód</div>
      <div class="kpi-value">${fmt(revenue)}</div>
      <div class="kpi-delta ${getDeltaClass(revenue, previous.revenue)}">
        ${pct(revenue, previous.revenue)} vs poprzedni okres
      </div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Zamówienia</div>
      <div class="kpi-value">${count}</div>
      <div class="kpi-delta ${getDeltaClass(count, previous.count)}">
        ${pct(count, previous.count)} vs poprzedni okres
      </div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Śr. koszyk</div>
      <div class="kpi-value">${fmt(avgBasket)}</div>
      <div class="kpi-delta ${getDeltaClass(avgBasket, previous.avgBasket)}">
        ${pct(avgBasket, previous.avgBasket)} vs poprzedni okres
      </div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Top produkt</div>
      <div class="kpi-value" style="font-size:16px;line-height:1.3">${topProducts[0]?.name ?? '—'}</div>
      <div class="kpi-delta delta-neutral">${topProducts[0] ? topProducts[0].qty + ' szt.' : ''}</div>
    </div>
  </div>

  <div class="chart-box">
    <div class="box-title">Przychód dzienny</div>
    <div class="chart">${bars}</div>
  </div>

  <div class="table-box">
    <div class="box-title" style="margin-bottom:12px">Top produkty według przychodu</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Produkt</th>
          <th style="text-align:right">Ilość</th>
          <th style="text-align:right">Przychód</th>
        </tr>
      </thead>
      <tbody>${topRows}</tbody>
    </table>
  </div>

  <div class="footer">
    Wygenerowano automatycznie przez RaportKit · ${new Date().toLocaleString('pl-PL')}
  </div>
</div>
</body>
</html>`;
}

function getDeltaClass(a, b) {
  if (b === 0) return 'delta-neutral';
  return a >= b ? 'delta-up' : 'delta-down';
}

// ─── GŁÓWNA FUNKCJA ──────────────────────────────────────────────────────────
async function generateReport(mode = 'weekly') {
  const days         = mode === 'monthly' ? 30 : 7;
  const periodLabel  = mode === 'monthly' ? 'miesięczny' : 'tygodniowy';

  console.log(`\n📊 RaportKit — generuję raport ${periodLabel}...`);

  const range    = dateRange(days);
  const prevEnd  = new Date(range.after);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days);

  console.log(`   Okres: ${range.startLabel} – ${range.endLabel}`);

  // Równoległe pobieranie bieżącego i poprzedniego okresu
  const [currentOrders, prevOrders] = await Promise.all([
    fetchOrders(range.after, range.before),
    fetchOrders(prevStart.toISOString(), prevEnd.toISOString()),
  ]);

  console.log(`   Zamówienia bieżące:    ${currentOrders.length}`);
  console.log(`   Zamówienia poprzednie: ${prevOrders.length}`);

  const current  = calcStats(currentOrders);
  const previous = calcStats(prevOrders);

  console.log(`   Przychód: ${fmt(current.revenue)} (${pct(current.revenue, previous.revenue)} r/r)`);

  const html = generateHTML(current, previous, range, periodLabel);

  // Zapisz HTML
  const htmlPath = path.join(__dirname, '..', 'reports', `raport-${mode}-${new Date().toISOString().slice(0,10)}.html`);
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, html);
  console.log(`\n✅ Raport HTML zapisany: ${htmlPath}`);

  return { html, htmlPath, current, previous, range, periodLabel };
}

// ─── URUCHOM ─────────────────────────────────────────────────────────────────
const mode = process.argv[2] === 'monthly' ? 'monthly' : 'weekly';

generateReport(mode)
  .then(({ htmlPath, current, range, periodLabel }) => {
    console.log(`\n📬 Gotowe! Raport ${periodLabel} za ${range.startLabel}–${range.endLabel}`);
    console.log(`   Przychód: ${fmt(current.revenue)} | Zamówień: ${current.count}`);
    console.log(`\n   Następny krok: ustaw cron job lub użyj mailer.js do wysyłki\n`);
  })
  .catch(err => {
    console.error('\n❌ Błąd:', err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
    process.exit(1);
  });

module.exports = { generateReport };
