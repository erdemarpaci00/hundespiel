// Echtzeit-Altern: ein Tag in der Wirklichkeit ist ein Hundetag im Spiel.
export interface AgeStage { name: string; scale: number }

export function ageDays(bornMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - bornMs) / 86_400_000))
}

export function ageStage(days: number): AgeStage {
  if (days < 3) return { name: 'Welpe', scale: 0.62 }
  if (days < 10) return { name: 'Junghund', scale: 0.82 }
  if (days < 100) return { name: 'Erwachsen', scale: 1 }
  return { name: 'Senior', scale: 0.98 }
}

export function ageLabel(days: number): string {
  return `${ageStage(days).name}, ${days} ${days === 1 ? 'Tag' : 'Tage'} alt`
}
