import { COLOR } from "@/constants/tokens";
import { StyleSheet } from "react-native";

export const dialogStyles = StyleSheet.create({
  field: { width: "100%", gap: 8 },
  label: { color: "#B5B5B5", fontSize: 13, fontWeight: "500" },
  input: {
    minHeight: 56,
    backgroundColor: COLOR.bg,
    color: COLOR.text,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: "Google-Sans-Code",
    fontSize: 16,
  },
  save: { width: "100%", borderRadius: 12, marginTop: 4 },
  saveText: { fontSize: 16, fontWeight: "600" },
});
