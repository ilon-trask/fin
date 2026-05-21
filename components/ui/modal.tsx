import React from "react";
import {
    Pressable,
    Modal as RNModal,
    ModalProps as RNModalProps,
    StyleSheet,
    View,
} from "react-native";

interface ModalProps extends RNModalProps {
  showModal: boolean;
  onClose: () => void;
}

function Modal({ onClose, showModal, style, children, ...props }: ModalProps) {
  return (
    <RNModal
      {...props}
      style={[styles.modal, style]}
      animationType="fade"
      transparent={true}
      visible={showModal}
    >
      <Pressable style={styles.bg} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{}}>
          <View style={styles.content}>{children}</View>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

export default Modal;

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },
  bg: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  content: {
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
});
