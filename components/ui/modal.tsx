import { COLOR } from "@/constants/tokens";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal as RNModal,
  ModalProps as RNModalProps,
  StyleSheet,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import ThemedText from "./themed-text";

interface ModalProps extends RNModalProps {
  showModal: boolean;
  onClose: () => void;
  title: string;
}

function Modal({ onClose, showModal, title, style, children, ...props }: ModalProps) {
  const { width, height } = useWindowDimensions();
  const dialogWidth = Math.min(width - 40, 420);

  return (
    <RNModal
      {...props}
      style={[style, { flex: 1, width, height, alignItems: "stretch" }]}
      animationType="fade"
      transparent={true}
      visible={showModal}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.keyboard, { width, height }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.bg, { width }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Dismiss dialog"
          />
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.container,
              { width: dialogWidth, minWidth: dialogWidth, maxHeight: height - 40 },
            ]}
          >
            <View style={styles.header}>
              <ThemedText style={styles.title}>{title}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                onPress={onClose}
                style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
              >
                <ThemedText style={styles.closeText}>×</ThemedText>
              </Pressable>
            </View>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

export default Modal;

const styles = StyleSheet.create({
  keyboard: { flex: 1, alignSelf: "stretch" },
  bg: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    padding: 20,
  },
  container: {
    flexShrink: 1,
    backgroundColor: COLOR.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 24,
    gap: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 12,
  },
  header: { width: "100%", flexDirection: "row", alignItems: "center", gap: 16 },
  title: { flex: 1, fontSize: 22, fontWeight: "600" },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 24, lineHeight: 28 },
  body: { width: "100%", flexShrink: 1 },
  content: { gap: 20 },
});
