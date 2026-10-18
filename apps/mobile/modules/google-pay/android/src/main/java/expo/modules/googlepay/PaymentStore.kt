package expo.modules.googlepay

import android.content.Context
import android.app.NotificationManager
import org.json.JSONArray
import org.json.JSONObject

object PaymentStore {
  private fun prefs(context: Context) = context.getSharedPreferences("google_pay", Context.MODE_PRIVATE)
  fun diagnostics(context: Context): Map<String, Any?> = mapOf(
    "lastEventAt" to prefs(context).getLong("last_event_at", 0L).takeIf { it > 0 },
    "lastOutcome" to prefs(context).getString("last_outcome", null),
    "lastCapturedAt" to prefs(context).getLong("last_captured_at", 0L).takeIf { it > 0 },
    "lastReminderOutcome" to prefs(context).getString("last_reminder_outcome", null))

  @Synchronized fun recordEvent(context: Context, at: Long, outcome: String) {
    if (at < prefs(context).getLong("last_event_at", 0L)) return
    prefs(context).edit().putLong("last_event_at", at).putString("last_outcome", outcome).apply()
  }
  fun recordCapture(context: Context) {
    prefs(context).edit().putLong("last_captured_at", System.currentTimeMillis()).apply()
  }
  fun recordReminder(context: Context, outcome: String) {
    prefs(context).edit().putString("last_reminder_outcome", outcome).apply()
  }

  fun enabled(context: Context) = prefs(context).getBoolean("enabled", false)
  @Synchronized fun setEnabled(context: Context, enabled: Boolean) {
    val previous = enabled(context)
    prefs(context).edit().putBoolean("enabled", enabled).apply()
    if (!enabled) {
      pending(context).forEach { dismiss(context, it.getString("id")) }
    }
    if (previous != enabled) {
      PaymentTelemetry.capture(context, "enabled_changed", mapOf(
        "previous_enabled" to previous,
        "requested_enabled" to enabled
      ))
    }
  }
  @Synchronized fun pending(context: Context): List<JSONObject> {
    val array = JSONArray(prefs(context).getString("pending", "[]"))
    return (0 until array.length()).map { array.getJSONObject(it) }
  }
  @Synchronized fun hasSeen(context: Context, id: String): Boolean {
    val seen = JSONArray(prefs(context).getString("seen", "[]"))
    return (0 until seen.length()).any { seen.getString(it) == id }
  }
  @Synchronized fun add(context: Context, payment: JSONObject): Boolean {
    if (!enabled(context)) return false
    val seen = JSONArray(prefs(context).getString("seen", "[]"))
    val id = payment.getString("id")
    if ((0 until seen.length()).any { seen.getString(it) == id }) return false
    val history = (0 until seen.length()).map { seen.getString(it) } + id
    val queue = pending(context) + payment
    return prefs(context).edit().putString("pending", JSONArray(queue).toString())
      .putString("seen", JSONArray(history).toString()).commit()
  }
  @Synchronized fun markNotified(context: Context, id: String) {
    val queue = pending(context).map { if (it.getString("id") == id) it.put("notified", true) else it }
    prefs(context).edit().putString("pending", JSONArray(queue).toString()).commit()
  }
  @Synchronized fun remove(context: Context, id: String) {
    prefs(context).edit().putString("pending", JSONArray(pending(context).filter { it.getString("id") != id }).toString()).commit()
    dismiss(context, id)
  }
  private fun dismiss(context: Context, id: String) {
    context.getSystemService(NotificationManager::class.java).cancel(id, 1)
  }
}
