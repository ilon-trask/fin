import { Category } from "@/types/entities";
import { COLOR } from "@/constants/tokens";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ModalProps as RNModalProps,
  TextInput,
  Pressable,
  View,
} from "react-native";
import ColorPicker, { customColorGradient, defaultCustomColor } from "./color-picker";
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

const presetColors = [
  ["Gray", "#A1A1AA"], ["Sage", "#A2B4A3"], ["Sand", "#C8B38E"],
  ["Rose", "#B69698"], ["Blue", "#A0ABCF"], ["Lavender", "#ADA0C7"],
];

function CategoryModal({ category, onSave, showModal, ...props }: ModalProps) {
  const [localCategory, setLocalCategory] = useState<Category>(category);
  const [customColor, setCustomColor] = useState(false);
  const [savedCustomColor, setSavedCustomColor] = useState<string | null>(() =>
    presetColors.some(([, color]) => color === category.color) ? null : category.color,
  );
  const hasCustomColor = !presetColors.some(([, color]) => color === localCategory.color);
  const giveColor = (color: string) =>
    setLocalCategory((prev) => ({ ...prev, color }));
  const selectPreset = (color: string) => {
    giveColor(color);
    setCustomColor(false);
  };
  const selectCustom = () => {
    giveColor(savedCustomColor ?? defaultCustomColor);
    setSavedCustomColor(savedCustomColor ?? defaultCustomColor);
    setCustomColor((prev) => hasCustomColor ? !prev : true);
  };
  const changeCustomColor = (color: string) => {
    setSavedCustomColor(color);
    giveColor(color);
  };

  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (showModal) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showModal]);

  const save = (data: Category) => {
    if (data.name) onSave(data);
  };

  return (
    <Modal showModal={showModal} {...props} title="Add category">
      <View style={styles.field}>
        <ThemedText style={styles.label}>Name</ThemedText>
        <ThemedInput
          style={styles.input}
          ref={nameInputRef}
          placeholder="e.g. Food & drinks"
          value={localCategory.name}
          onSubmitEditing={() => save(localCategory)}
          onChangeText={(e) =>
            setLocalCategory((prev) => ({ ...prev, name: e }))
          }
        />
      </View>
      <View style={styles.field}>
        <ThemedText style={styles.label}>Color</ThemedText>
        <View style={{ flexDirection: "row", gap: 3 }}>
          {presetColors.map(([name, color]) => (
            <Pressable key={color} accessibilityRole="button" accessibilityLabel={`${name} color`}
              accessibilityState={{ selected: localCategory.color === color }} onPress={() => selectPreset(color)}
              style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: localCategory.color === color ? COLOR.text : "transparent" }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color }} />
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Choose a custom color"
            accessibilityState={{ selected: hasCustomColor, expanded: customColor }}
            onPress={selectCustom}
            style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: hasCustomColor ? COLOR.text : "transparent" }}>
            {savedCustomColor ? (
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: savedCustomColor, alignItems: "center", justifyContent: "center" }}>
                <Feather name="plus" size={14} color="#FFFFFF" />
              </View>
            ) : (
              <LinearGradient colors={customColorGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>
                <Feather name="plus" size={14} color="#FFFFFF" />
              </LinearGradient>
            )}
          </Pressable>
        </View>
        <View style={{ paddingVertical: 12, display: customColor ? "flex" : "none" }}>
          <ColorPicker giveColor={changeCustomColor} />
        </View>
      </View>
      <Button disabled={!localCategory.name.trim()} style={styles.save} onPress={() => save(localCategory)}>
        <ThemedText style={styles.saveText}>Save</ThemedText>
      </Button>
    </Modal>
  );
}

export default CategoryModal;
