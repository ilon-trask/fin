import { amountFractionDigits } from "@/utils/money";
import { Category, Expense } from "@/types/entities";
import { COLOR } from "@/constants/tokens";
import React, { useEffect, useRef, useState } from "react";
import {
  ModalProps as RNModalProps,
  TextInput,
  View,
} from "react-native";
import Button from "./ui/button";
import CategorySelect, { CategorySelectHandle } from "./category-select";
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
  editing?: boolean;
}

function ExpenseModal({
  style,
  showModal,
  onClose,
  onSave,
  expense,
  categories,
  description,
  editing = false,
  ...props
}: ModalProps) {
  const [localExpense, setLocalExpense] = useState<Expense>(expense);
  const [amountText, setAmountText] = useState(() => expense.amount === 0 ? "" : expense.amount.toString());

  const amountInputRef = useRef<TextInput>(null);
  const categorySelectRef = useRef<CategorySelectHandle>(null);

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
      title={editing ? "Edit expense" : "Add expense"}
      onInteractionStart={({ nativeEvent }) => {
        categorySelectRef.current?.dismissIfOutside(nativeEvent.pageX, nativeEvent.pageY);
      }}
    >
      {description && <ThemedText style={{ color: COLOR.muted, lineHeight: 20 }}>{description}</ThemedText>}
      {categories && (
        <View style={styles.field}>
          <ThemedText style={styles.label}>Category</ThemedText>
          {categories.length === 0 && <ThemedText>Create a category on the main screen first.</ThemedText>}
          <CategorySelect ref={categorySelectRef} categories={categories} value={localExpense.categoryId}
            onChange={(categoryId) => setLocalExpense((previous) => ({ ...previous, categoryId }))} />
        </View>
      )}
      <View style={styles.field}>
        <ThemedText style={styles.label}>Amount {localExpense.currency ? `(${localExpense.currency})` : ""}</ThemedText>
        <ThemedInput
          accessibilityLabel="Amount"
          style={styles.input}
          ref={amountInputRef}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0.00"
          onSubmitEditing={() => canSave && onSave(localExpense)}
          value={amountText}
          onChangeText={(text) => {
            if (!new RegExp(`^\\d*(?:[.,]\\d{0,${amountFractionDigits(localExpense.currency)}})?$`).test(text)) return;
            setAmountText(text);
            const amount = Number(text.replace(",", "."));
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
      <Button disabled={!canSave} style={[styles.save, { opacity: canSave ? 1 : 0.5 }]} onPress={() => canSave && onSave(localExpense)}>
        <ThemedText style={styles.saveText}>Save</ThemedText>
      </Button>
    </Modal>
  );
}

export default ExpenseModal;
