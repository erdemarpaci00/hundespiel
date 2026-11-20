import { supabase } from './supabase'
import { keyToBytes, VAPID_PUBLIC_KEY } from './pushKey'

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration('./')) ?? navigator.serviceWorker.register('./sw.js', { scope: './' })
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration('./')
  return (await reg?.pushManager.getSubscription()) && Notification.permission === 'granted' ? 'on' : 'off'
}

// Mitteilungen einschalten: Erlaubnis fragen, beim Push-Dienst anmelden, beim Server speichern.
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if ((await Notification.requestPermission()) !== 'granted') return Notification.permission === 'denied' ? 'blocked' : 'off'
  const reg = await registration()
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }))
  const j = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth })
  if (error) { await sub.unsubscribe(); throw new Error(error.message) }
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('./')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
    await sub.unsubscribe()
  }
  return 'off'
}
