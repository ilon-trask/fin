import { COLOR } from "@/constants/tokens";
import { StyleSheet } from "react-native";

export const dialogStyles = StyleSheet.create({
  field: { width: "100%", gap: 8 },
  label: { color: COLOR.muted, fontSize: 13, fontWeight: "500" },
  input: {
    minHeight: 56,
    backgroundColor: COLOR.bg,
    color: COLOR.text,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  save: { width: "100%", borderRadius: 8, marginTop: 4 },
  saveText: { color: COLOR.onPrimary, fontSize: 14, fontWeight: "600" },
});
