package app.sarathy.companion;

import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Reads payment-related notifications from allowlisted apps only
 * and broadcasts them to {@link NotificationPlugin} for the web layer.
 */
public class SarathyNotificationService extends NotificationListenerService {

  // ONLY read from these apps
  private static final String[] ALLOWED = {
    "com.grabtaxi.passenger", // Grab
    "com.foodpanda.android", // Foodpanda
    "com.dbs.dbspaylah", // DBS PayLah
    "com.dbs.mbanking.sg", // DBS digibank
    "com.ocbc.ocbc", // OCBC (may vary by build)
    "com.ocbc.mobile", // OCBC mobile (common package)
    "com.uob.uob", // UOB (may vary by build)
    "com.uob.mighty.app", // UOB TMRW / Mighty
    "com.wise.transferwise", // Wise
    "com.transferwise.android", // Wise alternate
    "com.shopee.sg" // Shopee
  };

  @Override
  public void onNotificationPosted(StatusBarNotification sbn) {
    if (sbn == null || sbn.getNotification() == null) return;

    String pkg = sbn.getPackageName();
    if (pkg == null) return;

    boolean allowed = false;
    for (String a : ALLOWED) {
      if (pkg.equals(a)) {
        allowed = true;
        break;
      }
    }
    if (!allowed) return;

    Bundle extras = sbn.getNotification().extras;
    if (extras == null) return;

    String title = extras.getString("android.title", "");
    CharSequence textCs = extras.getCharSequence("android.text");
    String text = textCs != null ? textCs.toString() : extras.getString("android.text", "");
    CharSequence bigCs = extras.getCharSequence("android.bigText");
    String bigText = bigCs != null ? bigCs.toString() : "";

    if (title == null) title = "";
    if (text == null) text = "";
    if (bigText == null) bigText = "";

    String full = (title + " " + text + " " + bigText).trim();
    if (full.isEmpty()) return;

    String lower = full.toLowerCase();
    // Only process if it looks like a payment
    if (!full.contains("$")
        && !full.contains("₹")
        && !lower.contains("paid")
        && !lower.contains("deducted")
        && !lower.contains("transfer")
        && !lower.contains("sent")
        && !lower.contains("debited")
        && !lower.contains("spent")) {
      return;
    }

    Intent intent = new Intent("app.sarathy.PAYMENT_DETECTED");
    intent.setPackage(getPackageName());
    intent.putExtra("text", full);
    intent.putExtra("package", pkg);
    intent.putExtra("timestamp", System.currentTimeMillis());
    sendBroadcast(intent);
  }
}
