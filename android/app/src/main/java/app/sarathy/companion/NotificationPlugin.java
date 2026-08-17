package app.sarathy.companion;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.provider.Settings;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * Bridges {@link SarathyNotificationService} broadcasts into the Capacitor WebView
 * as {@code sarathy-payment-detected} CustomEvents (and Capacitor listeners).
 */
@CapacitorPlugin(name = "SarathyNotifications")
public class NotificationPlugin extends Plugin {

  public static final String ACTION_PAYMENT_DETECTED = "app.sarathy.PAYMENT_DETECTED";

  private BroadcastReceiver paymentReceiver;

  @Override
  public void load() {
    super.load();
    paymentReceiver =
      new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
          if (intent == null || !ACTION_PAYMENT_DETECTED.equals(intent.getAction())) {
            return;
          }
          String text = intent.getStringExtra("text");
          String pkg = intent.getStringExtra("package");
          long timestamp = intent.getLongExtra("timestamp", System.currentTimeMillis());
          if (text == null || text.trim().isEmpty()) return;

          JSObject data = new JSObject();
          data.put("text", text);
          data.put("package", pkg != null ? pkg : "");
          data.put("timestamp", timestamp);
          notifyListeners("paymentDetected", data);

          dispatchWebEvent(text, pkg, timestamp);
        }
      };

    IntentFilter filter = new IntentFilter(ACTION_PAYMENT_DETECTED);
    Context ctx = getContext();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ctx.registerReceiver(paymentReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    } else {
      ctx.registerReceiver(paymentReceiver, filter);
    }
  }

  private void dispatchWebEvent(String text, String pkg, long timestamp) {
    final String js =
      "window.dispatchEvent(new CustomEvent('sarathy-payment-detected',{detail:{"
          + "text:"
          + JSONObject.quote(text)
          + ",package:"
          + JSONObject.quote(pkg != null ? pkg : "")
          + ",timestamp:"
          + timestamp
          + "}}));";

    bridge
      .getActivity()
      .runOnUiThread(
        () -> {
          WebView webView = bridge.getWebView();
          if (webView != null) {
            webView.evaluateJavascript(js, null);
          }
        });
  }

  @PluginMethod
  public void echo(PluginCall call) {
    String value = call.getString("value", "");
    JSObject ret = new JSObject();
    ret.put("value", value);
    call.resolve(ret);
  }

  /** Opens system Notification Listener access settings. */
  @PluginMethod
  public void openNotificationListenerSettings(PluginCall call) {
    try {
      Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
      getActivity().startActivity(intent);
      call.resolve();
    } catch (Exception e) {
      call.reject("Could not open notification listener settings", e);
    }
  }

  /** Whether Sarathy's NotificationListenerService is enabled in system settings. */
  @PluginMethod
  public void isNotificationListenerEnabled(PluginCall call) {
    Context ctx = getContext();
    String pkg = ctx.getPackageName();
    String flat =
      Settings.Secure.getString(ctx.getContentResolver(), "enabled_notification_listeners");
    boolean enabled = flat != null && flat.contains(pkg);
    JSObject ret = new JSObject();
    ret.put("enabled", enabled);
    call.resolve(ret);
  }

  @Override
  protected void handleOnDestroy() {
    if (paymentReceiver != null) {
      try {
        getContext().unregisterReceiver(paymentReceiver);
      } catch (IllegalArgumentException ignored) {
        // already unregistered
      }
      paymentReceiver = null;
    }
    super.handleOnDestroy();
  }
}
