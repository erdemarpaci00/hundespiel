export interface Place {
  key: string
  label: string
}

// Alle Orte, die man ueber die Karte besuchen kann.
export const PLACES: Place[] = [
  { key: 'garden', label: 'Garten' },
  { key: 'walk', label: 'Spaziergang' },
  { key: 'shop', label: 'Laden' },
  { key: 'kennel', label: 'Hundeheim' },
  { key: 'training', label: 'Training' },
]
