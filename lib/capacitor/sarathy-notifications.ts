'use client'

import { registerPlugin } from '@capacitor/core'

export interface SarathyNotificationsPlugin {
  openNotificationListenerSettings(): Promise<void>
  isNotificationListenerEnabled(): Promise<{ enabled: boolean }>
  echo(options: { value: string }): Promise<{ value: string }>
}

export const SarathyNotifications =
  registerPlugin<SarathyNotificationsPlugin>('SarathyNotifications')
