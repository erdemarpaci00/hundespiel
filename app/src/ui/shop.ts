import { buyItem, HOME_UPGRADES, loadEconomy, SHOP, upgradeHome, type Economy } from '../economy'

// Zwei feste Zeilen pro Knopf: Name oben, Preis unten, damit alle gleich hoch sind.
function two(btn: HTMLElement, top: string, bottom: string): void {
  const a = document.createElement('span')
  a.textContent = top
  const b = document.createElement('small')
  b.textContent = bottom
  b.style.cssText = 'display:block;font-weight:normal;opacity:.9;margin-top:2px'
  btn.replaceChildren(a, b)
}

// Muenzen und Kauf-Knoepfe als Block, im Laden und in den Einstellungen verwendbar.
export function buildShop(): HTMLElement {
  const shop = document.createElement('div')
  shop.className = 'verlauf shop'
  shop.textContent = 'Laden …'
  const render = (e: Economy): void => {
    shop.replaceChildren()
    const head = document.createElement('div')
    head.textContent = `Münzen: ${e.coins}`
    shop.appendChild(head)
    for (const it of SHOP) {
      const have = e.items[it.item] ?? 0
      const btn = document.createElement('button')
      btn.className = 'alt'
      two(btn, `${it.label} (${have})`, `${it.price} Münzen`)
      btn.disabled = e.coins < it.price || (it.single && have >= 1)
      btn.addEventListener('click', async () => {
        btn.disabled = true
        try { render(await buyItem(it.item)) } catch (err) { head.textContent = err instanceof Error ? err.message : 'Fehler' }
      })
      shop.appendChild(btn)
    }
    const lvl = e.home ?? 0
    const up = HOME_UPGRADES[lvl]
    const hb = document.createElement('button')
    hb.className = 'alt'
    if (up) two(hb, `Garten ausbauen: ${up.label}`, `${up.price} Münzen`)
    else hb.textContent = 'Der Garten ist ganz ausgebaut'
    hb.style.gridColumn = '1 / -1'
    hb.disabled = !up || e.coins < up.price
    hb.addEventListener('click', async () => {
      hb.disabled = true
      try { render(await upgradeHome()) } catch (err) { head.textContent = err instanceof Error ? err.message : 'Fehler' }
    })
    shop.appendChild(hb)
  }
  loadEconomy().then(render, () => { shop.textContent = 'Keine Verbindung, bitte Netz prüfen' })
  return shop
}
