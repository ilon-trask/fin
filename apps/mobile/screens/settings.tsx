import Button from "@/components/ui/button";
import ThemedText from "@/components/ui/themed-text";
import { TopBar, TopBarButton } from "@/components/ui/top-bar";
import { COLOR, SCREEN_LAYOUT } from "@/constants/tokens";
import { backupFilename, parseBackup } from "@/data/backup";
import { pickBackupFile, saveBackupFile } from "@/data/backup-files";
import { getRepository } from "@/data/db/client";
import { googlePay } from "@/integrations/google-pay";
import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Settings({ onBack }: { onBack: () => void }) {
  const [payStatus, setPayStatus] = useState(googlePay.status);
  const [transfer, setTransfer] = useState<"import" | "export" | null>(null);
  const [transferMessage, setTransferMessage] = useState("");
  const transferInProgress = useRef(false);
  async function transferData(action: "import" | "export") {
    if (transferInProgress.current) return;
    transferInProgress.current = true;
    setTransfer(action);
    setTransferMessage("");
    try {
      if (action === "import") {
        const raw = await pickBackupFile();
        if (raw === null) return;
        const backup = parseBackup(raw);
        const result = (await getRepository()).importBackup(backup);
        setTransferMessage(`Imported ${result.expenses} expenses and ${result.categories} categories. ${result.skipped} existing or duplicate records skipped.`);
      } else {
        const raw = (await getRepository()).exportBackup();
        await saveBackupFile(raw, backupFilename());
        setTransferMessage("Backup ready. Keep the JSON file to import your data later.");
      }
    } catch (error) {
      setTransferMessage(`Could not ${action}: ${error instanceof Error ? error.message : "Please try again."}`);
    } finally {
      transferInProgress.current = false;
      setTransfer(null);
    }
  }
  useEffect(() => {
    const subscription = AppState.addEventListener("change", () => setPayStatus(googlePay.status()));
    return () => subscription.remove();
  }, []);
  async function enableGooglePay() {
    try {
      await googlePay.requestNotifications();
      googlePay.setEnabled(true);
      setPayStatus(googlePay.status());
      if (!googlePay.status().accessGranted) googlePay.openAccessSettings();
    } catch {
      Alert.alert("Could not enable Google Pay reminders", "Please try again in Android settings.");
    }
  }

  return (
    <SafeAreaView style={styles.main} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TopBar actions={<TopBarButton icon="arrow-left" label="Back to expenses" onPress={onBack} />}>
          <ThemedText style={styles.heading}>Settings</ThemedText>
        </TopBar>

        <ThemedText style={styles.sectionLabel}>CONNECTIONS</ThemedText>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.icon}><Feather name="credit-card" size={18} color={COLOR.text} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <ThemedText style={styles.title}>Google Pay</ThemedText>
              <ThemedText style={styles.description}>Payment reminders</ThemedText>
            </View>
            <View style={styles.badge}><ThemedText style={styles.badgeText}>{payStatus.enabled ? "ON" : "OFF"}</ThemedText></View>
          </View>
          <ThemedText style={styles.description}>Detected payments are saved on this device for later review. Tap a reminder to choose a category and add the expense.</ThemedText>
          {!googlePay.available ? (
            <View style={styles.notice}>
              <Feather name="info" size={14} color={COLOR.muted} />
              <ThemedText style={[styles.description, { flex: 1 }]}>Available in the Android native build. Expo Go, iOS and web are not supported.</ThemedText>
            </View>
          ) : (
            <>
              <Button onPress={payStatus.enabled ? () => {
                googlePay.setEnabled(false);
                setPayStatus(googlePay.status());
              } : enableGooglePay}>
                <ThemedText style={styles.buttonText}>{payStatus.enabled ? "Disable reminders" : "Enable reminders"}</ThemedText>
              </Button>
              {payStatus.enabled && !payStatus.accessGranted && (
                <Button onPress={googlePay.openAccessSettings}><ThemedText style={styles.buttonText}>Allow notification access</ThemedText></Button>
              )}
              {payStatus.enabled && !payStatus.notificationsGranted && (
                <Button onPress={googlePay.openNotificationSettings}><ThemedText style={styles.buttonText}>Allow Fin notifications</ThemedText></Button>
              )}
            </>
          )}
          <ThemedText style={styles.description}>Keep purchase notifications enabled in Google Wallet. Turning off Fin reminders keeps payments already saved for review.</ThemedText>
          <View style={styles.divider} />
          <View style={styles.privacy}>
            <Feather name="shield" size={14} color={COLOR.muted} />
            <ThemedText style={styles.privacyText}>Notification access lets Fin read notifications. Only matching Google Pay / Wallet alerts are stored, locally on your device.</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.sectionLabel}>YOUR DATA</ThemedText>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.icon}><Feather name="database" size={18} color={COLOR.text} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <ThemedText style={styles.title}>Import & export</ThemedText>
              <ThemedText style={styles.description}>Back up expenses and categories as JSON</ThemedText>
            </View>
          </View>
          <View style={styles.actions}>
            <Button accessibilityRole="button" accessibilityLabel="Import backup" disabled={transfer !== null} onPress={() => void transferData("import")} style={styles.secondaryButton}><Feather name="download" size={14} color={COLOR.text} /><ThemedText>{transfer === "import" ? "Importing…" : "Import"}</ThemedText></Button>
            <Button accessibilityRole="button" accessibilityLabel="Export backup" disabled={transfer !== null} onPress={() => void transferData("export")} style={styles.secondaryButton}><Feather name="upload" size={14} color={COLOR.text} /><ThemedText>{transfer === "export" ? "Exporting…" : "Export"}</ThemedText></Button>
          </View>
          <ThemedText style={styles.description}>Import a Fin backup to add missing records. Existing edits and deletions are preserved.</ThemedText>
          {!!transferMessage && <ThemedText accessibilityLiveRegion="polite" style={styles.description}>{transferMessage}</ThemedText>}
        </View>
        <View style={styles.footer}>
          <ThemedText style={styles.footerBrand}>FIN</ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: COLOR.bg },
  content: { ...SCREEN_LAYOUT, width: "100%", maxWidth: 600, alignSelf: "center", paddingBottom: 32 },
  heading: { fontSize: 22, letterSpacing: -0.7, fontWeight: "600" },
  description: { color: COLOR.muted, fontSize: 13, lineHeight: 20 },
  sectionLabel: { color: COLOR.muted, fontSize: 10, letterSpacing: 1.4 },
  card: { borderWidth: 1, borderColor: COLOR.border, borderRadius: 10, backgroundColor: COLOR.surface, padding: 18, gap: 18 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 40, height: 40, backgroundColor: COLOR.elevated, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "500" },
  badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: COLOR.border },
  badgeText: { color: COLOR.muted, fontSize: 9, letterSpacing: 1 },
  notice: { flexDirection: "row", gap: 9, backgroundColor: COLOR.elevated, borderRadius: 6, padding: 12 },
  divider: { height: 1, backgroundColor: COLOR.border },
  privacy: { flexDirection: "row", gap: 9 },
  privacyText: { flex: 1, color: COLOR.muted, fontSize: 11, lineHeight: 17 },
  buttonText: { color: COLOR.onPrimary, fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10 },
  secondaryButton: { flex: 1, backgroundColor: COLOR.elevated, borderWidth: 1, borderColor: COLOR.border, flexDirection: "row", gap: 8 },
  footer: { marginTop: 20, alignItems: "center", gap: 8 },
  footerBrand: { fontWeight: "800", fontSize: 18, letterSpacing: -0.5 },
});
