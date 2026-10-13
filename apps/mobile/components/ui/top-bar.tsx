import { COLOR } from "@/constants/tokens";
import { Feather } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export function TopBar({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <View style={styles.bar}>
      <View style={styles.title}>{children}</View>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

export function TopBarButton({ icon, label, onPress }: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.button}>
      <Feather name={icon} size={18} color={COLOR.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  title: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  button: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: COLOR.border },
});
