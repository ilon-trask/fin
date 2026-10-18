package expo.modules.googlepay

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.security.MessageDigest
import java.util.UUID

class PaymentNotificationListener : NotificationListenerService() {
  companion object {
    const val CHANNEL_ID = "google-pay-payments"
    @Volatile private var connected = WeakReference<PaymentNotificationListener>(null)

    fun isConnected() = connected.get() != null

    fun refresh(context: Context) {
      PaymentTelemetry.capture(context, "refresh_requested")
      if (!PaymentStore.enabled(context)) return
      val listener = connected.get()
      if (listener != null) Handler(Looper.getMainLooper()).post { listener.recoverPayments() }
      else {
        PaymentTelemetry.capture(context, "rebind_requested")
        requestRebind(ComponentName(context, PaymentNotificationListener::class.java))
      }
    }
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    connected = WeakReference(this)
    PaymentTelemetry.capture(this, "listener_connected")
    recoverPayments()
  }

  override fun onListenerDisconnected() {
    connected.clear()
    PaymentTelemetry.capture(this, "listener_disconnected")
    if (PaymentStore.enabled(this)) requestRebind(ComponentName(this, PaymentNotificationListener::class.java))
    super.onListenerDisconnected()
  }

  override fun onDestroy() {
    if (connected.get() === this) connected.clear()
    PaymentTelemetry.capture(this, "listener_destroyed")
    super.onDestroy()
  }

  private fun recoverPayments() {
    if (!PaymentStore.enabled(this)) return
    // Catch alerts posted while Android was reconnecting the listener.
    try {
      val active = activeNotifications.orEmpty()
      PaymentTelemetry.capture(this, "recovery", mapOf("outcome" to "scanned", "candidate_count" to active.count { PaymentSource.isCandidate(it.packageName) }))
      active.forEach { processNotification(it, "recovery") }
    } catch (_: SecurityException) {
      PaymentTelemetry.capture(this, "recovery", mapOf("outcome" to "access_denied"))
    }
    // Permission may have been denied when a payment was first captured.
    PaymentStore.pending(this).filter { !it.optBoolean("notified") }.forEach { postReminder(it) }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) = processNotification(sbn, "posted")

  private fun processNotification(sbn: StatusBarNotification, origin: String) {
    if (!PaymentSource.isCandidate(sbn.packageName)) return
    val trace = mapOf<String, Any>(
      "attempt_id" to UUID.randomUUID().toString(),
      "origin" to origin,
      "notification_posted_at_ms" to sbn.postTime,
      "source_package" to sbn.packageName,
      "has_title" to !sbn.notification.extras.getCharSequence(Notification.EXTRA_TITLE).isNullOrBlank(),
      "has_text" to !sbn.notification.extras.getCharSequence(Notification.EXTRA_TEXT).isNullOrBlank(),
      "has_big_text" to !sbn.notification.extras.getCharSequence(Notification.EXTRA_BIG_TEXT).isNullOrBlank(),
      "has_text_lines" to !sbn.notification.extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES).isNullOrEmpty()
    )
    PaymentTelemetry.capture(this, "notification_received", trace)
    try {
      inspectNotification(sbn, trace)
    } catch (error: Exception) {
      PaymentTelemetry.capture(this, "notification_error", trace + mapOf("exception_type" to error.javaClass.simpleName))
      throw error
    }
  }

  private fun inspectNotification(sbn: StatusBarNotification, trace: Map<String, Any>) {
    fun outcome(value: String, extra: Map<String, Any> = emptyMap()) =
      PaymentTelemetry.capture(this, "notification_processed", trace + mapOf("outcome" to value) + extra)
    if (!PaymentStore.enabled(this)) { outcome("disabled"); return }
    if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) { outcome("group_summary"); return }
    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString("\n").orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    // Expanded content can contain only card details while the collapsed text
    // holds the payment. Keep both, including failure/refund wording in either.
    val description = listOf(title, text, bigText, lines).filter { it.isNotBlank() }.distinct().joinToString("\n")
    if (!PaymentSource.accepts(sbn.packageName, if (Build.VERSION.SDK_INT >= 26) sbn.notification.channelId else null, extras.getCharSequence("android.substName")?.toString().orEmpty(), description)) {
      // Only retain an outcome, never the content of rejected notifications.
      PaymentStore.recordEvent(this, sbn.postTime, "source_filtered")
      outcome("source_filtered")
      return
    }
    val result = PaymentParser.inspect(description)
    val parsed = result.payment ?: run {
      PaymentStore.recordEvent(this, sbn.postTime, result.reason ?: "unrecognized_format")
      outcome(result.reason ?: "unrecognized_format")
      return
    }
    // Stable across notification updates; changed amounts under the same key are distinct.
    val source = "${sbn.key}|${sbn.notification.`when`}|${parsed.first}|${parsed.second}"
    val id = MessageDigest.getInstance("SHA-256").digest(source.toByteArray()).joinToString("") { "%02x".format(it) }
    val payment = JSONObject().put("id", id).put("amount", parsed.first).put("currency", parsed.second)
      .put("date", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date(sbn.postTime))).put("description", description)
    if (PaymentStore.add(this, payment)) {
      PaymentStore.recordEvent(this, sbn.postTime, "payment_saved")
      PaymentStore.recordCapture(this)
      outcome("payment_saved", mapOf("payment_id" to id))
      postReminder(payment, trace)
    } else {
      outcome(if (PaymentStore.hasSeen(this, id)) "duplicate" else "storage_failed", mapOf("payment_id" to id))
      // A repeated alert can also arrive after permission has been restored.
      PaymentStore.pending(this).firstOrNull { it.getString("id") == id && !it.optBoolean("notified") }?.let { postReminder(it, trace) }
    }
  }

  private fun postReminder(payment: JSONObject, trace: Map<String, Any> = emptyMap()) {
    fun outcome(value: String) {
      PaymentStore.recordReminder(this, value)
      PaymentTelemetry.capture(this, "reminder_result", trace + mapOf("payment_id" to payment.getString("id"), "outcome" to value))
    }
    if (!PaymentStore.enabled(this)) return
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      outcome("permission_blocked")
      return
    }
    if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
      outcome("permission_blocked")
      return
    }
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Google Pay payments", NotificationManager.IMPORTANCE_HIGH))
      if (manager.getNotificationChannel(CHANNEL_ID)?.importance == NotificationManager.IMPORTANCE_NONE) {
        outcome("channel_blocked")
        return
      }
    }
    val id = payment.getString("id")
    val intent = packageManager.getLaunchIntentForPackage(packageName) ?: run {
      outcome("launch_unavailable")
      return
    }
    intent.action = Intent.ACTION_VIEW
    intent.data = Uri.parse("finsam://?paymentId=$id")
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val open = PendingIntent.getActivity(this, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_edit)
      .setContentTitle("Google Pay payment saved")
      .setContentText("${payment.getString("currency")} ${payment.getDouble("amount")} · Tap to review and choose a category")
      .setContentIntent(open).addAction(android.R.drawable.ic_input_add, "Review payment", open)
      .setPriority(NotificationCompat.PRIORITY_HIGH).setOnlyAlertOnce(true).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build()
    try {
      manager.notify(id, 1, notification)
      PaymentStore.markNotified(this, id)
      outcome("posted")
    } catch (_: SecurityException) {
      outcome("permission_blocked")
      // Draft remains available and posting can be retried after permission is restored.
    }
  }
}
