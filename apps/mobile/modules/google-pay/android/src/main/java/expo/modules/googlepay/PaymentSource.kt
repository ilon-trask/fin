package expo.modules.googlepay

object PaymentSource {
  private val walletPackages = setOf("com.google.android.apps.walletnfcrel", "com.google.android.apps.nbu.paisa.user", "com.google.android.apps.nbu.paisa.user.integration")
  private val walletChannel = Regex("wallet|google[._ -]?pay|gpay", RegexOption.IGNORE_CASE)
  private val walletName = Regex("\\b(?:Google\\s+(?:Wallet|Pay)|GPay)\\b", RegexOption.IGNORE_CASE)

  fun accepts(packageName: String, channelId: String?, appName: String, text: String): Boolean {
    if (packageName in walletPackages) return true
    // Play services also delivers Wallet alerts. Do not read unrelated GMS alerts.
    return packageName == "com.google.android.gms" &&
      (walletChannel.containsMatchIn(channelId.orEmpty()) || walletName.containsMatchIn(appName) || walletName.containsMatchIn(text))
  }
}
