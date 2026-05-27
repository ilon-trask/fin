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
        if (!amountInputRef.current) throw new Error("no amountInputRef");
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
