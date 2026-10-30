# gutschein-lüneburg.de – live bringen

Gleiches Prinzip wie bei campusdesign.de: GitHub → Netlify → DecapBridge → Ionos.
Neu: Die Seite wird bei jedem Deploy automatisch gebaut, und die Events
kommen täglich automatisch aus dem Google Sheet.

---

## Schritt 1: Event-Sheet (erledigt)

Das Sheet ist per Link lesbar. Als Secret `SHEET_CSV_URL` (Schritt 3) diesen Wert eintragen:

`https://docs.google.com/spreadsheets/d/1581l9pBFFFI9OA-cp97LVxSGnKH_zpw3ml3WdMwyIEA/export?format=csv&gid=0`

Erkannte Spalten: title, start, end, url, image, locationName. Gezeigt werden nur
zukünftige Events mit Link zu lueneburgtickets.de oder tickets.svg-lueneburg.de, max. 12.

## Schritt 2: GitHub (5 Min.)

1. Neues **privates** Repository `gutschein-lueneburg` anlegen
2. Zip **lokal entpacken**, in den Ordner `gutschein-site` gehen,
   **den Inhalt** (nicht den Ordner) per Drag & Drop hochladen → Commit
   - Wichtig: Der Ordner `.github` ist unter Windows evtl. ausgeblendet
     (Explorer → Ansicht → Ausgeblendete Elemente). Er muss mit hoch.
   - Alternativ diese eine Datei per „Add file → Create new file“ anlegen:
     `.github/workflows/events.yml`

## Schritt 3: Automatik einrichten (3 Min.)

1. Im Repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SHEET_CSV_URL` · Wert: der CSV-Link aus Schritt 1
2. **Actions**-Tab → „Events aktualisieren“ → **Run workflow**
   → nach ~1 Min. grüner Haken = Events sind drin
3. Läuft ab jetzt jeden Morgen automatisch.

## Schritt 4: Netlify (5 Min.)

1. **Add new project → Import an existing project → GitHub** → Repo wählen
2. Build-Einstellungen werden aus `netlify.toml` übernommen – nichts ändern → Deploy
3. Für den täglichen Neubau (damit vergangene Events auch ohne neue Daten
   verschwinden): **Project configuration → Build & deploy → Build hooks →
   Add build hook** → URL kopieren → in GitHub als zweites Secret
   `NETLIFY_BUILD_HOOK` speichern

## Schritt 5: CMS (DecapBridge, 5 Min.)

1. decapbridge.com → **Add site** → Repo `cheeeseecker/gutschein-lueneburg`,
   neuen Fine-grained Token nur für dieses Repo (Contents + Pull requests: Read & write)
2. Login-URL: `https://[netlify-adresse]/admin/` · Auth type: **Classic**
3. In `src/admin/config.yml` bei `identity_url` die Site-ID statt AUSFUELLEN eintragen
4. Unter /admin/ lassen sich dann Gutscheine hinzufügen, umsortieren und
   Stimmungsfotos (max. 4) hochladen. UTMs werden automatisch ergänzt.

## Schritt 6: Domains bei Ionos

Für **gutschein-lüneburg.de** (Hauptdomain) und **lüneburg-gutschein.de** (leitet weiter):
- A-Record `@` → `75.2.60.5`
- CNAME `www` → `[netlify-adresse].netlify.app`

In Netlify unter **Domain management** alle vier Varianten hinzufügen
(mit/ohne www, beide Domains), `www.gutschein-lüneburg.de` als Primary.
Die Weiterleitungen sind schon in `netlify.toml` hinterlegt.

---

## Tracking (UTM)

Alle Links werden beim Bauen automatisch ergänzt:
- Gutscheine: `utm_source=gutschein-lueneburg&utm_medium=referral&utm_campaign=gutscheine&utm_content=[motiv]`
- Events: `…&utm_campaign=eventliste&utm_content=[eventname]`
- Footer/Shop: `…&utm_campaign=footer` bzw. `alle-events`

## Vor dem Launch noch offen

- [ ] Telefonnummer von Lüneburg TICKETS im Impressum (`src/impressum.html`, TODO)
- [ ] Motiv „Für alle Fälle“ ist nachgebaut – bei Bedarf gegen die Originalgrafik tauschen (CMS)
- [ ] Produktlink für „Für dich“ eintragen, sobald vorhanden (aktuell Gutschein-Übersicht)
- [ ] Rechtstexte einmal gegenlesen lassen
- [ ] Nach Livegang: Search Console + Sitemap `/sitemap.xml` einreichen
