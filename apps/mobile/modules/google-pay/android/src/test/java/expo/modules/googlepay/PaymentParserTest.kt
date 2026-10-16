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
  @Test fun skipsUncertainOrNonExpenseAlerts() {
    listOf("Purchase at Cafe declined €12.50", "Zahlung bei Cafe fehlgeschlagen 12,50 €", "Payment failed €12.50", "You received €12.50", "Payment requested €12.50",
      "You paid €12.50. Cashback offer!", "You paid €12.50, refunded",
      "You paid €12.50, total €15.00", "Card balance €12.50", "€12.50 at Cafe pending", "Card balance €12.50 at Cafe", "You paid -€12.50",
      "You paid €0.00", "You paid €1.23.45", "You paid €1,234.567", "You paid at Cafe").forEach { assertNull(it, PaymentParser.parse(it)) }
  }
}
