import type Phaser from 'phaser'

// Szenenwechsel mit kurzem Ausblenden; die neue Szene blendet in create() per fadeIn ein.
export function fadeTo(scene: Phaser.Scene, key: string, data?: object): void {
  const cam = scene.cameras.main
  let went = false
  const go = (): void => { if (went) return; went = true; scene.scene.start(key, data) }
  cam.once('camerafadeoutcomplete', go)
  cam.fadeOut(220, 0, 0, 0)
  scene.time.delayedCall(500, go)
}
