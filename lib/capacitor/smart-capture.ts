'use client'

import { isAndroidNative } from '@/lib/capacitor/platform'
import { SarathyNotifications } from '@/lib/capacitor/sarathy-notifications'

export const SMART_CAPTURE_PROMPTED_KEY = 'smart_capture_prompted'
export const SMART_CAPTURE_ENABLED_KEY = 'smart_capture_enabled'

export function hasSmartCaptureBeenPrompted(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(SMART_CAPTURE_PROMPTED_KEY) === 'true'
  } catch {
    return true
  }
}

export function markSmartCapturePrompted(): void {
  try {
    localStorage.setItem(SMART_CAPTURE_PROMPTED_KEY, 'true')
  } catch {
    // ignore quota / private mode
  }
}

export function setSmartCaptureEnabledFlag(enabled: boolean): void {
  try {
    localStorage.setItem(SMART_CAPTURE_ENABLED_KEY, enabled ? 'true' : 'false')
  } catch {
    // ignore
  }
}

/** Show the one-time Smart Capture screen (Android Capacitor only). */
export function shouldShowSmartCapturePrompt(): boolean {
  return isAndroidNative() && !hasSmartCaptureBeenPrompted()
}

export async function openSmartCaptureSettings(): Promise<void> {
  if (!isAndroidNative()) return
  await SarathyNotifications.openNotificationListenerSettings()
}

export async function isSmartCaptureEnabled(): Promise<boolean> {
  if (!isAndroidNative()) return false
  try {
    const { enabled } = await SarathyNotifications.isNotificationListenerEnabled()
    if (enabled) setSmartCaptureEnabledFlag(true)
    return enabled
  } catch {
    return false
  }
}
