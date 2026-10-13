package expo.modules.googlepay

object PaymentParser {
  // Require outgoing-payment wording; amounts alone also occur in offers and requests.
  private val paid = Regex("\\b(paid|payment successful|payment complete[d]?|you spent|you sent)\\b|\\b(bezahlt|zahlung erfolgreich|du hast bezahlt)\\b", RegexOption.IGNORE_CASE)
  private val rejected = Regex("\\b(failed|declined|refund|refunded|received|request|requested|cashback|offer|fehlgeschlagen|abgelehnt|erstattung|erhalten|anfrage)\\b", RegexOption.IGNORE_CASE)
  private val amount = Regex("(?:(EUR|USD|GBP|INR|€|\\$|£|₹)\\s*([0-9]+(?:[.,\\u00a0 ][0-9]+)*)|([0-9]+(?:[.,\\u00a0 ][0-9]+)*)\\s*(EUR|USD|GBP|INR|€|\\$|£|₹))", RegexOption.IGNORE_CASE)
  fun parse(text: String): Pair<Double, String>? {
    if (Regex("-\\s*(?:EUR|USD|GBP|INR|€|\\$|£|₹|[0-9])").containsMatchIn(text)) return null
    if (!paid.containsMatchIn(text) || rejected.containsMatchIn(text)) return null
    val matches = amount.findAll(text).toList()
    if (matches.size != 1) return null // Ambiguous totals need manual entry.
    val match = matches.single()
    val currency = (match.groups[1]?.value ?: match.groups[4]!!.value).uppercase()
    val raw = (match.groups[2]?.value ?: match.groups[3]!!.value).trim().replace(" ", "").replace("\u00a0", "")
    val decimal = when {
      raw.contains(',') && raw.contains('.') -> if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) ',' else '.'
      Regex(".*[,.][0-9]{1,2}$").matches(raw) -> raw.last { it == ',' || it == '.' }
      else -> null
    }
    val integer = if (decimal == null) raw else raw.substringBeforeLast(decimal)
    if (!Regex("(?:[0-9]+|[0-9]{1,3}(?:[,.][0-9]{3})+)").matches(integer)) return null
    if (decimal != null && !Regex("[0-9]{1,2}").matches(raw.substringAfterLast(decimal))) return null
    val normalized = if (decimal == null) raw.replace(",", "").replace(".", "") else {
      val index = raw.lastIndexOf(decimal)
      raw.substring(0, index).replace(",", "").replace(".", "") + "." + raw.substring(index + 1)
    }
    val value = normalized.toDoubleOrNull()?.takeIf { it.isFinite() && it > 0 } ?: return null
    return value to when (currency) { "€" -> "EUR"; "$" -> "USD"; "£" -> "GBP"; "₹" -> "INR"; else -> currency }
  }
}
