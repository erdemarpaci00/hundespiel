import { describe, expect, it } from 'vitest'
import { othersFrom } from '../src/presence'

describe('Anwesenheit', () => {
  it('ich selbst zaehle nicht, die anderen kommen sortiert', () => {
    const state = { me: [{ name: 'Erdem' }], b: [{ name: 'Zeynep' }], c: [{ name: 'Anna' }] }
    expect(othersFrom(state, 'me')).toEqual(['Anna', 'Zeynep'])
  })
  it('niemand sonst da', () => {
    expect(othersFrom({ me: [{ name: 'Erdem' }] }, 'me')).toEqual([])
  })
  it('ohne Namen heisst es Jemand', () => {
    expect(othersFrom({ x: [{}] }, 'me')).toEqual(['Jemand'])
  })
})
