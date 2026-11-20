// Oeffentlicher Schluessel fuer Handy-Mitteilungen (VAPID). Der private Teil liegt nur als Geheimnis bei Supabase.
export const VAPID_PUBLIC_KEY = 'BJddTiE14JKGjUQd2pt5MUFP_03-dHa9_We1XRI44N-9PKvLT5SQqEFtXyMcyUvhBYAxX_TNCsyXHyYPdsTykOo'

// base64url (wie ihn der Browser fuer applicationServerKey erwartet) in Bytes umwandeln.
export function keyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const b64 = key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (key.length % 4)) % 4)
  const raw = atob(b64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
