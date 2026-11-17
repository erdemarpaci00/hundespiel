import { expect, test } from 'vitest'
import { DOG_REACH_PX, GARDEN_BOUNDS, SCENE_WIDTH } from '../src/garden'
import { SIZE_MAX } from '../src/dog/look'

test('auch der größte Hund bleibt mit Kopf und Schwanz im Bild, am linken und am rechten Rand', () => {
  const reach = DOG_REACH_PX * SIZE_MAX
  expect(GARDEN_BOUNDS.x - reach).toBeGreaterThanOrEqual(0)
  expect(GARDEN_BOUNDS.x + GARDEN_BOUNDS.w + reach).toBeLessThanOrEqual(SCENE_WIDTH)
})
