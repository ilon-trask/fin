package expo.modules.googlepay

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GooglePayModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  override fun definition() = ModuleDefinition {
    Name("FinGooglePay")
    Function("getStatus") {
      mapOf("enabled" to PaymentStore.enabled(context),
        "accessGranted" to NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName),
        "notificationsGranted" to NotificationManagerCompat.from(context).areNotificationsEnabled())
    }
    Function("setEnabled") { enabled: Boolean -> PaymentStore.setEnabled(context, enabled) }
    Function("getPending") { PaymentStore.pending(context).map { it.toString() } }
    Function("dismiss") { id: String -> PaymentStore.remove(context, id) }
    Function("openAccessSettings") {
      val intent = if (android.os.Build.VERSION.SDK_INT >= 30) {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, ComponentName(context, PaymentNotificationListener::class.java).flattenToString())
      } else Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
