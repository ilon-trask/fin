import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
    GestureResponderEvent,
    Pressable,
    StyleSheet,
    View,
} from "react-native";

const colors = [
  [255, 0, 0], // red
  [255, 255, 0], // yellow
  [0, 255, 0], // green
  [0, 255, 255], // cyan
  [0, 0, 255], // blue
  [255, 0, 255], // magenta
  [255, 0, 0], // red
];

function getColorAtPosition(x: number, width: number) {
  const t = Math.max(0, Math.min(1, x / width));

  const segmentCount = colors.length - 1;

  const segment = Math.min(
    Math.floor(t * segmentCount),

    segmentCount - 1,
  );

  const localT = t * segmentCount - segment;

  const c1 = colors[segment];

  const c2 = colors[segment + 1];

  const r = Math.round(c1[0] + (c2[0] - c1[0]) * localT);

  const g = Math.round(c1[1] + (c2[1] - c1[1]) * localT);

  const b = Math.round(c1[2] + (c2[2] - c1[2]) * localT);

  return `rgb(${r}, ${g}, ${b})`;
}

export default function ColorPicker({
  giveColor,
}: {
  giveColor: (color: string) => void;
}) {
  const [x, setX] = useState(0);
  const [left, setLeft] = useState(0);
  const [width, setWidth] = useState(0);

  const getX = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.pageX - left;
    if (x < 0 || x > width) return;
    setX(x);

    const color = getColorAtPosition(x, width);

    giveColor(color);
  };
  const ref: React.Ref<View> = useRef(null);
  ref.current?.measure((x, y, width, height, pageX) => {
    if (!left) setLeft(pageX);
  });
  return (
    <Pressable
      ref={ref}
      style={styles.container}
      pointerEvents="auto"
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
      }}
      onTouchStart={getX}
      onTouchMove={getX}
    >
      <View
        pointerEvents="none"
        style={{
          top: -4,
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 3,
          borderColor: "#FAFAF8",
          backgroundColor: "transparent",
          position: "absolute",
          zIndex: 2,
          left: Math.max(0, Math.min(x - 14, width - 28)),
        }}
      />
      <LinearGradient
        style={styles.gradient}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        colors={["red", "#ff0", "#0f0", "#0ff", "#00f", "#f0f", "red"]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { height: 20, width: "100%", position: "relative" },
  gradient: { height: 20, width: "100%", position: "absolute", borderRadius: 10 },
});
