import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import ThemedText from "./themed-text";

type PickerMode = "date" | "time";

interface DatePickerAndTimePickerProps {
  value: Date | string;
  onChange: (date: Date) => void;
  dateLabel?: string;
  timeLabel?: string;
  style?: ViewStyle;
}

function parseDate(value: Date | string) {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? undefined : value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function mergeDateAndTime(current: Date, next: Date, mode: PickerMode) {
  const merged = new Date(current);

  if (mode === "date") {
    merged.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  } else {
    merged.setHours(next.getHours(), next.getMinutes(), 0, 0);
  }

  return merged;
}

//TODO: datePicker in browser

function DatePickerAndTimePicker({
  value,
  onChange,
  dateLabel = "Date",
  timeLabel = "Time",
  style,
}: DatePickerAndTimePickerProps) {
  const controlledDate = useMemo(() => parseDate(value), [value]);
  const [date, setDate] = useState(controlledDate ?? new Date());
  const [mode, setMode] = useState<PickerMode | null>(null);

  useEffect(() => {
    if (controlledDate) setDate(controlledDate);
  }, [controlledDate]);

  const selectedDate = controlledDate ?? date;

  const updateDate = (nextDate: Date) => {
    setDate(nextDate);
    onChange(nextDate);
  };

  const handleChange = (event: DateTimePickerEvent, nextDate?: Date) => {
    if (Platform.OS === "android") {
      setMode(null);
    }

    if (event.type === "dismissed" || !nextDate || !mode) return;

    updateDate(mergeDateAndTime(selectedDate, nextDate, mode));
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <View style={styles.field}>
          <ThemedText>{dateLabel}</ThemedText>
          <Pressable style={styles.input} onPress={() => setMode("date")}>
            <ThemedText style={styles.inputText}>
              {selectedDate.toLocaleDateString()}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.field}>
          <ThemedText>{timeLabel}</ThemedText>
          <Pressable style={styles.input} onPress={() => setMode("time")}>
            <ThemedText style={styles.inputText}>
              {selectedDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {mode ? (
        <View style={styles.picker}>
          <DateTimePicker
            value={selectedDate}
            mode={mode}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleChange}
          />
          {Platform.OS === "ios" ? (
            <Pressable style={styles.doneButton} onPress={() => setMode(null)}>
              <ThemedText style={styles.doneText}>Done</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default DatePickerAndTimePicker;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  field: {
    flex: 1,
    gap: 4,
  },
  input: {
    minHeight: 48,
    backgroundColor: "#eee",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  inputText: {
    color: "#111",
  },
  picker: {
    width: "100%",
  },
  doneButton: {
    alignSelf: "flex-end",
    backgroundColor: "#cfda00",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneText: {
    color: "#111",
  },
});
