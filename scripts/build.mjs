// Baut die Seite: kopiert src/ nach dist/ und setzt Gutscheine, Events, FAQ + strukturierte Daten ein.
// Läuft bei jedem Netlify-Deploy (siehe netlify.toml). Keine Abhängigkeiten nötig.
import { readFileSync, writeFileSync, cpSync, rmSync, existsSync } from 'node:fs';

const SITE = 'https://www.xn--gutschein-lneburg-d3b.de';
const UTM = { utm_source: 'gutschein-lueneburg', utm_medium: 'referral' };
const MAX_EVENTS = 12;

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

function utm(url, campaign, content) {
  try {
    const u = new URL(url);
    Object.entries({ ...UTM, utm_campaign: campaign, utm_content: content }).forEach(([k, v]) => { if (v && !u.searchParams.has(k)) u.searchParams.set(k, v); });
    return u.toString();
  } catch { return url; }
}
const slugify = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

rmSync('dist', { recursive: true, force: true });
cpSync('src', 'dist', { recursive: true });

let html = readFileSync('src/index.html', 'utf8');

// ---------- Gutscheine ----------
const { gutscheine = [] } = read('content/gutscheine.json');
const pfeil = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const gHtml = gutscheine.map((g, i) => `      <article class="g-card">
        ${g.badge ? `<span class="badge">${esc(g.badge)}</span>` : ''}
        <img src="${esc(g.bild)}" alt="${esc(g.alt)}" width="600" height="600" ${i > 3 ? 'loading="lazy"' : ''}>
        <div class="g-body">
          <h3>${esc(g.titel)}</h3>
          <p class="preis">${esc(g.preis)} <small>inkl. aller Gebühren</small></p>
          <p>${esc(g.text)}</p>
          <a class="pill pill-rot" href="${esc(utm(g.link, 'gutscheine', g.slug || slugify(g.titel)))}" aria-label="Gutschein ${esc(g.titel)} im Ticketshop kaufen">Gutschein kaufen ${pfeil}</a>
        </div>
      </article>`).join('\n');
html = html.replace('<!--GUTSCHEINE-->', gHtml);

const gLd = {
  '@context': 'https://schema.org', '@type': 'ItemList', name: 'Gutscheine Lüneburg',
  itemListElement: gutscheine.map((g, i) => ({
    '@type': 'ListItem', position: i + 1,
    item: { '@type': 'Product', name: `Gutschein ${g.titel}`, image: SITE + g.bild, description: g.text,
      brand: { '@type': 'Brand', name: 'Lüneburg TICKETS' }, url: g.link }
  }))
};
html = html.replace('<!--GUTSCHEINE_JSONLD-->', `<script type="application/ld+json">${json(gLd)}</script>`);

// ---------- Events ----------
const ev = existsSync('content/events.json') ? read('content/events.json') : { events: [] };
const heute = new Date(); heute.setHours(0, 0, 0, 0);
const events = (ev.events || [])
  .filter((e) => e.titel && e.datum && e.link && new Date(e.datum + 'T23:59:59') >= heute)
  .sort((a, b) => (a.datum + (a.uhrzeit || '')).localeCompare(b.datum + (b.uhrzeit || '')))
  .slice(0, MAX_EVENTS);

const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
let eHtml;
if (events.length) {
  eHtml = '    <div class="e-grid">\n' + events.map((e, i) => {
    const d = new Date(e.datum + 'T12:00:00');
    const meta = [WT[d.getDay()] + ', ' + d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + (e.uhrzeit ? ` · ${e.uhrzeit} Uhr` : ''), e.ort].filter(Boolean).join(' · ');
    const bild = e.bild
      ? `<img src="${esc(e.bild)}" alt="${esc(e.titel)}${e.ort ? ' – ' + esc(e.ort) : ''}" width="600" height="400" ${i > 3 ? 'loading="lazy"' : ''}>`
      : '';
    return `      <a class="e-card" data-datum="${esc(e.datum)}" href="${esc(utm(e.link, 'eventliste', slugify(e.titel)))}">
        <div class="e-bild">${bild}<span class="e-datum"><b>${d.getDate()}</b><small>${MON[d.getMonth()]}</small></span></div>
        <div class="e-body"><h3>${esc(e.titel)}</h3><p class="meta">${esc(meta)}</p><span class="cta">Tickets sichern →</span></div>
      </a>`;
  }).join('\n') + '\n    </div>';

  const eLd = events.map((e) => ({
    '@context': 'https://schema.org', '@type': 'Event', name: e.titel,
    startDate: e.startIso || (e.uhrzeit ? `${e.datum}T${e.uhrzeit}:00` : e.datum),
    ...(e.endeIso ? { endDate: e.endeIso } : {}),
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: e.ort || 'Lüneburg', address: { '@type': 'PostalAddress', addressLocality: 'Lüneburg', addressCountry: 'DE' } },
    ...(e.bild ? { image: SITE + e.bild } : {}),
    offers: { '@type': 'Offer', url: e.link, availability: 'https://schema.org/InStock' },
    organizer: { '@type': 'Organization', name: 'Lüneburg TICKETS', url: 'https://www.lueneburgtickets.de' }
  }));
  html = html.replace('<!--EVENTS_JSONLD-->', `<script type="application/ld+json">${json(eLd)}</script>`);
} else {
  eHtml = '    <p>Neue Termine folgen in Kürze – schau gern direkt im Ticketshop vorbei.</p>';
  html = html.replace('<!--EVENTS_JSONLD-->', '');
}
html = html.replace('<!--EVENTS-->', eHtml);

// ---------- Stimmungsbilder (optional, über CMS pflegbar) ----------
const st = existsSync('content/stimmung.json') ? read('content/stimmung.json') : { bilder: [] };
const bilder = (st.bilder || []).filter((b) => b.bild).slice(0, 4);
html = html.replace('<!--STIMMUNG-->', bilder.length ? `<section class="sec stimmung" aria-labelledby="stimmung-h">
  <div class="wrap">
    <p class="eyebrow">Eindrücke</p>
    <h2 id="stimmung-h">So fühlt sich Lüneburg an</h2>
    <div class="st-grid">
${bilder.map((b) => `    <figure><img src="${esc(b.bild)}" alt="${esc(b.alt || '')}" loading="lazy" width="1400" height="933"></figure>`).join('\n')}
  </div></div>
</section>` : '');

// ---------- FAQ ----------
const faq = [
  ['Wofür kann ich den Gutschein einlösen?', 'Für alle Veranstaltungen im Ticketshop von Lüneburg TICKETS – zum Beispiel Konzerte, Comedy, Sport und den Lüneburger Kultursommer. Einlösbar ist er auf lueneburgtickets.de und tickets.svg-lueneburg.de. Der Gutschein SVG Lüneburg ist auf lueneburgtickets.de einlösbar.'],
  ['Wie lange ist der Gutschein gültig?', 'Jeder Gutschein ist 36 Monate ab Kaufdatum gültig.'],
  ['Wie bekomme ich den Gutschein?', 'Direkt nach dem Kauf per E-Mail als PDF zum Selbstausdrucken (Print@home). Du kannst ihn also auch kurzfristig noch verschenken.'],
  ['Kann ich den Gutschein in mehreren Schritten einlösen?', 'Ja. Der Gutschein ist anteilig nutzbar, ein Restguthaben bleibt bis zum Ende der Gültigkeit erhalten. Eine Barauszahlung ist nicht möglich.'],
  ['Wie löse ich den Gutschein ein?', 'Event im Ticketshop auswählen, in den Warenkorb legen und dort den Gutscheincode eingeben. Der Betrag wird direkt auf den Kaufpreis angerechnet. Eine nachträgliche Anrechnung auf bereits abgeschlossene Bestellungen ist nicht möglich.'],
  ['Gilt der Gutschein auch für Getränke vor Ort?', 'Nein, die Gutscheine gelten ausschließlich für Tickets aus dem Ticketshop, nicht für Getränke oder andere Waren vor Ort.'],
  ['Welche Beträge gibt es?', 'Je nach Motiv 20 €, 25 €, 50 € oder 100 €, beim Gutschein SVG Lüneburg 15 € bis 50 €. Der Preis entspricht dem Gutscheinwert, alle Gebühren sind enthalten.'],
  ['Bei wem kaufe ich den Gutschein?', 'Der Kauf erfolgt im Ticketshop von Lüneburg TICKETS auf lueneburgtickets.de, technisch betrieben von der tickettoaster GmbH. Es gelten die dortigen Geschäftsbedingungen.']
];
html = html.replace('<!--FAQ-->', faq.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n'));
html = html.replace('<!--FAQ_JSONLD-->', `<script type="application/ld+json">${json({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
})}</script>`);

const jahr = String(new Date().getFullYear());
html = html.replace('<!--JAHR-->', jahr);
writeFileSync('dist/index.html', html);

// Jahr auch in Rechtsseiten
for (const f of ['impressum.html', 'datenschutz.html', 'barrierefreiheit.html']) {
  if (existsSync('dist/' + f)) writeFileSync('dist/' + f, readFileSync('dist/' + f, 'utf8').replace('<!--JAHR-->', jahr));
}

// Sitemap
const heuteIso = new Date().toISOString().slice(0, 10);
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${heuteIso}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}/impressum.html</loc></url>
  <url><loc>${SITE}/datenschutz.html</loc></url>
  <url><loc>${SITE}/barrierefreiheit.html</loc></url>
</urlset>
`);
writeFileSync('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Build ok: ${gutscheine.length} Gutscheine, ${events.length} Events, ${bilder.length} Stimmungsbilder`);
