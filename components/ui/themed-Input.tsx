import { COLOR, SIZE } from "@/constants/tokens";
import React, { forwardRef } from "react";
import { StyleSheet, TextInput, TextInputProps } from "react-native";

type InputProps = TextInputProps;

const ThemedInput = forwardRef(function TemedInput(
  { style, ...props }: InputProps,
  ref: React.Ref<TextInput>,
) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={"#888"}
      style={[styles.input, style]}
      {...props}
    />
  );
});

export default ThemedInput;

const styles = StyleSheet.create({
  input: {
    minHeight: SIZE["64"],
    backgroundColor: COLOR.text,
  },
});
