import { friendlyError } from './errors'
import { supabase } from './supabase'

export type Item = 'futter' | 'leckerli' | 'ball' | 'buerste'
export interface Economy {
  coins: number
  home?: number
  items: Partial<Record<Item, number>>
}

export const SHOP: { item: Item; label: string; price: number; single: boolean }[] = [
  { item: 'futter', label: 'Futter', price: 5, single: false },
  { item: 'leckerli', label: 'Leckerli', price: 3, single: false },
  { item: 'ball', label: 'Ball', price: 12, single: true },
  { item: 'buerste', label: 'Bürste', price: 15, single: true },
]

function unwrap(data: unknown, error: { message?: string } | null): Economy {
  if (error) throw new Error(friendlyError(error.message))
  return data as Economy
}

export async function loadEconomy(): Promise<Economy> {
  const { data, error } = await supabase.rpc('my_economy')
  return unwrap(data, error)
}

export const HOME_UPGRADES = [
  { label: 'Weiche Decke im Garten', price: 80 },
  { label: 'Blumenbeet', price: 200 },
  { label: 'Teich', price: 500 },
]

export async function upgradeHome(): Promise<Economy> {
  const { data, error } = await supabase.rpc('upgrade_home')
  return unwrap(data, error)
}

export async function buyItem(item: Item): Promise<Economy> {
  const { data, error } = await supabase.rpc('buy_item', { p_item: item, p_qty: 1 })
  return unwrap(data, error)
}
