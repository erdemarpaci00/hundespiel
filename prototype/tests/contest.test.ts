import { describe, expect, it } from 'vitest'
import { average, eligible, LEAGUES, runContest } from '../src/dog/contest'

const stats = (v: number) => ({ tempo: v, ausdauer: v, sprungkraft: v, gehorsam: v })
const fixed = (x: number) => () => x

describe('contest', () => {
  it('Liga-Zulassung nach Durchschnitt', () => {
    expect(eligible(LEAGUES[0], stats(0))).toBe(true)
    expect(eligible(LEAGUES[3], stats(60))).toBe(false)
    expect(eligible(LEAGUES[3], stats(70))).toBe(true)
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
