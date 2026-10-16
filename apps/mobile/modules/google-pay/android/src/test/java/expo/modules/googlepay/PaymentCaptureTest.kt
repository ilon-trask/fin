package expo.modules.googlepay

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ResolveInfo
import android.os.Process
import android.os.Build
import android.service.notification.StatusBarNotification
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowNotificationListenerService

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class PaymentCaptureTest {
  private lateinit var listener: PaymentNotificationListener
  private lateinit var manager: NotificationManager

  @Before fun setup() {
    listener = Robolectric.buildService(PaymentNotificationListener::class.java).create().get()
    manager = listener.getSystemService(NotificationManager::class.java)
    listener.getSharedPreferences("google_pay", Context.MODE_PRIVATE).edit().clear().commit()
    PaymentStore.setEnabled(listener, true)
    shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    val launch = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_INFO).setPackage(listener.packageName)
    val resolved = ResolveInfo().apply {
      activityInfo = ActivityInfo().apply { packageName = listener.packageName; name = "MainActivity" }
    }
    shadowOf(listener.packageManager).addResolveInfoForIntent(launch, resolved)
  }

  private fun alert(id: Int = 1, packageName: String = "com.google.android.gms", channel: String = "wallet", lines: Boolean = false): StatusBarNotification {
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(listener, channel) else Notification.Builder(listener)
    val notification = builder.setSmallIcon(android.R.drawable.ic_menu_edit)
      .setContentTitle("Google Wallet").setWhen(1700000000000L).build()
    if (lines) notification.extras.putCharSequenceArray(Notification.EXTRA_TEXT_LINES, arrayOf("You paid €12.50 at Cafe"))
    else notification.extras.putCharSequence(Notification.EXTRA_TEXT, "You paid €12.50 at Cafe")
    return StatusBarNotification(packageName, packageName, id, null, 1000, 0, 0, notification, Process.myUserHandle(), 1700000000000L)
  }

  @Test fun capturesPlayServicesPaymentAndPostsOneReminder() {
    listener.onNotificationPosted(alert())
    listener.onNotificationPosted(alert())
    val payment = PaymentStore.pending(listener).single()
    assertEquals(12.50, payment.getDouble("amount"), 0.0)
    assertEquals("EUR", payment.getString("currency"))
    assertTrue(payment.getBoolean("notified"))
    assertEquals(1, shadowOf(manager).allNotifications.size)
    val notification = shadowOf(manager).allNotifications.single()
    assertEquals("Google Pay payment saved", notification.extras.getString(Notification.EXTRA_TITLE))
    assertEquals(payment.getString("id"), shadowOf(notification.contentIntent).savedIntent.data?.getQueryParameter("paymentId"))
  }

  @Test @Config(sdk = [25]) fun capturesPaymentBeforeNotificationChannelsWereIntroduced() {
    listener.onNotificationPosted(alert(packageName = "com.google.android.apps.walletnfcrel"))
    assertEquals(1, PaymentStore.pending(listener).size)
    assertEquals(1, shadowOf(manager).allNotifications.size)
  }

  @Test fun savesWithoutNotificationPermissionAndRetriesOnReconnect() {
    shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(Manifest.permission.POST_NOTIFICATIONS)
    listener.onNotificationPosted(alert())
    assertEquals(1, PaymentStore.pending(listener).size)
    assertTrue(shadowOf(manager).allNotifications.isEmpty())
    shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    listener.onListenerConnected()
    assertEquals(1, shadowOf(manager).allNotifications.size)
    assertTrue(PaymentStore.pending(listener).single().getBoolean("notified"))
    listener.onListenerDisconnected()
  }

  @Test fun recoversAlertsPostedWhileDisconnectedAndRetainsDraftAcrossServiceRestart() {
    shadowOf(listener).addActiveNotification(alert())
    listener.onListenerConnected()
    assertEquals(1, PaymentStore.pending(listener).size)
    assertEquals(1, shadowOf(manager).allNotifications.size)
    val rebinds = ShadowNotificationListenerService.getRebindRequestCount()
    listener.onListenerDisconnected()
    assertEquals(rebinds + 1, ShadowNotificationListenerService.getRebindRequestCount())
    listener.onDestroy()
    val restarted = Robolectric.buildService(PaymentNotificationListener::class.java).create().get()
    assertEquals(1, PaymentStore.pending(restarted).size)
    restarted.onNotificationPosted(alert())
    assertEquals(1, PaymentStore.pending(restarted).size)
  }

  @Test fun keepsDraftWhenPaymentNotificationChannelIsBlocked() {
    manager.createNotificationChannel(NotificationChannel(PaymentNotificationListener.CHANNEL_ID, "Payments", NotificationManager.IMPORTANCE_NONE))
    listener.onNotificationPosted(alert())
    assertEquals(1, PaymentStore.pending(listener).size)
    assertFalse(PaymentStore.pending(listener).single().optBoolean("notified"))
    assertTrue(shadowOf(manager).allNotifications.isEmpty())
  }

  @Test fun readsInboxStyleAndIgnoresOtherApps() {
    listener.onNotificationPosted(alert(packageName = "com.example.bank"))
    assertTrue(PaymentStore.pending(listener).isEmpty())
    listener.onNotificationPosted(alert(lines = true))
    assertEquals(1, PaymentStore.pending(listener).size)
  }

  @Test fun keepsDraftsWhenDisabledAndBeyondOldQueueLimit() {
    repeat(105) { index ->
      assertTrue(PaymentStore.add(listener, JSONObject().put("id", "payment-$index")))
    }
    PaymentStore.setEnabled(listener, false)
    assertEquals(105, PaymentStore.pending(listener).size)
    assertFalse(PaymentStore.add(listener, JSONObject().put("id", "disabled")))
    PaymentStore.setEnabled(listener, true)
    PaymentStore.remove(listener, "payment-0")
    assertFalse(PaymentStore.add(listener, JSONObject().put("id", "payment-0")))
    assertEquals(104, PaymentStore.pending(listener).size)
  }
}
