package expo.modules.googlepay

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.posthog.PostHog
import com.posthog.PersonProfiles
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig

/** Native diagnostics also work when Android starts the listener without React Native. */
internal object PaymentTelemetry {
  private var initialized = false
  internal var transport: (Context, String, Map<String, Any>) -> Unit = ::send

  fun accessGranted(context: Context): Boolean = if (Build.VERSION.SDK_INT >= 27)
    context.getSystemService(NotificationManager::class.java).isNotificationListenerAccessGranted(ComponentName(context, PaymentNotificationListener::class.java))
    else NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)

  fun capture(context: Context, stage: String, properties: Map<String, Any> = emptyMap()) {
    // Instrumentation must never prevent a payment from being captured or a reminder posted.
    try {
      transport(context.applicationContext, "google_pay_$stage", mapOf(
        "diagnostics_version" to 1,
        "build_type" to BuildConfig.BUILD_TYPE,
        "occurred_at_ms" to System.currentTimeMillis(),
        "enabled" to PaymentStore.enabled(context),
        "listener_connected" to PaymentNotificationListener.isConnected(),
        "access_granted" to accessGranted(context),
        "notifications_granted" to NotificationManagerCompat.from(context).areNotificationsEnabled(),
        "channel_blocked" to (Build.VERSION.SDK_INT >= 26 && context.getSystemService(NotificationManager::class.java)
          .getNotificationChannel(PaymentNotificationListener.CHANNEL_ID)?.importance == NotificationManager.IMPORTANCE_NONE),
        "android_sdk" to Build.VERSION.SDK_INT
      ) + properties)
    } catch (_: Exception) {
      Log.w("FinGooglePay", "Could not record payment diagnostic")
    }
  }

  @Synchronized private fun send(context: Context, event: String, properties: Map<String, Any>) {
    if (BuildConfig.POSTHOG_PROJECT_TOKEN.isBlank()) return
    if (!initialized) {
      val config = PostHogAndroidConfig(BuildConfig.POSTHOG_PROJECT_TOKEN, BuildConfig.POSTHOG_HOST).apply {
        captureApplicationLifecycleEvents = false
        captureScreenViews = false
        captureDeepLinks = false
        preloadFeatureFlags = false
        personProfiles = PersonProfiles.NEVER
        sessionReplay = false
        errorTrackingConfig.autoCapture = false
        flushAt = 1
      }
      PostHogAndroid.setup(context, config)
      initialized = true
    }
    PostHog.capture(event = event, properties = properties)
  }
}
