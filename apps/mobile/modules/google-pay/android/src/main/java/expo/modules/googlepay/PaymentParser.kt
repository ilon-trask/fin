package expo.modules.googlepay

object PaymentParser {
  // Require outgoing-payment wording or Wallet's amount-at-merchant format.
  private val paid = Regex("\\b(paid|payment successful|payment complete[d]?|you spent|you sent|purchase(?: successful| at)|payment at)\\b|\\b(bezahlt|zahlung erfolgreich|zahlung bei|kauf bei)\\b", RegexOption.IGNORE_CASE)
  private val rejected = Regex("\\b(failed|declined|refund|refunded|received|request|requested|cashback|offer|pending|balance|fehlgeschlagen|abgelehnt|erstattung|erhalten|anfrage|ausstehend|guthaben)\\b", RegexOption.IGNORE_CASE)
  private val amount = Regex("(?:(EUR|USD|GBP|INR|€|\\$|£|₹)\\s*([0-9]+(?:[.,\\u00a0 ][0-9]+)*)|([0-9]+(?:[.,\\u00a0 ][0-9]+)*)\\s*(EUR|USD|GBP|INR|€|\\$|£|₹))", RegexOption.IGNORE_CASE)
  fun parse(rawText: String): Pair<Double, String>? {
    val text = rawText.replace('\u202f', ' ').replace('\u00a0', ' ').replace(Regex("[\\u200e\\u200f\\u061c]"), "")
    if (Regex("-\\s*(?:EUR|USD|GBP|INR|€|\\$|£|₹|[0-9])").containsMatchIn(text)) return null
    if (rejected.containsMatchIn(text)) return null
    val matches = amount.findAll(text).toList()
    if (matches.size != 1) return null // Ambiguous totals need manual entry.
    val match = matches.single()
    if (!paid.containsMatchIn(text)) {
      val prefix = text.substring(0, match.range.first).trim()
      val suffix = text.substring(match.range.last + 1).trim()
      val walletHeading = Regex("(?:Google\\s+(?:Wallet|Pay)|GPay):?", RegexOption.IGNORE_CASE)
      if ((prefix.isNotEmpty() && !walletHeading.matches(prefix)) ||
        !Regex("^(?:at|bei)\\s+\\S", RegexOption.IGNORE_CASE).containsMatchIn(suffix)) return null
    }
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
