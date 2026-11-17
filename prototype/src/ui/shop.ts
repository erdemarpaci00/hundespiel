import { buyItem, loadEconomy, SHOP, type Economy } from '../economy'

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
      btn.textContent = `${it.label} (${have}) kaufen, ${it.price} Münzen`
      btn.disabled = e.coins < it.price || (it.single && have >= 1)
      btn.addEventListener('click', async () => {
        btn.disabled = true
        try { render(await buyItem(it.item)) } catch (err) { head.textContent = err instanceof Error ? err.message : 'Fehler' }
      })
      shop.appendChild(btn)
    }
  }
  loadEconomy().then(render, () => { shop.textContent = 'Keine Verbindung, bitte Netz prüfen' })
  return shop
}
