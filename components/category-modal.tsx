import { Category } from "@/types/entities";
import React, { useEffect, useRef, useState } from "react";
import {
  ModalProps as RNModalProps,
  TextInput,
  View,
} from "react-native";
import ColorPicker from "./color-picker";
import Button from "./ui/button";
import Modal from "./ui/modal";
import ThemedInput from "./ui/themed-Input";
import ThemedText from "./ui/themed-text";
import { dialogStyles as styles } from "./ui/dialog-styles";

interface ModalProps extends RNModalProps {
  showModal: boolean;
  onClose: () => void;
  onSave: (expense: Category) => void;
  category: Category;
}

function CategoryModal({ category, onSave, showModal, ...props }: ModalProps) {
  const [localCategory, setLocalCategory] = useState<Category>(category);
  const giveColor = (color: string) =>
    setLocalCategory((prev) => ({ ...prev, color }));
  useEffect(() => {
    console.log(category);

    setLocalCategory(category);
  }, [category]);

  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        if (!nameInputRef.current) throw new Error("no amountInputRef");
        nameInputRef.current.focus();
      }, 100);
    }
  }, [showModal]);

  const save = (data: Category) => {
    if (data.name) onSave(data);
  };

  return (
    <Modal showModal={showModal} {...props} title="Add category">
      <View style={styles.field}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ThemedText style={styles.label}>Color</ThemedText>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: localCategory.color }} />
        </View>
        <View style={{ paddingVertical: 12 }}>
          <ColorPicker giveColor={giveColor} />
        </View>
      </View>
      <View style={styles.field}>
        <ThemedText style={styles.label}>Name</ThemedText>
        <ThemedInput
          style={styles.input}
          ref={nameInputRef}
          placeholder="döner"
          value={localCategory.name}
          onSubmitEditing={() => save(localCategory)}
          onChangeText={(e) =>
            setLocalCategory((prev) => ({ ...prev, name: e }))
          }
        />
      </View>
      <Button style={styles.save} onPress={() => save(localCategory)}>
        <ThemedText style={styles.saveText}>Save</ThemedText>
      </Button>
    </Modal>
  );
}

export default CategoryModal;
