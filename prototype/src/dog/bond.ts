// Freundschaft zwischen zwei Hunden waechst mit gezaehlten Begegnungen.
export function bondLevel(meetings: number): 0 | 1 | 2 | 3 {
  return meetings >= 15 ? 3 : meetings >= 5 ? 2 : meetings >= 2 ? 1 : 0
}

const LABEL = ['kennen sich kaum', 'Bekannte', 'Freunde', 'beste Freunde'] as const

export function bondLabel(meetings: number): string {
  return LABEL[bondLevel(meetings)]
}
