import { COLOR } from "@/constants/tokens";
import React from "react";
import { Pressable, PressableProps, StyleSheet } from "react-native";

type ButtonProps = PressableProps;

function Button({ children, style, ...props }: ButtonProps) {
  return (
    <Pressable
      style={
        typeof style === "function"
          ? (state) => [styles.button, style(state)]
          : ({ pressed }) => [styles.button, style, { opacity: props.disabled ? 0.4 : pressed ? 0.75 : 1 }]
      }
      {...props}
    >
      {typeof children === "function" ? (state) => children(state) : children}
    </Pressable>
  );
}

export default Button;

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLOR.primary,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
});
