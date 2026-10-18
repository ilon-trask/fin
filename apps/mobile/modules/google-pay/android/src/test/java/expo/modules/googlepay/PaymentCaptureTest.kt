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
import org.junit.After
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

  @After fun teardown() { listener.onDestroy() }

  private fun alert(id: Int = 1, packageName: String = "com.google.android.gms", channel: String = "wallet", lines: Boolean = false, title: String = "Google Wallet", text: String = "You paid €12.50 at Cafe"): StatusBarNotification {
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(listener, channel) else Notification.Builder(listener)
    val notification = builder.setSmallIcon(android.R.drawable.ic_menu_edit)
      .setContentTitle(title).setWhen(1700000000000L).build()
    if (lines) notification.extras.putCharSequenceArray(Notification.EXTRA_TEXT_LINES, arrayOf(text))
    else notification.extras.putCharSequence(Notification.EXTRA_TEXT, text)
    return StatusBarNotification(packageName, packageName, id, null, 1000, 0, 0, notification, Process.myUserHandle(), 1700000000000L)
  }

  @Test fun keepsPaymentTextWhenExpandedTextContainsOnlyCardDetails() {
    val notification = alert(title = "Cafe", text = "You paid €12.50")
    notification.notification.extras.putCharSequence(Notification.EXTRA_BIG_TEXT, "Visa •••• 1234")
    listener.onNotificationPosted(notification)
    assertEquals(12.5, PaymentStore.pending(listener).single().getDouble("amount"), 0.0)
    assertEquals(1, shadowOf(manager).allNotifications.size)
  }

  @Test fun checksExpandedTextForFailureInsteadOfCapturingCollapsedPayment() {
    val notification = alert()
    notification.notification.extras.putCharSequence(Notification.EXTRA_BIG_TEXT, "Payment declined")
    listener.onNotificationPosted(notification)
    assertTrue(PaymentStore.pending(listener).isEmpty())
    assertEquals("non_payment", PaymentStore.diagnostics(listener)["lastOutcome"])
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

  @Test fun capturesMerchantLayoutFromUnbrandedPlayServicesChannel() {
    listener.onNotificationPosted(alert(channel = "payments", title = "Shop-24", text = "CHF 12.50"))
    val payment = PaymentStore.pending(listener).single()
    assertEquals("CHF", payment.getString("currency"))
    assertEquals(12.5, payment.getDouble("amount"), 0.0)
    assertEquals("payment_saved", PaymentStore.diagnostics(listener)["lastOutcome"])
    assertEquals("posted", PaymentStore.diagnostics(listener)["lastReminderOutcome"])
    assertNotNull(PaymentStore.diagnostics(listener)["lastCapturedAt"])
  }

  @Test fun capturesSameAmountInDifferentTitleAndBody() {
    listener.onNotificationPosted(alert(title = "You paid €12.50", text = "Payment amount €12.50 at Cafe"))
    assertEquals(1, PaymentStore.pending(listener).size)
    assertEquals(1, shadowOf(manager).allNotifications.size)
  }

  @Test fun diagnosticsExplainRejectedAlertsWithoutRetainingTheirContents() {
    listener.onNotificationPosted(alert(channel = "play_store", title = "Google Play"))
    assertEquals("source_filtered", PaymentStore.diagnostics(listener)["lastOutcome"])
    listener.onNotificationPosted(alert(text = "You paid €12.50 total €15.00"))
    assertEquals("ambiguous_amount", PaymentStore.diagnostics(listener)["lastOutcome"])
    assertTrue(PaymentStore.pending(listener).isEmpty())
    assertFalse(listener.getSharedPreferences("google_pay", Context.MODE_PRIVATE).all.values.any { it.toString().contains("15.00") })
    listener.onNotificationPosted(alert(packageName = "com.example.bank"))
    assertEquals("ambiguous_amount", PaymentStore.diagnostics(listener)["lastOutcome"])
  }

  @Test fun duplicateRetriesReminderAfterPermissionRestored() {
    shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(Manifest.permission.POST_NOTIFICATIONS)
    listener.onNotificationPosted(alert())
    assertEquals("permission_blocked", PaymentStore.diagnostics(listener)["lastReminderOutcome"])
    shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    listener.onNotificationPosted(alert())
    assertEquals("posted", PaymentStore.diagnostics(listener)["lastReminderOutcome"])
    assertEquals(1, PaymentStore.pending(listener).size)
    assertEquals(1, shadowOf(manager).allNotifications.size)
  }

  @Test fun connectionStatusTracksActualListenerLifecycle() {
    assertFalse(PaymentNotificationListener.isConnected())
    listener.onListenerConnected()
    assertTrue(PaymentNotificationListener.isConnected())
    listener.onListenerDisconnected()
    assertFalse(PaymentNotificationListener.isConnected())
    listener.onListenerConnected()
    listener.onDestroy()
    assertFalse(PaymentNotificationListener.isConnected())
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
