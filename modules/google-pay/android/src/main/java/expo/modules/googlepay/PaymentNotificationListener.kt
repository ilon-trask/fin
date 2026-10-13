package expo.modules.googlepay

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.security.MessageDigest

class PaymentNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (!PaymentStore.enabled(this)) return
    if (sbn.packageName !in setOf("com.google.android.apps.walletnfcrel", "com.google.android.apps.nbu.paisa.user", "com.google.android.apps.nbu.paisa.user.integration")) return
    if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
    val parsed = PaymentParser.parse("$title $body") ?: return
    // Stable across notification updates; changed amounts under the same key are distinct.
    val source = "${sbn.key}|${sbn.notification.`when`}|${parsed.first}|${parsed.second}"
    val id = MessageDigest.getInstance("SHA-256").digest(source.toByteArray()).joinToString("") { "%02x".format(it) }
    val payment = JSONObject().put("id", id).put("amount", parsed.first).put("currency", parsed.second)
      .put("date", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date(sbn.postTime))).put("description", "$title\n$body".trim())
    if (!PaymentStore.add(this, payment)) return
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel("google-pay-payments", "Google Pay payments", NotificationManager.IMPORTANCE_HIGH))
    val intent = packageManager.getLaunchIntentForPackage(packageName) ?: return
    intent.action = Intent.ACTION_VIEW
    intent.data = Uri.parse("finsam://?paymentId=$id")
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val open = PendingIntent.getActivity(this, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(this, "google-pay-payments")
      .setSmallIcon(android.R.drawable.ic_menu_edit)
      .setContentTitle("Add Google Pay payment?")
      .setContentText("${parsed.second} ${parsed.first} · Tap to review and choose a category")
      .setContentIntent(open).addAction(android.R.drawable.ic_input_add, "Add payment", open)
      .setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build()
    try { manager.notify(id, 1, notification) } catch (_: SecurityException) {
      // Permissions may be revoked between the check and posting. Draft remains available in-app.
    }
  }
}
