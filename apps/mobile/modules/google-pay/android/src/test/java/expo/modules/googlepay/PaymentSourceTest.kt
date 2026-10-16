package expo.modules.googlepay

import org.junit.Assert.*
import org.junit.Test

class PaymentSourceTest {
  @Test fun acceptsWalletAndWalletAlertsDeliveredByPlayServices() {
    assertTrue(PaymentSource.accepts("com.google.android.apps.walletnfcrel", "purchases", "", "You paid €12.50"))
    assertTrue(PaymentSource.accepts("com.google.android.gms", "com.google.android.gms.wallet", "", "You paid €12.50"))
    assertTrue(PaymentSource.accepts("com.google.android.gms", "payments", "Google Pay", "You paid €12.50"))
    assertTrue(PaymentSource.accepts("com.google.android.gms", null, "", "Google Wallet: You paid €12.50"))
  }
  @Test fun rejectsUnrelatedNotificationsEvenWithPaymentWording() {
    assertFalse(PaymentSource.accepts("com.google.android.gms", "play_store", "Google Play", "You paid €12.50"))
    assertFalse(PaymentSource.accepts("com.example.bank", "wallet", "Google Pay", "You paid €12.50"))
  }
}
