import { COLOR } from "@/constants/tokens";
import React from "react";
import { StyleSheet, Text, TextProps as TNTextProps } from "react-native";

interface TextProps extends TNTextProps {}

function ThemedText({ children, style, ...props }: TextProps) {
  return (
    <Text style={[styles.text, style]} {...props}>
      {children}
    </Text>
  );
}

export default ThemedText;

const styles = StyleSheet.create({
  text: {
    fontFamily: "Google-Sans-Code",
    color: COLOR.text,
  },
});
