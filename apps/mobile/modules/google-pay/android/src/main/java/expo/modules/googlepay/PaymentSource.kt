package expo.modules.googlepay

object PaymentSource {
  private val walletPackages = setOf("com.google.android.apps.walletnfcrel", "com.google.android.apps.nbu.paisa.user", "com.google.android.apps.nbu.paisa.user.integration")
  private val walletChannel = Regex("wallet|google[._ -]?pay|gpay", RegexOption.IGNORE_CASE)
  private val walletName = Regex("\\b(?:Google\\s+(?:Wallet|Pay)|GPay)\\b", RegexOption.IGNORE_CASE)

  // Some Play services versions use an unbranded payment channel. The parser
  // still requires a recognizable outgoing payment before anything is saved.
  private val paymentChannel = Regex("(?:com\\.google\\.android\\.gms\\.)?(?:payments|purchases)", RegexOption.IGNORE_CASE)

  fun isCandidate(packageName: String) = packageName in walletPackages || packageName == "com.google.android.gms"

  fun accepts(packageName: String, channelId: String?, appName: String, text: String): Boolean {
    if (packageName in walletPackages) return true
    // Play services also delivers Wallet alerts. Do not read unrelated GMS alerts.
    return packageName == "com.google.android.gms" &&
      (walletChannel.containsMatchIn(channelId.orEmpty()) || paymentChannel.matches(channelId.orEmpty()) || walletName.containsMatchIn(appName) || walletName.containsMatchIn(text))
  }
}
