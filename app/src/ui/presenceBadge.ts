// Kleines Abzeichen unter den Münzen: zeigt, wer vom Haushalt gerade auch im Garten ist.
export function createPresenceBadge(): { show(names: string[]): void; destroy(): void } {
  const el = document.createElement('div')
  el.id = 'presence'
  el.style.cssText = 'position:absolute;right:calc(8px + env(safe-area-inset-right));top:calc(46px + env(safe-area-inset-top));display:none;align-items:center;gap:6px;background:rgba(255,255,255,.9);border-radius:14px;padding:5px 10px;box-shadow:0 2px 8px rgba(0,0,0,.2);font:700 12px Arial,Helvetica,sans-serif;color:#2b2b2b'
  const dot = document.createElement('span')
  dot.style.cssText = 'width:9px;height:9px;border-radius:5px;background:#3fb950'
  const text = document.createElement('span')
  el.append(dot, text)
  ;(document.getElementById('hud') ?? document.body).appendChild(el)
  return {
    show(names) {
      el.style.display = names.length > 0 ? 'flex' : 'none'
      text.textContent = names.length === 0 ? '' : names.length === 1 ? `${names[0]} ist auch da` : `${names.join(' und ')} sind auch da`
    },
    destroy() { el.remove() },
  }
}
