package expo.modules.googlepay

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.os.Build
import android.net.Uri
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GooglePayModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  override fun definition() = ModuleDefinition {
    Name("FinGooglePay")
    Function("getStatus") {
      mapOf("enabled" to PaymentStore.enabled(context),
        "listenerConnected" to PaymentNotificationListener.isConnected(),
        "accessGranted" to (if (Build.VERSION.SDK_INT >= 27)
          context.getSystemService(NotificationManager::class.java).isNotificationListenerAccessGranted(ComponentName(context, PaymentNotificationListener::class.java))
          else NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)),
        "notificationsGranted" to (NotificationManagerCompat.from(context).areNotificationsEnabled() &&
          (Build.VERSION.SDK_INT < 26 || context.getSystemService(NotificationManager::class.java).getNotificationChannel(PaymentNotificationListener.CHANNEL_ID)?.importance != NotificationManager.IMPORTANCE_NONE))) + PaymentStore.diagnostics(context)
    }
    Function("setEnabled") { enabled: Boolean ->
      PaymentStore.setEnabled(context, enabled)
      if (enabled) PaymentNotificationListener.refresh(context)
    }
    Function("refresh") { PaymentNotificationListener.refresh(context) }
    Function("openNotificationSettings") {
      val channel = if (Build.VERSION.SDK_INT >= 26) context.getSystemService(NotificationManager::class.java).getNotificationChannel(PaymentNotificationListener.CHANNEL_ID) else null
      val intent = if (channel != null) Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        .putExtra(Settings.EXTRA_CHANNEL_ID, PaymentNotificationListener.CHANNEL_ID)
      else if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
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
