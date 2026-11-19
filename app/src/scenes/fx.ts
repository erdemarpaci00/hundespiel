import Phaser from 'phaser'

type Kind = 'star' | 'heart' | 'dust'

function ensureTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('fx-star')) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  g.fillStyle(0xffffff, 1).fillTriangle(6, 0, 8, 6, 4, 6).fillTriangle(6, 12, 8, 6, 4, 6).fillTriangle(0, 6, 6, 4, 6, 8).fillTriangle(12, 6, 6, 4, 6, 8)
  g.generateTexture('fx-star', 12, 12)
  g.clear().fillStyle(0xffffff, 1).fillCircle(4, 4, 4).fillCircle(9, 4, 4).fillTriangle(0, 6, 13, 6, 6.5, 14)
  g.generateTexture('fx-heart', 13, 14)
  g.clear().fillStyle(0xffffff, 1).fillCircle(5, 5, 5)
  g.generateTexture('fx-dust', 10, 10)
  g.destroy()
}

// Einmaliger Partikel-Ausbruch: Funken, Herzen oder Staubwolke. Der Emitter raeumt sich selbst auf.
export function burst(scene: Phaser.Scene, x: number, y: number, kind: Kind, count = 8): void {
  ensureTextures(scene)
  const cfg: Record<Kind, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> = {
    star: { speed: { min: 20, max: 60 }, angle: { min: 200, max: 340 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 700, gravityY: 30, tint: [0xfff6a8, 0xffffff, 0xffd84a], rotate: { start: 0, end: 180 } },
    heart: { speed: { min: 10, max: 30 }, angle: { min: 240, max: 300 }, scale: { start: 0.9, end: 0.4 }, alpha: { start: 1, end: 0 }, lifespan: 1000, gravityY: -20, tint: [0xe0527a, 0xff7aa2] },
    dust: { speed: { min: 8, max: 35 }, angle: { min: 180, max: 360 }, scale: { start: 0.7, end: 1.4 }, alpha: { start: 0.45, end: 0 }, lifespan: 600, tint: 0xd9c58e },
  }
  const em = scene.add.particles(x, y, `fx-${kind}`, { ...cfg[kind], emitting: false }).setDepth(3002)
  em.explode(count)
  scene.time.delayedCall(1400, () => em.destroy())
}
