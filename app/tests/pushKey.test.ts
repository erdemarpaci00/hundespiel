import { describe, expect, it } from 'vitest'
import { keyToBytes, VAPID_PUBLIC_KEY } from '../src/pushKey'

describe('keyToBytes', () => {
  it('wandelt base64url in Bytes um (auch mit - und _)', () => {
    expect(Array.from(keyToBytes('AQID'))).toEqual([1, 2, 3])
    expect(Array.from(keyToBytes('-_8'))).toEqual([251, 255])
  })
  it('der oeffentliche Schluessel ist ein unkomprimierter P-256-Punkt (65 Bytes, beginnt mit 4)', () => {
    const b = keyToBytes(VAPID_PUBLIC_KEY)
    expect(b).toHaveLength(65)
    expect(b[0]).toBe(4)
  })
})
