package expo.modules.googlepay

import org.junit.Assert.*
import org.junit.Test

class PaymentParserTest {
  @Test fun readsOutgoingPayments() {
    assertEquals(12.50 to "EUR", PaymentParser.parse("You paid €12.50 at Cafe."))
    assertEquals(1234.56 to "EUR", PaymentParser.parse("Bezahlt: 1.234,56 EUR"))
    assertEquals(1234.56 to "USD", PaymentParser.parse("Payment successful USD 1,234.56"))
    assertEquals(1234.56 to "EUR", PaymentParser.parse("Zahlung erfolgreich 1 234,56 €"))
    assertEquals(500.0 to "INR", PaymentParser.parse("You paid ₹500 to Shop"))
    assertEquals(12.50 to "EUR", PaymentParser.parse("Purchase at Cafe €12.50"))
    assertEquals(12.50 to "EUR", PaymentParser.parse("Zahlung bei Cafe 12,50 €"))
    assertEquals(1234.56 to "EUR", PaymentParser.parse("Du hast 1\u202f234,56\u00a0€ bezahlt"))
    assertEquals(12.50 to "EUR", PaymentParser.parse("You paid \u200e€12.50"))
    assertEquals(12.50 to "EUR", PaymentParser.parse("Google Wallet\n€12.50 at Cafe"))
    assertEquals(12.50 to "EUR", PaymentParser.parse("12,50 € bei Cafe"))
    assertEquals(10.0 to "GBP", PaymentParser.parse("You paid £10."))
  }
  @Test fun acceptsMerchantTitlesRepeatedAmountsAndMerchantNames() {
    listOf("Cafe\n€12.50", "Shop-24\n12,50 EUR", "Shop-24\nEUR 12.50", "You paid €12.50 at Shop-24",
      "Du hast 12,50 € bei Balance bezahlt", "You paid €12.50 at Offer Shop",
      "You paid €12.50\nPayment amount €12.50", "You paid EUR 12,50\nPayment amount €12.50")
      .forEach { assertEquals(it, 12.5 to "EUR", PaymentParser.parse(it)) }
  }

  @Test fun supportsAdditionalCurrenciesAndPaymentLanguages() {
    assertEquals(12.5 to "USD", PaymentParser.parse("You paid USD12.50 at Cafe"))
    assertEquals(12.345 to "KWD", PaymentParser.parse("You paid KWD 12.345 at Cafe"))
    assertEquals(12.5 to "CHF", PaymentParser.parse("You paid CHF 12.50 at Cafe"))
    assertEquals(12.5 to "PLN", PaymentParser.parse("Cafe\n12,50 PLN"))
    assertEquals(12.5 to "EUR", PaymentParser.parse("Google Wallet\nОплата 12,50 € в Cafe"))
    assertEquals(1250.0 to "RUB", PaymentParser.parse("Оплачено 1 250 ₽"))
    assertEquals(12.5 to "EUR", PaymentParser.parse("Vous avez payé 12,50 € chez Cafe"))
  }

  @Test fun reportsRejectionReasonsAndPreservesSafetyChecks() {
    assertEquals("negative_amount", PaymentParser.inspect("You paid -€12.50").reason)
    assertEquals("ambiguous_amount", PaymentParser.inspect("You paid €12.50 total €15.00").reason)
    assertEquals("non_payment", PaymentParser.inspect("Payment declined €12.50").reason)
    assertEquals("no_amount", PaymentParser.inspect("You paid at Cafe").reason)
    assertEquals("invalid_amount", PaymentParser.inspect("You paid €1.23.45").reason)
    assertEquals("unrecognized_format", PaymentParser.inspect("Google Wallet\n€12.50").reason)
    listOf("Offer\n€12.50", "Card balance\n€12.50", "You paid €12.50 at Cafe pending", "You paid €12.50 at Cafe cashback offer",
      "You paid €12.50 at Shop-24, refunded", "You paid €12.50 and USD 12.50",
      "Payment requested\nCHF 12.50", "Google Wallet\nВозврат 12,50 €", "Оплата 12,50 € не выполнена", "Покупка 12,50 € отклонена",
      "Paiement effectué 12,50 € remboursement", "You paid -12,50 EUR")
      .forEach { assertNull(it, PaymentParser.parse(it)) }
  }

  @Test fun skipsUncertainOrNonExpenseAlerts() {
    listOf("Purchase at Cafe declined €12.50", "Zahlung bei Cafe fehlgeschlagen 12,50 €", "Payment failed €12.50", "You received €12.50", "Payment requested €12.50",
      "You paid €12.50. Cashback offer!", "You paid €12.50, refunded",
      "You paid €12.50, total €15.00", "Card balance €12.50", "€12.50 at Cafe pending", "Card balance €12.50 at Cafe", "You paid -€12.50",
      "You paid €0.00", "You paid €1.23.45", "You paid €1,234.567", "You paid at Cafe").forEach { assertNull(it, PaymentParser.parse(it)) }
  }
}
