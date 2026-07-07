import { Expense } from "@/types/entities";
import React, { useEffect, useRef, useState } from "react";
import {
  ModalProps as RNModalProps,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Button from "./ui/button";
import DatePickerAndTimePicker from "./ui/DatePickerAndTimePicker";
import Modal from "./ui/modal";
import ThemedInput from "./ui/themed-Input";
import ThemedText from "./ui/themed-text";

interface ModalProps extends RNModalProps {
  showModal: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  expense: Expense;
}

function ExpenseModal({
  style,
  showModal,
  onClose,
  onSave,
  expense,
  ...props
}: ModalProps) {
  const [localExpense, setLocalExpense] = useState<Expense>(expense);

  useEffect(() => {
    setLocalExpense(expense);
  }, [expense]);

  const amountInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        if (!amountInputRef.current) return;
        amountInputRef.current.focus();
      }, 100);
    }
  }, [showModal]);

  return (
    <Modal
      {...props}
      style={style}
      animationType="fade"
      transparent={true}
      visible={showModal}
      onClose={onClose}
      showModal={showModal}
    >
      <View style={styles.field}>
        <ThemedText>Amount</ThemedText>
        <ThemedInput
          ref={amountInputRef}
          keyboardType="numeric"
          placeholder="0.00"
          onSubmitEditing={() => onSave(localExpense)}
          value={localExpense.amount.toString()}
          onChangeText={(text) => {
            if (text === "") {
              setLocalExpense((prev) => ({ ...prev, amount: 0 }));
              return;
            }

            const amount = Number(text);
            if (Number.isNaN(amount)) return;

            setLocalExpense((prev) => ({ ...prev, amount }));
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
      <Button onPress={() => onSave(localExpense)}>
        <ThemedText>Save</ThemedText>
      </Button>
    </Modal>
  );
}

export default ExpenseModal;

const styles = StyleSheet.create({
  field: {
    width: "100%",
    gap: 4,
  },
});
