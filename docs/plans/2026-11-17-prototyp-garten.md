# Prototyp Garten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Wegwerf-Prototyp, in dem Cartoon-Hunde im Garten von selbst laufen, schnüffeln, sitzen und schlafen, damit Erdem den Look und das Gefühl beurteilen kann.

**Architecture:** Reine Logik (Zufall, Persönlichkeit, Verhalten, Zielpunkte) liegt in kleinen Modulen ohne Phaser und wird mit Vitest getestet.
Die Darstellung (Hund aus Körperteilen, Animationen, Szene) liegt in Phaser-Klassen und wird per Screenshot im Browser geprüft.
Der Prototyp ist bewusst ohne Next.js und ohne Online-Speicher, beides kommt erst in Schritt 1.

**Tech Stack:** TypeScript, Vite, Phaser 3, Vitest.

**Spec:** `C:\Users\erdem\desktop\random\hundespiel\ENTWURF.md` (Abschnitte "Hunde", "Reihenfolge" Schritt 0).

## Global Constraints

- Ordner: `C:\Users\erdem\desktop\random\hundespiel\prototype`
- Stil: 2D Cartoon, Garten-Szene.
- Der Hund stirbt nie, es gibt keine Strafen.
- Der Hund bewegt sich von selbst, es braucht keinen Klick.
- Aussehen als Baukasten aus Körpergröße, Ohren, Schwanz, Fellfarbe und Fellmuster.
- Persönlichkeit mit fünf Eigenschaften: Energie, Mut, Anhänglichkeit, Lernwille, Verfressenheit, jeweils 0 bis 1.
- Zielgerät: Android-Handy im Hochformat (360x640) und PC-Browser.
- Kein Co-Authored-By und kein Session-Link in Commit-Nachrichten.
- Keine Gedankenstriche in Texten, nur einfache Bindestriche.
- Pro Commit nur Typecheck (`npx tsc --noEmit`) und die betroffene Testdatei.
- Wegwerf-Code: keine Lint-Einrichtung, kein Online-Speicher, kein Login.

## Review Focus

- Persönlichkeit mit allen Werten auf 0 oder alle auf 1: `pickBehavior` liefert immer ein gültiges Verhalten, nie `undefined`, nie NaN-Gewichte.
- Der Hund läuft nie aus dem Garten: Zielpunkte und Schritte bleiben innerhalb der Grenzen.
- Tab im Hintergrund und Rückkehr nach Minuten: große Zeitsprünge werden gekappt, der Hund teleportiert nicht.
- Hochformat 360x640 und Querformat: Die Szene skaliert und nichts wird abgeschnitten.
- Gleicher Seed ergibt denselben Hund, damit eine gute Kombination reproduzierbar ist.

---

### Task 1: Projektgerüst und leere Garten-Szene

**Files:**
- Create: `prototype/package.json`, `prototype/index.html`, `prototype/tsconfig.json`, `prototype/vite.config.ts`, `prototype/src/main.ts`, `prototype/src/scenes/GardenScene.ts`
- Create: `prototype/src/util/rng.ts`, `prototype/tests/rng.test.ts`

**Interfaces:**
- Produces: `type Rng = () => number` (Wert in [0,1)), `mulberry32(seed: number): Rng`, `clampDelta(ms: number, max?: number): number` (Standard `max = 100`, negative Werte werden 0), alle in `src/util/rng.ts`.
- Produces: `class GardenScene extends Phaser.Scene` mit Schlüssel `'garden'` und der Konstante `GARDEN_BOUNDS: { x: 20, y: 300, w: 320, h: 300 }` (exportiert aus `GardenScene.ts`), Spielfeld 360x640.

- [ ] **Step 1: Ordner anlegen, Git starten, Abhängigkeiten installieren**

In `hundespiel` ausführen: `git init`.
In `prototype` ausführen: `npm init -y`, dann `npm i phaser` und `npm i -D typescript vite vitest`.
Skripte in `package.json`: `dev` = `vite`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`.

- [ ] **Step 2: Failing tests schreiben (`tests/rng.test.ts`)**

```ts
test('mulberry32 mit gleichem Seed liefert dieselbe Folge', () => {
  const a = mulberry32(42), b = mulberry32(42)
  expect([a(), a(), a()]).toEqual([b(), b(), b()])
})
test('mulberry32 liefert Werte in [0,1)', () => {
  const r = mulberry32(7)
  for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
})
test('clampDelta kappt große Sprünge auf 100', () => { expect(clampDelta(60000)).toBe(100) })
test('clampDelta lässt kleine Werte durch und macht Negatives zu 0', () => {
  expect(clampDelta(16)).toBe(16); expect(clampDelta(-5)).toBe(0)
})
```

- [ ] **Step 3: Test laufen lassen, muss fehlschlagen**

Run: `npx vitest run tests/rng.test.ts` (in `prototype`).
Expected: FAIL, `mulberry32` ist nicht definiert.

- [ ] **Step 4: `mulberry32` und `clampDelta` in `src/util/rng.ts` implementieren**

Standardalgorithmus mulberry32.

- [ ] **Step 5: Test laufen lassen, muss bestehen**

Run: `npx vitest run tests/rng.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 6: `index.html`, `main.ts` und `GardenScene` anlegen**

Phaser-Konfiguration: Größe 360x640, `scale.mode = Phaser.Scale.FIT`, `autoCenter = CENTER_BOTH`, Hintergrund hellgrün.
`GardenScene` zeichnet den Himmel (hellblau, oben bis y=300), die Wiese (grün, darunter) und einen Zaun (braune Rechtecke bei y=290) mit `Graphics`.

- [ ] **Step 7: Typecheck und Sichtprüfung**

Run: `npx tsc --noEmit`, Expected: keine Fehler.
Run: `npm run dev`, die Seite im Browser öffnen, Screenshot machen.
Expected: Himmel, Zaun und Wiese sind sichtbar, bei 360x640 ohne Abschneiden, auch im Querformat.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold prototype with garden scene and rng utils"
```

---

### Task 2: Persönlichkeit und Verhaltenswahl (reine Logik)

**Files:**
- Create: `prototype/src/dog/behavior.ts`
- Test: `prototype/tests/behavior.test.ts`

**Interfaces:**
- Consumes: `Rng` aus `src/util/rng.ts`.
- Produces in `src/dog/behavior.ts`:
  - `interface Personality { energy: number; courage: number; affection: number; learning: number; appetite: number }` (jeweils 0 bis 1)
  - `type Behavior = 'wander' | 'sniff' | 'sit' | 'sleep'`
  - `randomPersonality(rng: Rng): Personality`
  - `pickBehavior(p: Personality, rng: Rng): Behavior`
  - `behaviorDuration(b: Behavior, p: Personality, rng: Rng): number` (Millisekunden, immer größer 0)

- [ ] **Step 1: Failing tests schreiben**

```ts
test('randomPersonality liefert fünf Werte in [0,1]', ...)  // alle Schlüssel vorhanden, 0 <= v <= 1
test('energiegeladener Hund wandert öfter als er schläft', () => {
  const p = { energy: 1, courage: .5, affection: .5, learning: .5, appetite: .5 }
  // 2000 Ziehungen mit mulberry32(1): Anteil 'wander' > Anteil 'sleep'
})
test('träger Hund schläft öfter als er wandert', () => { /* energy: 0, gleiche Auswertung umgekehrt */ })
test('Extremwerte liefern immer ein gültiges Verhalten', () => {
  for (const v of [0, 1]) {
    const p = { energy: v, courage: v, affection: v, learning: v, appetite: v }
    // 500 Ziehungen: jedes Ergebnis liegt in ['wander','sniff','sit','sleep']
  }
})
test('behaviorDuration ist positiv, schlafen dauert länger als schnüffeln', () => { /* Mittel über 200 Ziehungen */ })
```

- [ ] **Step 2: Tests laufen lassen, müssen fehlschlagen**

Run: `npx vitest run tests/behavior.test.ts`
Expected: FAIL, Funktionen nicht definiert.

- [ ] **Step 3: Implementieren in `src/dog/behavior.ts`**

Gewichtete Zufallswahl. Hohe Energie erhöht das Gewicht von `wander` und senkt das von `sleep`.
Geringer Mut erhöht `sit`.
Jedes Gewicht ist mindestens 0.1, damit die Summe nie 0 wird.

- [ ] **Step 4: Tests laufen lassen, müssen bestehen**

Run: `npx vitest run tests/behavior.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck und Commit**

Run: `npx tsc --noEmit`, Expected: keine Fehler.

```bash
git add src/dog/behavior.ts tests/behavior.test.ts
git commit -m "feat: personality and behavior selection"
```

---

### Task 3: Aussehen als Baukasten (reine Logik)

**Files:**
- Create: `prototype/src/dog/look.ts`
- Test: `prototype/tests/look.test.ts`

**Interfaces:**
- Consumes: `Rng`.
- Produces in `src/dog/look.ts`:
  - `type EarType = 'floppy' | 'pointy' | 'round'`, `type TailType = 'short' | 'long' | 'curly'`, `type Pattern = 'plain' | 'spots' | 'patch'`
  - `interface DogLook { size: number; ear: EarType; tail: TailType; coat: number; pattern: Pattern; patternColor: number }`, wobei `size` zwischen 0.7 und 1.3 liegt und `coat` und `patternColor` Farben als `0xRRGGBB` sind.
  - `randomLook(rng: Rng): DogLook`

- [ ] **Step 1: Failing tests schreiben**

```ts
test('gleicher Seed ergibt gleichen Look', () => { expect(randomLook(mulberry32(5))).toEqual(randomLook(mulberry32(5))) })
test('size liegt in [0.7, 1.3] und Farben sind gültig', () => { /* 300 Looks */ })
test('über viele Seeds kommen alle Ohren-, Schwanz- und Mustertypen vor', () => { /* 300 Seeds, Set-Größe 3 je Typ */ })
```

- [ ] **Step 2: Tests laufen lassen, müssen fehlschlagen**

Run: `npx vitest run tests/look.test.ts`
Expected: FAIL.

- [ ] **Step 3: `randomLook` implementieren**

Fellfarben aus einer festen Palette natürlicher Hundetöne (Braun, Creme, Schwarz, Grau, Rotbraun), Muster-Farbe zufällig daraus, aber nicht gleich der Fellfarbe.

- [ ] **Step 4: Tests laufen lassen, müssen bestehen**

Run: `npx vitest run tests/look.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck und Commit**

Run: `npx tsc --noEmit`, Expected: keine Fehler.

```bash
git add src/dog/look.ts tests/look.test.ts
git commit -m "feat: modular dog look generator"
```

---

### Task 4: Hund zeichnen und animieren

**Files:**
- Create: `prototype/src/dog/dogSprite.ts`
- Modify: `prototype/src/scenes/GardenScene.ts`

**Interfaces:**
- Consumes: `DogLook`, `Phaser.Scene`.
- Produces in `src/dog/dogSprite.ts`:
  - `type Pose = 'walk' | 'sit' | 'sleep' | 'sniff'`
  - `class DogSprite { constructor(scene: Phaser.Scene, look: DogLook, x: number, y: number); readonly container: Phaser.GameObjects.Container; setPose(pose: Pose): void; face(dir: -1 | 1): void; update(dtMs: number): void }`

Der Hund besteht aus Körper, Kopf, Ohren, Schwanz und vier Beinen als `Graphics`- oder Formobjekte im Container. Größe über `container.setScale(look.size)`.

- [ ] **Step 1: `DogSprite` implementieren**

Posen: `walk` = Beine pendeln im Wechsel und der Körper wippt leicht, `sit` = Hinterteil nach unten und Schwanz ruhig, `sleep` = flach liegend mit hängendem Kopf, `Z`-Symbol steigt auf, `sniff` = Kopf zum Boden und Nase zuckt.
Der Schwanz wedelt in `walk` und `sit`, Form nach `look.tail`.
Ohren nach `look.ear`, Muster nach `look.pattern` (Flecken oder Fleck über einem Auge).
`face(dir)` spiegelt über `scaleX`.
`update(dtMs)` kappt `dtMs` über `clampDelta` und treibt die Animationsphase an.

- [ ] **Step 2: Hund in `GardenScene` einsetzen**

Ein Hund mit `randomLook(mulberry32(1))` bei (180, 450), Pose `walk`.
In `update(_, delta)` ruft die Szene `dog.update(delta)`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 4: Sichtprüfung der vier Posen**

Beim Entwickeln die Pose kurz per Konsole oder fest in der Szene wechseln und je einen Screenshot machen.
Expected: Alle vier Posen sind klar unterscheidbar, die Ohren- und Schwanzform stimmt mit dem Look überein, nichts ragt abgeschnitten heraus.

- [ ] **Step 5: Commit**

```bash
git add src/dog/dogSprite.ts src/scenes/GardenScene.ts
git commit -m "feat: draw and animate modular dog"
```

---

### Task 5: Der Hund lebt von selbst und Welpenauswahl-Vorschau

**Files:**
- Create: `prototype/src/dog/wander.ts`
- Test: `prototype/tests/wander.test.ts`
- Modify: `prototype/src/scenes/GardenScene.ts`

**Interfaces:**
- Consumes: `Rng`, `Personality`, `Behavior`, `pickBehavior`, `behaviorDuration`, `DogSprite`, `GARDEN_BOUNDS`.
- Produces in `src/dog/wander.ts`:
  - `interface Vec { x: number; y: number }`, `interface Rect { x: number; y: number; w: number; h: number }`
  - `nextTarget(bounds: Rect, current: Vec, maxStep: number, rng: Rng): Vec` (Ergebnis liegt immer in `bounds`)
  - `stepToward(pos: Vec, target: Vec, speed: number, dtMs: number): Vec` (schießt nie über das Ziel hinaus)

- [ ] **Step 1: Failing tests schreiben**

```ts
test('nextTarget bleibt in den Grenzen, auch am Rand', () => { /* 500 Ziehungen, current in allen vier Ecken */ })
test('nextTarget geht höchstens maxStep weit', () => { /* Abstand <= maxStep (nach Klemmen) */ })
test('stepToward erreicht das Ziel ohne es zu überschreiten', () => { /* großer dt: Ergebnis == target */ })
test('stepToward bewegt sich bei dt = 0 nicht', () => { /* pos unverändert */ })
```

- [ ] **Step 2: Tests laufen lassen, müssen fehlschlagen**

Run: `npx vitest run tests/wander.test.ts`
Expected: FAIL.

- [ ] **Step 3: `nextTarget` und `stepToward` implementieren**

Zielpunkt zufällig im Umkreis `maxStep`, danach auf `bounds` geklemmt.

- [ ] **Step 4: Tests laufen lassen, müssen bestehen**

Run: `npx vitest run tests/wander.test.ts`
Expected: PASS.

- [ ] **Step 5: Verhalten in `GardenScene` verdrahten**

Der Hund wählt mit `pickBehavior` sein Verhalten und hält es für `behaviorDuration` Millisekunden.
`wander` setzt `walk`, wählt per `nextTarget` ein Ziel und läuft mit `stepToward` dorthin, dreht sich über `face` in Laufrichtung, am Ziel wählt er neu.
`sniff`, `sit` und `sleep` stehen still mit der passenden Pose.
Die Persönlichkeit kommt aus `randomPersonality(mulberry32(1))`.

- [ ] **Step 6: Drei Welpen zur Vorschau**

Taste `N` (am PC) und Tippen auf eine Schaltfläche "Neue Welpen" (am Handy) würfelt drei neue Hunde mit je eigenem `randomLook` und `randomPersonality`, die gleichzeitig im Garten leben.
Über jedem Hund steht klein sein Verhalten und sein auffälligster Persönlichkeitswert (zum Beispiel "schüchtern", "aufgeweckt"), nur zum Beurteilen im Prototyp.

- [ ] **Step 7: Typecheck und Sichtprüfung**

Run: `npx tsc --noEmit`, Expected: keine Fehler.
Run: `npm run dev`, danach Screenshots bei 360x640 und im Querformat, mindestens zwei Minuten laufen lassen.
Expected: Alle drei Hunde bleiben im Garten, wechseln sichtbar zwischen Laufen, Schnüffeln, Sitzen und Schlafen, die Hunde wirken unterschiedlich.
Zusätzlich: Tab 30 Sekunden im Hintergrund lassen und zurückkehren, kein Hund springt in einem Satz über die Szene.

- [ ] **Step 8: Gesamttests und Commit**

Run: `npx vitest run`, Expected: alle Tests bestehen.

```bash
git add -A
git commit -m "feat: dogs live on their own, puppy preview"
```

---

## Danach

Erdem schaut sich den Prototyp an und entscheidet über den Look (2D-Stil, Hundeformen, Animationen, ob Cartoon aus Code reicht oder gekaufte Sprites besser sind).
Erst danach schreibe ich den Plan für Schritt 1 (Welpenauswahl, Next.js, Supabase, Bedürfnisse).
