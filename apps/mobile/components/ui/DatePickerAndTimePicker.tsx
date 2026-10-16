import { COLOR } from "@/constants/tokens";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View, ViewStyle } from "react-native";
import { dialogStyles } from "./dialog-styles";
import ThemedText from "./themed-text";
import TimePicker, { TimePickerPanel } from "./time-picker";

interface DatePickerAndTimePickerProps {
  value: Date | string;
  onChange: (date: Date) => void;
  dateLabel?: string;
  timeLabel?: string;
  style?: ViewStyle;
}

function parseDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const months = Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(undefined, { month: "short" }));

export default function DatePickerAndTimePicker({
  value, onChange, dateLabel = "Date", timeLabel = "Time", style,
}: DatePickerAndTimePickerProps) {
  const controlledDate = useMemo(() => parseDate(value), [value]);
  const [fallbackDate, setFallbackDate] = useState(() => new Date());
  const selectedDate = controlledDate ?? fallbackDate;
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const [month, setMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [jump, setJump] = useState(false);
  const [compact, setCompact] = useState(false);
  const [year, setYear] = useState(String(selectedDate.getFullYear()));
  const today = new Date();
  const open = mode === "date";
  const validYear = /^\d{4}$/.test(year) && Number(year) >= 1000 && Number(year) <= 9999;

  const updateDate = (date: Date) => {
    setFallbackDate(date);
    onChange(date);
    setMode(null);
  };
  const toggle = (nextMode: "date" | "time") => {
    Keyboard.dismiss();
    if (mode === nextMode) { setMode(null); return; }
    setMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setYear(String(selectedDate.getFullYear()));
    setJump(false);
    setMode(nextMode);
  };
  const chooseDay = (day: Date) => {
    const next = new Date(selectedDate);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    updateDate(next);
  };
  const moveMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setYear(String(next.getFullYear()));
  };
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1));
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const relativeDate = sameDay(selectedDate, today) ? "Today" : selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(selectedDate.getFullYear() !== today.getFullYear() && { year: "numeric" }) });

  return (
    <View style={[styles.container, style]} onLayout={({ nativeEvent }) => setCompact(nativeEvent.layout.width < 280)}>
      <View style={[styles.row, compact && styles.stackedRow]}>
        <View style={[styles.dateField, compact && styles.stackedField]}>
          <ThemedText style={dialogStyles.label}>{dateLabel}</ThemedText>
          <Pressable accessibilityRole="button"
            accessibilityLabel={`Choose date, ${selectedDate.toLocaleDateString(undefined, { dateStyle: "full" })}`}
            accessibilityState={{ expanded: open }} onPress={() => toggle("date")}
            style={({ pressed }) => [styles.input, open && styles.activeInput, pressed && styles.pressed]}>
            <Feather name="calendar" size={17} color={open ? COLOR.text : COLOR.muted} />
            <ThemedText numberOfLines={1} style={styles.dateText}>{relativeDate}</ThemedText>
            <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={COLOR.muted} />
          </Pressable>
        </View>
        <View style={[styles.timeField, compact && styles.stackedField]}>
          <ThemedText style={dialogStyles.label}>{timeLabel}</ThemedText>
          <TimePicker value={selectedDate} label={timeLabel} open={mode === "time"} onToggle={() => toggle("time")} />
        </View>
      </View>
      {mode === "time" && <TimePickerPanel value={selectedDate} onChange={updateDate} onClose={() => setMode(null)} />}
      {open && (
        <View style={styles.calendar}>
          <View style={styles.calendarHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={styles.monthButton} onPress={() => moveMonth(-1)}>
              <Feather name="chevron-left" size={18} color={COLOR.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose month and year" accessibilityState={{ expanded: jump }}
              style={styles.monthHeading} onPress={() => { setYear(String(month.getFullYear())); setJump(!jump); }}>
              <ThemedText accessibilityLiveRegion="polite" numberOfLines={1} style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</ThemedText>
              <Feather name={jump ? "chevron-up" : "chevron-down"} size={14} color={COLOR.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" style={styles.monthButton} onPress={() => moveMonth(1)}>
              <Feather name="chevron-right" size={18} color={COLOR.text} />
            </Pressable>
          </View>
          {jump ? <View style={styles.jump}>
            <View style={styles.yearRow}>
              <ThemedText style={styles.caption}>Year</ThemedText>
              <TextInput accessibilityLabel="Year" keyboardType="number-pad" maxLength={4} selectTextOnFocus
                value={year} onChangeText={(text) => { if (/^\d{0,4}$/.test(text)) setYear(text); }} style={styles.yearInput} />
            </View>
            <View style={styles.grid}>{months.map((name, index) => <Pressable key={name} accessibilityRole="button"
              accessibilityLabel={`${name} ${year}`} disabled={!validYear} accessibilityState={{ disabled: !validYear, selected: index === month.getMonth() && Number(year) === month.getFullYear() }}
              onPress={() => { setMonth(new Date(Number(year), index, 1)); setJump(false); Keyboard.dismiss(); }}
              style={({ pressed }) => [styles.monthChoice, index === month.getMonth() && Number(year) === month.getFullYear() && styles.selectedMonth, pressed && styles.pressed, !validYear && styles.pressed]}>
              <ThemedText style={styles.dayText}>{name}</ThemedText>
            </Pressable>)}</View>
            {!validYear && <ThemedText style={styles.caption}>Enter a year from 1000 to 9999.</ThemedText>}
          </View> : <View>
            <View style={styles.weekRow}>
              {weekdays.map((day) => <View key={day} style={styles.weekdayCell}><ThemedText style={styles.weekday}>{day}</ThemedText></View>)}
            </View>
            {weeks.map((week) => <View key={week[0].toISOString()} style={styles.weekRow}>{week.map((day) => {
              const selected = sameDay(day, selectedDate);
              return <Pressable key={day.toISOString()} accessibilityRole="button" accessibilityLabel={day.toLocaleDateString(undefined, { dateStyle: "full" })}
                  accessibilityState={{ selected }} onPress={() => chooseDay(day)}
                  style={({ pressed }) => [styles.day, sameDay(day, today) && styles.today, selected && styles.selectedDay, pressed && styles.pressed]}>
                  <ThemedText numberOfLines={1} adjustsFontSizeToFit style={[styles.dayText, styles.dayNumber, day.getMonth() !== month.getMonth() && styles.outsideDay, selected && styles.selectedDayText]}>{day.getDate()}</ThemedText>
              </Pressable>;
            })}</View>)}
          </View>}
          <Pressable accessibilityRole="button" accessibilityLabel="Choose today" onPress={() => chooseDay(today)}
            style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}>
            <ThemedText style={styles.todayText}>Today</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: 12 },
  row: { flexDirection: "row", gap: 10 },
  stackedRow: { flexDirection: "column" },
  stackedField: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  dateField: { flex: 1.2, minWidth: 0, gap: 8 },
  timeField: { flex: 1, minWidth: 0, gap: 8 },
  input: { ...dialogStyles.input, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 48 },
  activeInput: { borderColor: COLOR.muted, backgroundColor: COLOR.elevated },
  dateText: { flex: 1, fontSize: 14, fontWeight: "600" },
  caption: { fontSize: 12, color: COLOR.muted },
  pressed: { opacity: 0.55 },
  selectedMonth: { backgroundColor: COLOR.elevated, borderColor: COLOR.muted },
  calendar: { backgroundColor: COLOR.bg, borderRadius: 10, borderWidth: 1, borderColor: COLOR.border, padding: 12, gap: 12 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthHeading: { flex: 1, minWidth: 0, justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  monthTitle: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
  monthButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekRow: { flexDirection: "row" },
  weekdayCell: { flex: 1, minWidth: 0, height: 28, alignItems: "center", justifyContent: "center" },
  weekday: { color: COLOR.muted, fontSize: 11 },
  day: { flex: 1, minWidth: 0, height: 40, marginVertical: 1, borderRadius: 7, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  today: { borderColor: COLOR.muted },
  selectedDay: { backgroundColor: COLOR.primary, borderColor: COLOR.primary },
  dayText: { fontSize: 13 },
  dayNumber: { width: "100%", textAlign: "center", fontVariant: ["tabular-nums"] },
  outsideDay: { color: COLOR.muted, opacity: 0.5 },
  selectedDayText: { color: COLOR.onPrimary, fontWeight: "600", opacity: 1 },
  jump: { gap: 12 },
  yearRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  yearInput: { flex: 1, minWidth: 0, color: COLOR.text, fontSize: 18, fontWeight: "600", borderWidth: 1, borderColor: COLOR.border, borderRadius: 7, height: 44, paddingHorizontal: 12 },
  monthChoice: { width: "33.333333%", minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 7, borderWidth: 1, borderColor: "transparent" },
  todayButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderColor: COLOR.border },
  todayText: { fontSize: 13, fontWeight: "600" },
});
