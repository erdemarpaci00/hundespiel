# Schritt 1 - Gemeinsamer Hund Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erdem und seine Frau melden sich an, wählen gemeinsam einen von drei Welpen, sehen denselben Hund auf beiden Handys, füttern und streicheln ihn, und die Bedürfnisse laufen in Echtzeit weiter.

**Architecture:** Statische Vite-Seite (aus dem Prototyp), Garten als Phaser-Szene, Menüs als HTML-Overlay.
Supabase (kostenlos) liefert Login, Datenbank und Live-Aktualisierung.
Die Bedürfnisse werden aus Zeitstempeln berechnet, es läuft kein Server.
Veröffentlicht wird über GitHub Pages.

**Tech Stack:** TypeScript, Vite, Phaser 4, Vitest, `@supabase/supabase-js`, GitHub Actions.

**Spec:** `C:\Users\erdem\desktop\random\hundespiel\ENTWURF.md` (Reihenfolge Schritt 1, Abschnitte "Hunde", "Zugang und Benachrichtigungen").
Vorgänger: `docs/plans/2026-11-17-prototyp-garten.md` (fertig).

## Global Constraints

- Alles kostenlos: Supabase Free, GitHub Pages, keine gekauften Assets.
- Hund stirbt nie, keine Strafen: Bedürfnisse fallen nie unter 10 (von 100).
- Persönlichkeit: Energie, Mut, Anhänglichkeit, Lernwille, Verfressenheit, jeweils 0 bis 1.
- Querformat, Welt 640x360, gerendert 1920x1080, Vollbild als Home-Bildschirm-App auf iPhone und Android.
- Genau zwei Konten pro Haushalt, nichts Öffentliches.
- Login mit E-Mail und Passwort (Abweichung vom Entwurf "E-Mail-Link", Grund: auf dem iPhone öffnet der Link Safari statt der Home-Bildschirm-App, der Login ginge verloren).
- Nur der öffentliche `anon`-Schlüssel kommt in den Code, nie der `service_role`-Schlüssel.
- Keine Gedankenstriche in Texten, nur einfache Bindestriche. Sichtbare Texte auf Deutsch.
- Kein Co-Authored-By und kein Session-Link in Commits.
- Pro Commit nur Typecheck und die betroffene Testdatei.

## Review Focus

- Lange Abwesenheit (Wochen) und Handy-Uhr falsch gestellt: Bedürfnisse springen nie unter 10 und nie über 100, negative Zeit ändert nichts, höchstens 7 Tage werden angerechnet.
- Beide füttern fast gleichzeitig: Der zweite Schreibvorgang überschreibt den ersten nicht, er arbeitet auf dem neuen Stand.
- Falscher oder bereits benutzter Einladungscode, Leerzeichen und Kleinbuchstaben im Code: klare Fehlermeldung, kein Absturz, ein dritter Mensch kommt nicht in den Haushalt.
- Ohne Netz oder bei abgelaufener Sitzung: verständliche Meldung statt leerem Bildschirm.
- Ein Konto sieht nie Daten eines fremden Haushalts (Prüfung der Zeilen-Sicherheit).

---

### Task 1: Prototyp wird zur App, Supabase-Anbindung

**Files:**
- Move: `prototype/` nach `app/` (`git mv`)
- Create: `app/.env.local` (git-ignoriert), `app/.env.example`, `app/src/supabase.ts`
- Modify: `.gitignore` (`.env.local`)

**Interfaces:**
- Produces: `supabase: SupabaseClient` aus `app/src/supabase.ts`, gebaut aus `import.meta.env.VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`. Fehlt eine der Variablen, wirft das Modul beim Import `Error('Supabase ist nicht konfiguriert')`.

- [ ] **Step 1: Ordner umbenennen und Abhängigkeit installieren**

`git mv prototype app`, in `app` `npm i @supabase/supabase-js`.
Run: `npx tsc --noEmit && npx vitest run`, Expected: weiterhin 17 Tests grün.

- [ ] **Step 2: `.env.example` mit den zwei Variablennamen anlegen, echte Werte nach `.env.local` (von Erdem geliefert, nie committen)**

- [ ] **Step 3: `src/supabase.ts` implementieren**

- [ ] **Step 4: Typecheck, Commit**

```bash
git add -A && git commit -m "chore: turn prototype into app, add supabase client"
```

---

### Task 2: Bedürfnisse (reine Logik)

**Files:**
- Create: `app/src/dog/needs.ts`
- Test: `app/tests/needs.test.ts`

**Interfaces:**
- Consumes: `Personality` aus `src/dog/behavior.ts`.
- Produces in `needs.ts`:
  - `interface Needs { hunger: number; energy: number; happiness: number }` (0 bis 100, 100 = satt, ausgeruht, glücklich)
  - `const MIN_NEED = 10`, `const MAX_ELAPSED_MS = 7 * 24 * 3600 * 1000`
  - `applyElapsed(n: Needs, elapsedMs: number, p: Personality): Needs`
  - `feed(n: Needs): Needs`, `pet(n: Needs, p: Personality): Needs`
  - `type Mood = 'happy' | 'ok' | 'hungry' | 'tired' | 'sad'`, `mood(n: Needs): Mood`

- [ ] **Step 1: Failing tests schreiben**

```ts
test('nach 8 Stunden ist ein Hund mit appetite 0.5 hungrig, aber nie unter MIN_NEED')
  // applyElapsed({hunger:100,energy:100,happiness:100}, 8h, p(0.5)).hunger <= 30 und >= MIN_NEED
test('verfressener Hund (appetite 1) verliert schneller Hunger als wählerischer (appetite 0)')
test('Wochen ohne Besuch: Werte bleiben in [MIN_NEED, 100], es werden höchstens 7 Tage angerechnet')
  // elapsed 60 Tage ergibt dasselbe wie 7 Tage
test('negative oder NaN-Zeit ändert nichts')
test('feed erhöht hunger um 40, höchstens auf 100, und happiness um 5')
test('pet erhöht happiness, anhänglicher Hund (affection 1) mehr als zurückhaltender (affection 0)')
test('mood: hunger < 30 ergibt hungry, energy < 30 ergibt tired, alle >= 70 ergibt happy, sonst ok, happiness < 30 ergibt sad')
```

- [ ] **Step 2: Tests laufen lassen, müssen fehlschlagen**

Run: `npx vitest run tests/needs.test.ts`, Expected: FAIL.

- [ ] **Step 3: Implementieren**

Verfall pro Stunde: hunger 12.5 * (0.7 + 0.6 * appetite), energy 6, happiness 2. Alle Ergebnisse auf [MIN_NEED, 100] begrenzt. Priorität in `mood`: sad vor hungry vor tired.

- [ ] **Step 4: Tests laufen lassen, müssen bestehen, Typecheck, Commit**

```bash
git add app/src/dog/needs.ts app/tests/needs.test.ts && git commit -m "feat: needs decay and care actions"
```

---

### Task 3: Verlaufstexte und Einladungscode (reine Logik)

**Files:**
- Create: `app/src/activity.ts`, `app/src/inviteCode.ts`
- Test: `app/tests/activity.test.ts`, `app/tests/inviteCode.test.ts`

**Interfaces:**
- Produces in `activity.ts`:
  - `type ActivityKind = 'adopt' | 'feed' | 'pet'`
  - `interface ActivityEntry { id: string; kind: ActivityKind; userName: string; dogName: string; at: string }` (`at` = ISO-Zeitstempel)
  - `describeActivity(e: ActivityEntry): string`: `feed` -> "Anna hat Bello gefüttert", `pet` -> "Anna hat Bello gestreichelt", `adopt` -> "Anna hat Bello aufgenommen"
  - `relativeTime(iso: string, nowMs: number): string`: unter 1 Minute "gerade eben", unter 60 Minuten "vor 5 Min", unter 24 Stunden "vor 3 Std", sonst "vor 2 Tagen", Zukunft oder ungültig "gerade eben"
- Produces in `inviteCode.ts`:
  - `generateInviteCode(rng: Rng): string` (6 Zeichen aus `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)
  - `normalizeInviteCode(input: string): string` (Leerzeichen und Bindestriche entfernt, Großbuchstaben)

- [ ] **Step 1: Failing tests schreiben**

Tests mit exakten Strings für alle drei `describeActivity`-Fälle, für `relativeTime` die Grenzen 30 s, 5 min, 3 h, 2 Tage, Zukunft und `'kaputt'`.
Für den Code: Länge 6, nur erlaubte Zeichen über 200 Seeds, `normalizeInviteCode(' ab-c d23 ')` ergibt `'ABCD23'`.

- [ ] **Step 2: Tests laufen lassen, müssen fehlschlagen**

Run: `npx vitest run tests/activity.test.ts tests/inviteCode.test.ts`, Expected: FAIL.

- [ ] **Step 3: Implementieren, Tests grün, Typecheck, Commit**

```bash
git add app/src/activity.ts app/src/inviteCode.ts app/tests && git commit -m "feat: activity texts and invite codes"
```

---

### Task 4: Datenbank und Zeilen-Sicherheit

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Produces: Tabellen und Funktionen, die spätere Tasks benutzen:
  - `households(id uuid pk default gen_random_uuid(), invite_code text unique not null, created_at timestamptz default now())`
  - `members(household_id uuid references households, user_id uuid references auth.users, display_name text not null, primary key (household_id, user_id))`, höchstens 2 Mitglieder pro Haushalt (Trigger)
  - `dogs(id uuid pk default gen_random_uuid(), household_id uuid references households, name text not null, look jsonb not null, personality jsonb not null, needs jsonb not null, needs_updated_at timestamptz not null default now(), created_at timestamptz default now())`
  - `activity(id uuid pk default gen_random_uuid(), household_id uuid references households, dog_id uuid references dogs, user_id uuid references auth.users, kind text not null check (kind in ('adopt','feed','pet')), created_at timestamptz default now())`
  - Funktion `create_household(p_display_name text, p_code text) returns uuid` und `join_household(p_display_name text, p_code text) returns uuid` (beide `security definer`, legen das Mitglied für `auth.uid()` an; `join` wirft bei unbekanntem Code oder vollem Haushalt)
  - Funktion `update_needs(p_dog_id uuid, p_expected timestamptz, p_needs jsonb) returns boolean` (setzt `needs` und `needs_updated_at = now()` nur wenn `needs_updated_at = p_expected`, gibt sonst `false` zurück)
  - Row Level Security auf allen Tabellen: Zeilen sind nur für Mitglieder des jeweiligen Haushalts les- und schreibbar. Realtime für `dogs` und `activity` aktiviert.

- [ ] **Step 1: `schema.sql` schreiben (Tabellen, Trigger, Funktionen, Policies, Realtime)**

- [ ] **Step 2: Erdem führt die Datei im Supabase-SQL-Editor aus**

Expected: "Success", Tabellen sichtbar im Table Editor.

- [ ] **Step 3: Sicherheitsprüfung mit zwei Testkonten**

Zwei Konten in zwei Haushalten anlegen, per Client prüfen: Konto A liest `dogs` von Haushalt B, Expected: 0 Zeilen. Ein dritter Mensch ruft `join_household` mit gültigem Code eines vollen Haushalts auf, Expected: Fehler.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql && git commit -m "feat: database schema with row level security"
```

---

### Task 5: Anmeldung und Haushalt

**Files:**
- Create: `app/src/ui/authScreen.ts`, `app/src/session.ts`
- Modify: `app/index.html` (Overlay-Container `#ui`), `app/src/main.ts`

**Interfaces:**
- Consumes: `supabase`, `generateInviteCode`, `normalizeInviteCode`.
- Produces in `session.ts`:
  - `interface Session { userId: string; householdId: string; displayName: string }`
  - `signIn(email: string, password: string): Promise<void>`, `signUp(email: string, password: string): Promise<void>`
  - `createHousehold(displayName: string): Promise<{ householdId: string; inviteCode: string }>`
  - `joinHousehold(displayName: string, code: string): Promise<string>` (wirft verständliche deutsche Fehlermeldungen)
  - `loadSession(): Promise<Session | null>` (null wenn nicht angemeldet oder noch kein Haushalt)

- [ ] **Step 1: Bildschirm bauen**

HTML-Overlay: E-Mail und Passwort, "Anmelden" und "Registrieren", danach "Neuen Haushalt anlegen" (zeigt den Einladungscode groß an) oder "Mit Code beitreten". Sichtbare Fehler für: falsches Passwort, Code unbekannt, Haushalt voll, kein Netz.

- [ ] **Step 2: Manuelle Prüfung im Browser**

Zwei Browserprofile. Profil 1 legt einen Haushalt an, Profil 2 tritt mit dem Code bei. Ein drittes Profil mit demselben Code, Expected: Fehlermeldung "Haushalt ist voll". Falscher Code mit Leerzeichen und Kleinschreibung, Expected: sauberer Fehler. Seite neu laden, Expected: bleibt angemeldet.

- [ ] **Step 3: Typecheck, Commit**

```bash
git add -A && git commit -m "feat: sign in and household creation/join"
```

---

### Task 6: Welpenauswahl

**Files:**
- Create: `app/src/ui/puppyPicker.ts`, `app/src/dogRepo.ts`
- Test: `app/tests/dogRepo.test.ts`

**Interfaces:**
- Consumes: `randomLook`, `randomPersonality`, `mulberry32`, `Session`.
- Produces in `dogRepo.ts`:
  - `interface DogRecord { id: string; name: string; look: DogLook; personality: Personality; needs: Needs; needsUpdatedAt: string }`
  - `rollPuppies(seed: number): { look: DogLook; personality: Personality }[]` (genau 3, gleicher Seed gleiche Welpen)
  - `adoptPuppy(session: Session, pick: { look: DogLook; personality: Personality }, name: string): Promise<DogRecord>` (legt den Hund mit Bedürfnissen 100/100/100 an und schreibt einen `adopt`-Eintrag; wirft, wenn der Haushalt schon einen Hund hat)

- [ ] **Step 1: Failing test für `rollPuppies` schreiben**

```ts
test('rollPuppies liefert genau 3 Welpen und ist mit gleichem Seed reproduzierbar', ...)
test('die drei Welpen unterscheiden sich im Look oder in der Persönlichkeit', ...)
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen, dann `rollPuppies` implementieren, Test grün**

Run: `npx vitest run tests/dogRepo.test.ts`.

- [ ] **Step 3: `adoptPuppy` und Auswahl-Bildschirm bauen**

Drei Welpen als kleine Phaser-Vorschau, jeder mit Eindruck ("wirkt schüchtern") aus `standoutTrait`, Namensfeld, Knopf "Aufnehmen". Die genauen Werte bleiben verborgen.

- [ ] **Step 4: Manuelle Prüfung**

Haushalt ohne Hund zeigt die Auswahl, nach dem Aufnehmen verschwindet sie auf beiden Geräten. Ein zweiter Versuch während der erste läuft, Expected: Fehlermeldung statt zweitem Hund.

- [ ] **Step 5: Typecheck, Commit**

```bash
git add -A && git commit -m "feat: puppy picker and adoption"
```

---

### Task 7: Gemeinsamer Garten mit Füttern, Streicheln, Verlauf

**Files:**
- Modify: `app/src/scenes/GardenScene.ts`, `app/src/dog/livingDog.ts`, `app/src/dogRepo.ts`
- Create: `app/src/ui/hud.ts`

**Interfaces:**
- Consumes: `DogRecord`, `applyElapsed`, `feed`, `pet`, `mood`, `describeActivity`, `relativeTime`, `update_needs`.
- Produces in `dogRepo.ts`:
  - `loadDog(session: Session): Promise<DogRecord | null>`
  - `careForDog(session: Session, dog: DogRecord, action: 'feed' | 'pet'): Promise<DogRecord>` (rechnet Bedürfnisse bis jetzt hoch, wendet die Aktion an, ruft `update_needs` mit `dog.needsUpdatedAt` auf; bei `false` lädt es den Hund neu und wiederholt genau einmal; schreibt einen `activity`-Eintrag)
  - `subscribeToHousehold(session: Session, onChange: () => void): () => void` (Realtime auf `dogs` und `activity`, gibt die Abmeldefunktion zurück)
  - `loadActivity(session: Session, limit: number): Promise<ActivityEntry[]>`

- [ ] **Step 1: `GardenScene` lädt den gespeicherten Hund**

Szene zeigt genau diesen Hund mit seinem `look` und seiner `personality`, Bedürfnisse aus `applyElapsed` (verstrichene Zeit seit `needsUpdatedAt`).
Das Verhalten hängt von `mood` ab: hungrig oder müde schlafen und sitzen mehr, glücklich wandert mehr.

- [ ] **Step 2: Anzeige und Knöpfe**

HUD mit drei Balken (Hunger, Energie, Glück) und den Knöpfen "Füttern" und "Streicheln", dazu der Verlauf ("Anna hat Bello gefüttert, vor 5 Min", die letzten 10).

- [ ] **Step 3: Live-Aktualisierung**

Eine Aktion auf Gerät 1 erscheint auf Gerät 2 innerhalb weniger Sekunden, ohne Neuladen.

- [ ] **Step 4: Manuelle Prüfung mit zwei Profilen**

Beide füttern fast gleichzeitig, Expected: Balken zeigt den Stand nach beiden Aktionen, zwei Einträge im Verlauf. Seite 1 Minute schließen und öffnen, Expected: Hunger ist gefallen. Netz abschalten, Expected: verständliche Meldung statt Absturz.

- [ ] **Step 5: Typecheck, Commit**

```bash
git add -A && git commit -m "feat: shared garden with feeding, petting and activity log"
```

---

### Task 8: Veröffentlichung auf GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`, `app/public/icon-192.png`, `app/public/icon-512.png`, `app/public/apple-touch-icon.png`
- Modify: `app/vite.config.ts` (`base` auf den Repo-Namen), `app/public/manifest.webmanifest` (Icons, `start_url` relativ), `app/index.html` (`apple-touch-icon`)

**Interfaces:**
- Produces: Die Seite ist unter `https://<github-name>.github.io/<repo>/` erreichbar, bei jedem Push auf `master` wird neu gebaut und veröffentlicht. Die Supabase-Werte kommen als GitHub-Repository-Variablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in den Build.

- [ ] **Step 1: Symbole erzeugen**

Ein einfaches Hunde-Gesicht als Symbol in drei Größen (aus dem Code gezeichnet, per kleinem Skript als PNG), keine fremden Dateien.

- [ ] **Step 2: Workflow schreiben**

Build mit `npm ci`, `npm run build` in `app`, Veröffentlichung über die offizielle Pages-Aktion.

- [ ] **Step 3: Erdem legt das GitHub-Repo an und setzt die zwei Variablen und Pages auf "GitHub Actions"**

Expected: Workflow läuft grün, Seite ist erreichbar.

- [ ] **Step 4: Prüfung auf den Handys**

Link öffnen, anmelden, "Zum Home-Bildschirm" hinzufügen, von dort starten.
Expected: Vollbild ohne Adressleiste, Hund sichtbar, Aktionen erscheinen auf dem anderen Handy.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "ci: deploy app to github pages"
```

---

## Danach

Plan für Schritt 2 (Tricks, Training, Stats) und, falls gewünscht, ein besserer Look für den Hund.
