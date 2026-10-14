import { MAX_BACKUP_BYTES } from "./backup";

export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json,text/plain";
    input.style.display = "none";
    const cleanup = () => input.remove();
    input.addEventListener("cancel", () => { cleanup(); resolve(null); }, { once: true });
    input.addEventListener("change", async () => {
      try {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        if (file.size > MAX_BACKUP_BYTES) throw new Error("Backups must be smaller than 20 MB.");
        resolve(await file.text());
      } catch (error) { reject(error); }
      finally { cleanup(); }
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export async function saveBackupFile(raw: string, filename: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
