import { describe, expect, it } from 'vitest'
import { duelScore, FAVORITE_BONUS, topLeague, average, cupsMissing, fitBonus, playRound, summarize, throwBonus, eligible, formBonus, LEAGUES, runContest, catchChance, moodOf } from '../src/dog/contest'

const stats = (v: number) => ({ tempo: v, ausdauer: v, sprungkraft: v, gehorsam: v })
const fixed = (x: number) => () => x

describe('contest', () => {
  it('Liga-Zulassung nach Durchschnitt', () => {
    expect(eligible(LEAGUES[0], stats(0))).toBe(true)
    expect(eligible(LEAGUES[3], stats(60))).toBe(false)
    expect(eligible(LEAGUES[3], stats(70), { gold: 3 })).toBe(true)
    expect(average({ tempo: 10, ausdauer: 20, sprungkraft: 30, gehorsam: 40 })).toBe(25)
  })
  it('starker Hund gewinnt Bronze sicher', () => {
    const r = runContest(LEAGUES[0], stats(80), fixed(0.5))
    expect(r.won).toBe(true)
    expect(r.prize).toBe(LEAGUES[0].win)
    expect(r.rounds).toHaveLength(4)
  })
  it('schwacher Hund verliert Olympia und bekommt den Trostpreis', () => {
    const r = runContest(LEAGUES[3], stats(20), fixed(0.5))
    expect(r.won).toBe(false)
    expect(r.prize).toBe(LEAGUES[3].consolation)
  })
  it('Preisgeld steigt mit der Liga', () => {
    const wins = LEAGUES.map((l) => l.win)
    expect([...wins].sort((a, b) => a - b)).toEqual(wins)
  })
})

describe('Aufstieg und Tagesform', () => {
  it('hoehere Ligen brauchen 3 Pokale der Liga davor', () => {
    expect(eligible(LEAGUES[1], stats(60), {})).toBe(false)
    expect(cupsMissing(LEAGUES[1], { bronze: 1 })).toBe(2)
    expect(eligible(LEAGUES[1], stats(60), { bronze: 3 })).toBe(true)
    expect(eligible(LEAGUES[1], stats(10), { bronze: 3 })).toBe(false)
    expect(cupsMissing(LEAGUES[0], {})).toBe(0)
  })
  it('gute Laune gibt Rueckenwind, schlechte kostet', () => {
    expect(formBonus(90)).toBe(5)
    expect(formBonus(50)).toBe(0)
    expect(formBonus(10)).toBe(-5)
    const mid = runContest(LEAGUES[0], stats(50), () => 0.5, 50)
    const good = runContest(LEAGUES[0], stats(50), () => 0.5, 90)
    expect(good.rounds[0].dog - mid.rounds[0].dog).toBe(5)
  })
})

describe('Frisbee-Runde', () => {
  const base = { stat: 'tempo' as const, value: 50, league: LEAGUES[1], form: 0, happiness: 50, affection: 0.5, throwQuality: 0.5 }
  it('ein perfekter Wurf hilft, ein schlechter schadet', () => {
    const mid = playRound(base, () => 0.5)
    const good = playRound({ ...base, throwQuality: 1 }, () => 0.5)
    const bad = playRound({ ...base, throwQuality: 0 }, () => 0.5)
    expect(throwBonus(1)).toBe(15)
    expect(good.dog - mid.dog).toBe(15)
    expect(bad.dog - mid.dog).toBe(-15)
  })
  it('anhaengliche Hunde passen besser zum Spieler', () => {
    expect(fitBonus(1)).toBeGreaterThan(fitBonus(0))
  })
  it('der schwaechere Hund mit perfekten Wuerfen schlaegt oft den staerkeren mit schlechten', () => {
    let wins = 0
    for (let i = 0; i < 2000; i++) {
      const weak = playRound({ ...base, value: 40, throwQuality: 1 }, Math.random)
      const strong = playRound({ ...base, value: 52, throwQuality: 0 }, Math.random)
      if (weak.dog > strong.dog) wins++
    }
    expect(wins).toBeGreaterThan(1000)
  })
  it('summarize zaehlt Runden', () => {
    const r = (won: boolean) => ({ stat: 'tempo' as const, dog: won ? 2 : 1, rival: won ? 1 : 2, won })
    expect(summarize(LEAGUES[0], [r(true), r(true), r(true), r(false)]).won).toBe(true)
    expect(summarize(LEAGUES[0], [r(true), r(false), r(false), r(false)]).prize).toBe(LEAGUES[0].consolation)
  })
})

it('Medaille richtet sich nach der hoechsten Liga mit Pokal', () => {
  expect(topLeague({})).toBe(-1)
  expect(topLeague({ bronze: 2 })).toBe(0)
  expect(topLeague({ bronze: 3, gold: 1 })).toBe(2)
})

it('Lieblingsmensch als Werfer gibt einen kleinen Bonus', () => {
  const b = { stat: 'tempo' as const, value: 50, league: LEAGUES[1], form: 0, happiness: 50, affection: 0.5, throwQuality: 0.5 }
  expect(playRound({ ...b, favorite: true }, () => 0.5).dog - playRound(b, () => 0.5).dog).toBe(FAVORITE_BONUS)
})

it('Duell: besserer Wurf und mehr Wert zaehlen', () => {
  const s = { value: 50, happiness: 50, affection: 0.5, throwQuality: 0.5 }
  expect(duelScore({ ...s, throwQuality: 1 }, () => 0.5)).toBeGreaterThan(duelScore(s, () => 0.5))
  expect(duelScore({ ...s, value: 60 }, () => 0.5) - duelScore(s, () => 0.5)).toBe(10)
})

describe('catchChance und Laune', () => {
  it('guter Hund mit gutem Wurf faengt fast immer', () => {
    expect(catchChance({ value: 80, gehorsam: 80, happiness: 80, q: 0.9 })).toBeGreaterThan(0.9)
  })
  it('schwacher, ungehorsamer Hund faengt selten', () => {
    expect(catchChance({ value: 5, gehorsam: 5, happiness: 50, q: 0.3 })).toBeLessThan(0.45)
  })
  it('schlechte Laune senkt die Chance', () => {
    const base = { value: 40, gehorsam: 40, q: 0.6 }
    expect(catchChance({ ...base, happiness: 15 })).toBeLessThan(catchChance({ ...base, happiness: 80 }))
  })
  it('Laune: lustlos bei schwachen Werten und Unlust, sonst normal', () => {
    expect(moodOf({ gehorsam: 5, happiness: 20 })).toBe('lustlos')
    expect(moodOf({ gehorsam: 70, happiness: 80 })).toBe('bereit')
  })
})
