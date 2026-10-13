import { COLOR } from "@/constants/tokens";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import { dialogStyles } from "./dialog-styles";
import ThemedText from "./themed-text";

interface TimePickerProps {
  value: Date;
  label: string;
  open: boolean;
  onToggle: () => void;
}

const pad = (value: number) => String(value).padStart(2, "0");

export default function TimePicker({ value, label, open, onToggle }: TimePickerProps) {
  const time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label}, ${time}`}
      accessibilityState={{ expanded: open }} onPress={onToggle}
      style={({ pressed }) => [styles.trigger, open && styles.active, pressed && styles.pressed]}>
      <Feather name="clock" size={17} color={open ? COLOR.text : COLOR.muted} />
      <ThemedText numberOfLines={1} style={styles.triggerText}>{time}</ThemedText>
      <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={COLOR.muted} />
    </Pressable>
  );
}

export function TimePickerPanel({ value, onChange, onClose }: {
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
}) {
  const [hours, setHours] = useState(() => pad(value.getHours()));
  const [minutes, setMinutes] = useState(() => pad(value.getMinutes()));
  const minuteInput = useRef<TextInput>(null);
  const valid = /^\d{1,2}$/.test(hours) && /^\d{1,2}$/.test(minutes) && Number(hours) < 24 && Number(minutes) < 60;

  const apply = () => {
    if (!valid) return;
    const next = new Date(value);
    next.setHours(Number(hours), Number(minutes), 0, 0);
    Keyboard.dismiss();
    onChange(next);
    onClose();
  };
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Time (24h)</ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="Use current time" style={styles.now}
          onPress={() => { const now = new Date(); setHours(pad(now.getHours())); setMinutes(pad(now.getMinutes())); }}>
          <Feather name="clock" size={14} color={COLOR.text} />
          <ThemedText style={{ fontSize: 12 }}>Now</ThemedText>
        </Pressable>
      </View>
      <View style={styles.columns}>
        {[
          { label: "Hours", value: hours, set: setHours, limit: 24 },
          { label: "Minutes", value: minutes, set: setMinutes, limit: 60 },
        ].map((field, index) => (
          <React.Fragment key={field.label}>
            {index === 1 && <ThemedText style={styles.colon}>:</ThemedText>}
            <View style={styles.column}>
              <TextInput ref={index === 1 ? minuteInput : undefined} accessibilityLabel={field.label} value={field.value}
                keyboardType="number-pad" maxLength={2} selectTextOnFocus style={styles.numberInput}
                placeholder={index === 0 ? "HH" : "MM"} placeholderTextColor={COLOR.muted}
                returnKeyType={index === 0 ? "next" : "done"}
                onChangeText={(text) => { if (/^\d{0,2}$/.test(text)) field.set(text); }}
                onBlur={() => { if (field.value !== "" && Number(field.value) < field.limit) field.set(pad(Number(field.value))); }}
                onSubmitEditing={() => index === 0 ? minuteInput.current?.focus() : apply()} />
              <ThemedText style={styles.hint}>{field.label}</ThemedText>
            </View>
          </React.Fragment>
        ))}
      </View>
      {!valid && <ThemedText accessibilityLiveRegion="polite" style={styles.hint}>Enter hours 00–23 and minutes 00–59.</ThemedText>}
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={() => { Keyboard.dismiss(); onClose(); }} style={styles.cancel}>
          <ThemedText style={styles.hint}>Cancel</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Done, apply time" accessibilityState={{ disabled: !valid }}
          disabled={!valid} onPress={apply} style={({ pressed }) => [styles.done, (!valid || pressed) && styles.pressed]}>
          <ThemedText style={styles.doneText}>Done</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { ...dialogStyles.input, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10 },
  triggerText: { flex: 1, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  active: { borderColor: COLOR.muted, backgroundColor: COLOR.elevated },
  pressed: { opacity: 0.55 },
  panel: { backgroundColor: COLOR.bg, borderRadius: 10, borderWidth: 1, borderColor: COLOR.border, padding: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 14, fontWeight: "600" },
  hint: { fontSize: 12, color: COLOR.muted },
  columns: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  column: { flex: 1, gap: 8, alignItems: "center" },
  colon: { fontSize: 32, color: COLOR.muted, lineHeight: 60 },
  numberInput: { width: "100%", height: 60, padding: 0, color: COLOR.text, backgroundColor: COLOR.surface, borderWidth: 1, borderColor: COLOR.border, borderRadius: 8, fontSize: 28, fontWeight: "600", textAlign: "center", fontVariant: ["tabular-nums"] },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: COLOR.border, paddingTop: 12 },
  now: { minHeight: 40, flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 12, borderRadius: 7, backgroundColor: COLOR.elevated },
  cancel: { minHeight: 44, paddingHorizontal: 12, justifyContent: "center" },
  done: { minHeight: 44, backgroundColor: COLOR.primary, borderRadius: 7, paddingHorizontal: 18, justifyContent: "center" },
  doneText: { color: COLOR.onPrimary, fontSize: 13, fontWeight: "600" },
});
