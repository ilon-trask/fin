import { Category, Expense } from "@/types/entities";
import { COLOR } from "@/constants/tokens";
import React, { useEffect, useRef, useState } from "react";
import {
  ModalProps as RNModalProps,
  TextInput,
  View,
} from "react-native";
import Button from "./ui/button";
import DatePickerAndTimePicker from "./ui/DatePickerAndTimePicker";
import Modal from "./ui/modal";
import ThemedInput from "./ui/themed-Input";
import ThemedText from "./ui/themed-text";
import { dialogStyles as styles } from "./ui/dialog-styles";

interface ModalProps extends RNModalProps {
  showModal: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  expense: Expense;
  categories?: Category[];
  description?: string;
}

function ExpenseModal({
  style,
  showModal,
  onClose,
  onSave,
  expense,
  categories,
  description,
  ...props
}: ModalProps) {
  const [localExpense, setLocalExpense] = useState<Expense>(expense);

  const amountInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (showModal) {
      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showModal]);

  const canSave = Number.isFinite(localExpense.amount) && localExpense.amount > 0
    && (!categories || categories.some((category) => category.id === localExpense.categoryId));

  return (
    <Modal
      {...props}
      style={style}
      animationType="fade"
      transparent={true}
      visible={showModal}
      onClose={onClose}
      showModal={showModal}
      title="Add expense"
    >
      {description && <ThemedText style={{ color: COLOR.muted, lineHeight: 20 }}>{description}</ThemedText>}
      {categories && (
        <View style={styles.field}>
          <ThemedText style={styles.label}>Choose a category</ThemedText>
          {categories.length === 0 && <ThemedText>Create a category on the main screen first.</ThemedText>}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.map((category) => (
              <Button key={category.id}
                style={{ minHeight: 40, backgroundColor: COLOR.elevated, borderWidth: 1, borderColor: localExpense.categoryId === category.id ? COLOR.text : COLOR.border }}
                onPress={() => setLocalExpense((previous) => ({ ...previous, categoryId: category.id }))}>
                <ThemedText>{category.name}</ThemedText>
              </Button>
            ))}
          </View>
        </View>
      )}
      <View style={styles.field}>
        <ThemedText style={styles.label}>Amount {localExpense.currency ? `(${localExpense.currency})` : ""}</ThemedText>
        <ThemedInput
          style={styles.input}
          ref={amountInputRef}
          keyboardType="numeric"
          placeholder="0.00"
          onSubmitEditing={() => canSave && onSave(localExpense)}
          value={localExpense.amount.toString()}
          onChangeText={(e) => {
            let res: string | number = e;
            if (res !== "") {
              res = +e;
              if (Number.isNaN(res)) {
                return;
              }
            }
            setLocalExpense((prev) => ({ ...prev, amount: res as number }));
          }}
        />
      </View>
      <View style={styles.field}>
        <DatePickerAndTimePicker
          value={localExpense.date}
          onChange={(date) =>
            setLocalExpense((prev) => ({ ...prev, date: date.toISOString() }))
          }
        />
      </View>
      <Button disabled={!canSave} style={[styles.save, { opacity: canSave ? 1 : 0.5 }]} onPress={() => canSave && onSave(localExpense)}>
        <ThemedText style={styles.saveText}>Save</ThemedText>
      </Button>
    </Modal>
  );
}

export default ExpenseModal;
