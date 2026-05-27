import { COLOR, SIZE } from "@/constants/tokens";
import React from "react";
import { Pressable, PressableProps, StyleSheet } from "react-native";

interface ButtonProps extends PressableProps {}

function Button({ children, style, ...props }: ButtonProps) {
  return (
    <Pressable
      style={
        typeof style === "function"
          ? (state) => [style(state), styles.button]
          : [style, styles.button]
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
    color: "black",
    justifyContent: "center",
    alignItems: "center",
    height: SIZE["64"],
    paddingHorizontal: 16,
  },
});
