// Schmales Band oben, solange das Geraet kein Netz hat. Spielstand liegt auf dem Server, ohne Netz geht nichts verloren, aber auch nichts durch.
export function watchOnline(): void {
  const bar = document.createElement('div')
  bar.id = 'offline'
  bar.textContent = 'Keine Verbindung. Aktionen werden erst mit Netz gespeichert.'
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:6px 12px calc(6px + env(safe-area-inset-bottom));background:#b3261e;color:#fff;font:600 13px Arial,sans-serif;text-align:center;display:none;pointer-events:none'
  document.body.appendChild(bar)
  const sync = (): void => { bar.style.display = navigator.onLine ? 'none' : 'block' }
  window.addEventListener('online', sync)
  window.addEventListener('offline', sync)
  sync()
}
