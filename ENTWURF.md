# Hundespiel - Entwurf

Ein privates Hundepflege-Spiel für zwei Personen (Erdem und Ehefrau).
Eigenes Spiel im Genre von Nintendogs, mit eigenem Look, eigenen Hunden und eigenen Regeln.
Kein Nachbau von Nintendogs (Name, Figuren, Grafik, Musik, Levels).

## Absicht

Zwei Menschen pflegen gemeinsam Hunde.
Die Hunde laufen von selbst herum, haben Charakter, lernen Tricks und treten in Ligen an.
Der Reiz ist der Grind-Kreislauf: Trainieren, Wettkampf, Preisgeld, Ausstattung, stärkerer Hund, höhere Liga.
Der zweite Reiz ist, den Hund einfach zu beobachten und zu merken, dass jeder anders ist.

## Ziele

- Der Hund wirkt lebendig: läuft, schläft, schnüffelt und spielt von selbst, ohne dass man klicken muss.
- Beide sehen auf dem eigenen Android-Handy denselben Hund und denselben Stand.
- Fortschritt ist sichtbar: Stats, Gehorsam pro Trick, Ligen, Wohnung.
- Jeder Hund fühlt sich anders an (Rasse, Persönlichkeit, Bindung).
- Wettkämpfe sind Spiel, nicht Zuschauen: Der Hund handelt nach seinen Stats, der Mensch greift im richtigen Moment ein.

## Nicht-Ziele

- Kein Play Store, keine Veröffentlichung, keine öffentlichen Konten.
- Kein 3D-Hund in der ersten Ausbaustufe (bleibt später möglich).
- Kein Zwang zum gleichzeitigen Spielen.
- Kein Echtgeld, keine Werbung.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Druck oder Strafe: Der Hund stirbt nie, Vernachlässigung macht ihn nur traurig.
- Ständiges Klicken, damit sich der Hund bewegt.
- Benachrichtigungen, die nerven.
- Ein Hund, der aussieht wie ein Platzhalter.

## Randbedingungen

- Zielgeräte: ein Android-Handy und ein iPhone, außerdem PC-Browser. Gespielt wird im Querformat und im Vollbild (installiert als App-Symbol auf dem Homescreen).
- Hunger, Müdigkeit und Ähnliches laufen in Echtzeit weiter, werden aber aus der vergangenen Zeit berechnet, damit kein Server dauernd laufen muss.
- Komplett kostenlos: kostenloser Supabase-Tarif, GitHub Pages (dafür ist das Repo öffentlich, Geheimnisse sind nicht darin). Grafik selbst gezeichnet, im 2D-Cartoon-Look, ohne Menschen.

## Ansätze, die wir betrachtet haben

| Ansatz | Vorteil | Nachteil |
|---|---|---|
| Web-App mit Phaser (2D) und Online-Speicher | Änderungen sofort per Neuladen, Benachrichtigungen auf Android ohne Zusatzaufwand, Agent kann selbst testen | Weniger Spielphysik als eine echte Engine |
| Godot mit APK-Export | Bestes Spielgefühl, 3D möglich | Jede Änderung heißt neue APK auf zwei Handys, Benachrichtigungen brauchen Plugin und Einrichtung, schwerer vom Agenten zu testen |
| Reine Web-App ohne Spiel-Engine | Einfachster Start | Wettkämpfe fühlen sich wie Formulare an |

Gewählt: Web-App mit Phaser (2D).
Grund: Das Spiel ist menülastig (Stats, Shop, Ligen, Verlauf) und braucht ohnehin einen gemeinsamen Online-Speicher.
Godot bleibt als Ausweichoption, falls die Spielphysik später nicht reicht.

## Entscheidungen (so, wie sie getroffen wurden)

### Spielgefühl
- Zeitversetztes Spielen mit Aktivitätsverlauf ist die Grundlage, gleichzeitiges Spielen ein Bonus.
- Echtzeit-Verfall ohne Tod und ohne Strafe.
- Look: 2D im Cartoon-Stil, Szenen für Garten und Wohnung.

### Hunde
- Start mit einer Welpenauswahl: drei zufällige Welpen verschiedener Rassen, grober Eindruck sichtbar, genaue Werte erst im Zusammenleben.
- Jeder der zwei wählt am Anfang seinen eigenen Welpen aus einer eigenen Auswahl, der Haushalt startet also mit zwei Hunden. Beide Hunde gehören dem Haushalt, beide pflegen beide.
- Mehr Hunde möglich: neue Welpen für Preisgeld, Platz begrenzt durch die Wohnung (zum Beispiel 2 am Anfang, 5 am Ende).
- Echte Rassen (acht zum Start: Husky, Labrador, Dackel, Schäferhund, Corgi, Pudel, Dalmatiner, Mops) mit eigenem Aussehen, Charaktertendenz und Begabungen (Tempo, Ausdauer, Sprungkraft, Gehorsam). Zum Beispiel ist der Corgi schnell und flink, der Husky ausdauernd, der Schäferhund gehorsam. Die Begabungen sind die Startwerte für die Stats ab Schritt 2.
- Aussehen als Baukasten aus Körpergröße, Ohren, Schwanz und Fellmuster innerhalb der Rasse.
- Alter läuft in Echtzeit mit (Welpe, Junghund, Erwachsen, aus dem Anlagedatum berechnet, mit Babyvariante der Grafik). Das kommt als eigener Schritt nach Schritt 1.
- Persönlichkeit zufällig, etwa fünf Eigenschaften (zum Beispiel Anhänglichkeit, Mut, Energie, Lernwille, Verfressenheit).
- Persönlichkeit beeinflusst das Verhalten im Garten, die Lerngeschwindigkeit und das Verhalten im Wettkampf.
- Zustand der Hunde nicht als Balken: Hunger, Müdigkeit und Laune zeigen sich am Verhalten (träge, langsam, hängender Kopf, schläft mehr). Nur auf Antippen eines Hundes erscheint kurz eine Sprechblase mit seinem Zustand, nichts ist dauernd eingeblendet.
- Pflege als echte Interaktion, nicht als Knopf: Streicheln durch Wischen über den Hund, Futter wird in den Garten geworfen und die Hunde laufen hin (wer zuerst da ist, frisst; Tempo der Rasse, Verfressenheit und Mut entscheiden; das Handy, das wirft, entscheidet den Ausgang und schreibt ihn in die Datenbank), Ball werfen und apportieren, Bürsten.
- Nichts ist unendlich: Geld (Münzen) und ein gemeinsamer Vorrat (Futter, Leckerli, Ball, Bürste) pro Haushalt. Futter kostet Münzen, ein satter Hund frisst nicht mehr, zu viele Leckerli machen krank. Münzen kommen zunächst als Taschengeld (läuft in Echtzeit auf, mit Obergrenze), später aus Wettkämpfen. Das kommt als Stufe B vor dem Shop aus Schritt 3.
- Bindungswert pro Person: Wer sich mehr kümmert, wird Lieblingsmensch, und anhängliche Hunde warten auf diese Person.
- Beziehungen zwischen den Hunden: Jedes Hundepaar hat einen Beziehungswert (von Feinde über Fremde bis beste Freunde). Er wächst durch gemeinsame Zeit und passende Charaktere (zwei verspielte Hunde, ein mutiger und ein ängstlicher beschützter) und sinkt durch Streit, etwa ums Futter. Sichtbar in einer Beziehungsansicht (Herzen pro Paar) und im Garten.
- Interaktionen im Garten: beschnuppern, zusammen spielen und herumtollen, nebeneinander schlafen, Futter teilen oder verteidigen, Streit. Welche Interaktion entsteht, hängt von Charakter, Rasse und Beziehungswert ab. Die Hunde der zwei Personen sehen dasselbe, der Beziehungswert liegt gemeinsam in der Datenbank. Das kommt als eigener Schritt nach Schritt 1.

### Training und Stats
- Werte: Tempo, Ausdauer, Sprungkraft, Gehorsam, jeweils mit Level.
- Training kostet Zeit und Energie des Hundes.
- Tricks (zum Beispiel Sitz, Platz, Pfote) werden per Knopf und Leckerli trainiert, mit Gehorsam-Wert in Prozent pro Trick.
- Bei niedrigem Wert ignoriert der Hund Befehle manchmal oder macht sie falsch.
- Futterqualität gibt zeitlich begrenzte Boni.

### Wettkämpfe und Ligen
- Ligen von unten nach oben (zum Beispiel Welpen-Cup, Bronze, Silber, Gold, Olympia).
- Pro Liga mehrere Disziplinen (Frisbee, Hindernislauf, Sprint, Apportieren) und eine Tricks-Show.
- Gegner sind Computer-Hunde mit festen Werten, Aufstieg über Pokalpunkte.
- Der Hund handelt selbst nach seinen Stats, der Mensch greift mit einem einfachen Handgriff ein (zum Beispiel Wurf oder Kommando im richtigen Moment).
- Tricks schalten Disziplinen frei (Frisbee braucht "Fang", Hindernislauf "Sitz" und "Bleib").
- Jeder Hund hat eigene Stats und Liga-Stände.
- Duell: beide treten mit je einem eigenen Hund auf demselben Kurs an, bei Bedarf zeitversetzt.
- Tricks-Show: Punkte aus Anzahl der Tricks, Gehorsam und Reaktionszeit.

### Geld und Wohnung
- Gemeinsames Konto für beide.
- Ausgaben: besseres Futter, Spielzeug, Trainingsgeräte, Möbel, Wohnungsausbau, Deko, Halsbänder, neue Welpen, Tierarzt.
- Glück-Wert steigt mit besserer Wohnung: Der Hund erholt sich schneller, trainiert besser und startet mit einem kleinen Bonus in Wettkämpfe.

### Events
- Zufallsereignisse, positiv und negativ: Streuner am Gartentor, Besuch, Schatz, Sonderturnier, Gewitter, Krankheit, Verletzung, zerkauter Teppich, Streit zwischen Hunden.
- Kein Tod.
- Verletzung und Krankheit: Der Hund pausiert bei Training und Wettkampf, bis er behandelt ist, das kostet Tierarztgeld, und es ist immer heilbar.
- Das Risiko steigt bei Übertraining und schlechter Pflege.
- Events hängen von Persönlichkeit und Wohnung ab.
- Events warten mehrere Stunden auf eine Entscheidung, wer zuerst reagiert, entscheidet, alles steht im Verlauf.
- Streuner: aufnehmen (wenn Platz), ins Tierheim bringen (kleine Belohnung) oder abwarten, manchmal bedankt sich das Herrchen mit Geld.
- Events als Datendatei (Bedingungen, Wahrscheinlichkeit, Auswahl, Folgen), Start mit etwa zehn.

### Zugang und Benachrichtigungen
- Zwei Konten, Login mit E-Mail und Passwort (ohne Bestätigungsmail), ein Haushalt mit höchstens zwei Personen, Beitritt über einen Einladungscode. Alle Daten sind per Zugriffsregeln nur für den eigenen Haushalt sichtbar.
- Benachrichtigungen sparsam: höchstens zwei pro Tag, nachts keine, pro Person abschaltbar.

## Reihenfolge

0. Wegwerf-Prototyp: gezeichneter Hund läuft, schläft und schnüffelt im Garten, damit der Look entschieden werden kann.
1. Welpenauswahl und ein lebender Hund mit Persönlichkeit im Garten, mit Füttern, Streicheln, Bedürfnissen und Verlauf.
2. Tricks, Training und Stats.
3. Erste Liga mit Frisbee, Preisgeld, Shop und Wohnung.
4. Events und weitere Disziplinen und Ligen bis Olympia.
5. Weitere Hunde, Duelle und der Streuner-Event.

Das Datenmodell ist von Schritt 1 an für mehrere Hunde und Persönlichkeiten ausgelegt.

## Meine Entscheidungen zum Wie (nicht vom Nutzer genannt)

- Phaser als 2D-Engine, Vite als Rahmen (statt Next.js: das Spiel ist rein im Browser, ein Server wird nicht gebraucht, die fertige Seite liegt statisch auf GitHub Pages).
- Supabase als Speicher (Login, Live-Aktualisierung), ein eigenes Projekt nur für das Spiel.
- Zustand der Hunde aus Zeitstempeln berechnet, kein dauernd laufender Server.
- Installation als App-Symbol auf dem Homescreen (PWA).
- Benachrichtigungen über Web-Push.
- Events als Datendatei.

## Dem Builder überlassen

- Genaue Zahlen: Verfallsraten, Preise, Gegnerwerte, Level-Kurven.
- Name des Spiels und der Rassen.
- Konkrete Eigenschaften und Disziplinen im Detail.
- Wie die erste Grafik entsteht (selbst gezeichnet in Code, später gegen gekaufte oder gezeichnete Sprites tauschbar).
