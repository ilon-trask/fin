import { Category } from "@/types/entities";
import React, { useEffect, useRef, useState } from "react";
import {
  ModalProps as RNModalProps,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import ColorPicker from "./color-picker";
import Button from "./ui/button";
import Modal from "./ui/modal";
import ThemedInput from "./ui/themed-Input";
import ThemedText from "./ui/themed-text";

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
    <Modal showModal={showModal} {...props}>
      <View style={styles.field}>
        <ThemedText style={{ color: localCategory.color }}>Color</ThemedText>
        <ColorPicker giveColor={giveColor} />
      </View>
      <View style={styles.field}>
        <ThemedText>Name</ThemedText>
        <ThemedInput
          ref={nameInputRef}
          placeholder="döner"
          value={localCategory.name}
          onSubmitEditing={() => save(localCategory)}
          onChangeText={(e) =>
            setLocalCategory((prev) => ({ ...prev, name: e }))
          }
        />
      </View>
      <Button onPress={() => save(localCategory)}>
        <ThemedText>Save</ThemedText>
      </Button>
    </Modal>
  );
}

export default CategoryModal;

const styles = StyleSheet.create({
  field: {
    width: "100%",
    gap: 4,
  },
});
