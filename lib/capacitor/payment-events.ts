'use client'

/**
 * Typed helpers for Android NotificationListener → web bridge events.
 * Dispatched by NotificationPlugin as `sarathy-payment-detected`.
 */

export type SarathyPaymentDetectedDetail = {
  text: string
  package?: string
  timestamp?: number
}

export type SarathyPaymentDetectedEvent = CustomEvent<SarathyPaymentDetectedDetail>

export const SARATHY_PAYMENT_EVENT = 'sarathy-payment-detected'

export function isSarathyPaymentEvent(e: Event): e is SarathyPaymentDetectedEvent {
  return e.type === SARATHY_PAYMENT_EVENT
}
