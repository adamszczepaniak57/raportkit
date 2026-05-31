/**
 * RaportKit — Mailer
 * Wysyła raport HTML jako e-mail przez Resend.com (darmowy tier: 3000/mies.)
 *
 * Instalacja:
 *   npm install resend
 *
 * Użycie:
 *   node src/mailer.js
 *   node src/mailer.js monthly
 */

require('dotenv').config();
const { Resend } = require('resend');
const { generateReport } = require('./report');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendReport(mode = 'weekly') {
  console.log('\n📤 RaportKit — generuję i wysyłam raport...');

  const { html, current, range, periodLabel } = await generateReport(mode);

  const subject = `📊 Raport ${periodLabel} — ${range.startLabel}–${range.endLabel} | ${process.env.STORE_NAME || 'Twój Sklep'}`;

  const { data, error } = await resend.emails.send({
    from:    process.env.RESEND_FROM    || 'raporty@twojadomena.pl',
    to:      process.env.REPORT_EMAIL   || 'wlasciciel@sklep.pl',
    subject,
    html,
  });

  if (error) {
    console.error('❌ Błąd wysyłki:', error);
    throw error;
  }

  console.log(`✅ Raport wysłany! ID wiadomości: ${data.id}`);
  console.log(`   Do: ${process.env.REPORT_EMAIL}`);
  console.log(`   Temat: ${subject}\n`);
}

const mode = process.argv[2] === 'monthly' ? 'monthly' : 'weekly';
sendReport(mode).catch(err => { console.error(err); process.exit(1); });
