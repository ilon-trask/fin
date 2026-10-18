package expo.modules.googlepay

import java.util.Currency

object PaymentParser {
  data class Result(val payment: Pair<Double, String>? = null, val reason: String? = null)

  private val paid = Regex("\\b(paid|payment successful|payment complete[d]?|you spent|you sent|purchase(?: successful| at)|payment at|bezahlt|zahlung erfolgreich|zahlung bei|kauf bei|оплата|оплачено|покупка|вы заплатили|paiement effectué|vous avez payé)\\b", RegexOption.IGNORE_CASE)
  private val rejected = Regex("\\b(failed|declined|refund|refunded|received|request|requested|cashback|offer|pending|balance|fehlgeschlagen|abgelehnt|erstattung|erhalten|anfrage|ausstehend|guthaben|отклонено|отклонен[ао]?|отменен[ао]?|возврат|возвращено|получено|получен[ао]?|не выполнен[ао]?|ожидание|ожидает|кэшбэк|запрос|en attente|refusé|remboursé|remboursement|échoué|reçu|offre|solde)\\b", RegexOption.IGNORE_CASE)
  // These nouns can also be merchant names. Only exclude them from the status
  // check when they follow an explicit merchant preposition in a payment alert.
  private val merchantNoun = Regex("\\b(balance|offer|cashback|request|guthaben)\\b", RegexOption.IGNORE_CASE)
  private val merchant = Regex("\\b(?:at|bei|to|в|chez)\\s+[^\\n.,!?]+", RegexOption.IGNORE_CASE)
  private val heading = Regex("(?:Google\\s+(?:Wallet|Pay)|GPay):?", RegexOption.IGNORE_CASE)
  private val currencies = Currency.getAvailableCurrencies().map { it.currencyCode }.filter { it !in setOf("XXX", "XTS") }.sorted().joinToString("|")
  private val currency = "(?:(?<![A-Za-z])(?:$currencies)(?![A-Za-z])|€|\\$|£|₹|₽|₴)"
  private val amount = Regex("(?:($currency)[\\t ]*([0-9]+(?:[.,\\u00a0 ][0-9]+)*)|([0-9]+(?:[.,\\u00a0 ][0-9]+)*)[\\t ]*($currency))", RegexOption.IGNORE_CASE)

  fun parse(rawText: String): Pair<Double, String>? = inspect(rawText).payment

  fun inspect(rawText: String): Result {
    val text = rawText.replace('\u202f', ' ').replace('\u00a0', ' ').replace(Regex("[\\u200e\\u200f\\u061c]"), "")
    val statusText = if (paid.containsMatchIn(text)) {
      merchant.replace(text) { match ->
        merchantNoun.replace(match.value) { noun ->
          if (noun.value.first().isUpperCase()) "merchant" else noun.value
        }
      }
    } else text
    if (rejected.containsMatchIn(statusText)) return Result(reason = "non_payment")
    val matches = amount.findAll(text).toList()
    if (matches.isEmpty()) return Result(reason = "no_amount")
    if (matches.any { text.substring(0, it.range.first).trimEnd().endsWith('-') }) return Result(reason = "negative_amount")
    val payments = matches.map { readAmount(it) ?: return Result(reason = "invalid_amount") }.distinct()
    if (payments.size != 1) return Result(reason = "ambiguous_amount")
    if (!paid.containsMatchIn(text)) {
      val match = matches.first()
      val prefix = text.substring(0, match.range.first).trim()
      val suffix = text.substring(match.range.last + 1).trim()
      val amountAtMerchant = (prefix.isEmpty() || heading.matches(prefix)) &&
        Regex("^(?:at|bei|в|chez)\\s+\\S", RegexOption.IGNORE_CASE).containsMatchIn(suffix)
      // Wallet also posts the merchant as its title and only the amount as its
      // body. Require that exact layout, rather than accepting any bare amount.
      val lines = text.lines().map { it.trim() }.filter { it.isNotEmpty() }
      val merchantTitle = lines.size == 2 && !heading.matches(lines[0]) &&
        !amount.containsMatchIn(lines[0]) && amount.matches(lines[1])
      if (!amountAtMerchant && !merchantTitle) return Result(reason = "unrecognized_format")
    }
    return Result(payment = payments.single())
  }

  private fun readAmount(match: MatchResult): Pair<Double, String>? {
    val code = (match.groups[1]?.value ?: match.groups[4]!!.value).uppercase(java.util.Locale.ROOT)
    val currencyCode = when (code) { "€" -> "EUR"; "$" -> "USD"; "£" -> "GBP"; "₹" -> "INR"; "₽" -> "RUB"; "₴" -> "UAH"; else -> code }
    val fractionDigits = maxOf(2, Currency.getInstance(currencyCode).defaultFractionDigits)
    val raw = (match.groups[2]?.value ?: match.groups[3]!!.value).trim().replace(" ", "").replace("\u00a0", "")
    val decimal = when {
      raw.contains(',') && raw.contains('.') -> if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) ',' else '.'
      Regex(".*[,.][0-9]{1,$fractionDigits}$").matches(raw) -> raw.last { it == ',' || it == '.' }
      else -> null
    }
    val integer = if (decimal == null) raw else raw.substringBeforeLast(decimal)
    if (!Regex("(?:[0-9]+|[0-9]{1,3}(?:[,.][0-9]{3})+)").matches(integer)) return null
    if (decimal != null && !Regex("[0-9]{1,$fractionDigits}").matches(raw.substringAfterLast(decimal))) return null
    val normalized = if (decimal == null) raw.replace(",", "").replace(".", "") else {
      val index = raw.lastIndexOf(decimal)
      raw.substring(0, index).replace(",", "").replace(".", "") + "." + raw.substring(index + 1)
    }
    val value = normalized.toDoubleOrNull()?.takeIf { it.isFinite() && it > 0 } ?: return null
    return value to currencyCode
  }
}
