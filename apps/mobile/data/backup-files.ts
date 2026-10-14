import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { MAX_BACKUP_BYTES } from "./backup";

export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain"], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error("Backups must be smaller than 20 MB.");
    return await file.text();
  } finally {
    if (file.exists) file.delete();
  }
}

export async function saveBackupFile(raw: string, filename: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
  const file = new File(Paths.cache, filename);
  try {
    file.write(raw);
    await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: "Save Fin backup" });
  } finally {
    if (file.exists) file.delete();
  }
}
