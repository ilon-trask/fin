package expo.modules.googlepay

import android.content.Context
import android.app.NotificationManager
import org.json.JSONArray
import org.json.JSONObject

object PaymentStore {
  private fun prefs(context: Context) = context.getSharedPreferences("google_pay", Context.MODE_PRIVATE)
  fun enabled(context: Context) = prefs(context).getBoolean("enabled", false)
  @Synchronized fun setEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean("enabled", enabled).apply()
    if (!enabled) {
      pending(context).forEach { dismiss(context, it.getString("id")) }
      prefs(context).edit().remove("pending").apply()
    }
  }
  @Synchronized fun pending(context: Context): List<JSONObject> {
    val array = JSONArray(prefs(context).getString("pending", "[]"))
    return (0 until array.length()).map { array.getJSONObject(it) }
  }
  @Synchronized fun add(context: Context, payment: JSONObject): Boolean {
    if (!enabled(context)) return false
    val seen = JSONArray(prefs(context).getString("seen", "[]"))
    val id = payment.getString("id")
    if ((0 until seen.length()).any { seen.getString(it) == id }) return false
    val history = (0 until seen.length()).map { seen.getString(it) }.takeLast(499) + id
    val queue = pending(context) + payment
    queue.dropLast(100).forEach { dismiss(context, it.getString("id")) }
    prefs(context).edit().putString("pending", JSONArray(queue.takeLast(100)).toString())
      .putString("seen", JSONArray(history).toString()).commit()
    return true
  }
  @Synchronized fun remove(context: Context, id: String) {
    prefs(context).edit().putString("pending", JSONArray(pending(context).filter { it.getString("id") != id }).toString()).commit()
    dismiss(context, id)
  }
  private fun dismiss(context: Context, id: String) {
    context.getSystemService(NotificationManager::class.java).cancel(id, 1)
  }
}
