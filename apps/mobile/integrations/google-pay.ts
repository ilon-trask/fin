import { requireOptionalNativeModule } from "expo";
import { PermissionsAndroid, Platform } from "react-native";

export interface PaymentDraft {
  id: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
}
interface Status {
  enabled: boolean;
  accessGranted: boolean;
  notificationsGranted: boolean;
}
interface GooglePayNative {
  getStatus(): Status;
  setEnabled(enabled: boolean): void;
  getPending(): string[];
  refresh(): void;
  openNotificationSettings(): void;
  dismiss(id: string): void;
  openAccessSettings(): void;
}
const native = Platform.OS === "android"
  ? requireOptionalNativeModule<GooglePayNative>("FinGooglePay") : null;

export const googlePay = {
  available: !!native,
  status: (): Status => native?.getStatus() ?? { enabled: false, accessGranted: false, notificationsGranted: false },
  pending: (): PaymentDraft[] => (native?.getPending() ?? []).flatMap((raw) => {
    try {
      const payment = JSON.parse(raw);
      return typeof payment.id === "string" && Number.isFinite(payment.amount) && payment.amount > 0
        && typeof payment.currency === "string" && typeof payment.description === "string"
        && !Number.isNaN(Date.parse(payment.date)) ? [payment as PaymentDraft] : [];
    } catch { return []; }
  }),
  refresh: () => native?.refresh(),
  openNotificationSettings: () => native?.openNotificationSettings(),
  dismiss: (id: string) => native?.dismiss(id),
  setEnabled: (enabled: boolean) => native?.setEnabled(enabled),
  openAccessSettings: () => native?.openAccessSettings(),
  async requestNotifications() {
    if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
  },
};
