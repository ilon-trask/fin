import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import {
  GestureResponderEvent,
  Platform,
  StyleSheet,
  View,
} from "react-native";

const colorStops = [
  [182, 150, 152], // rose
  [202, 135, 122], // coral
  [185, 126, 102], // terracotta
  [217, 168, 129], // peach
  [201, 161, 91], // amber
  [209, 192, 121], // straw
  [165, 172, 110], // olive
  [129, 169, 122], // leaf green
  [162, 180, 163], // sage
  [132, 189, 167], // mint
  [104, 164, 163], // teal
  [126, 184, 201], // aqua
  [140, 175, 211], // sky blue
  [112, 139, 185], // denim
  [145, 151, 204], // periwinkle
  [173, 160, 199], // lavender
  [158, 125, 180], // violet
  [177, 126, 161], // mauve
  [197, 134, 159], // dusty pink
  [182, 150, 152], // rose
];

export const customColorGradient = colorStops.map(
  ([r, g, b]) => `rgb(${r}, ${g}, ${b})`,
) as [string, string, ...string[]];
export const defaultCustomColor = customColorGradient[0];

function getColorAtPosition(position: number, stops: number[][]) {
  const segmentCount = stops.length - 1;
  const segment = Math.min(Math.floor(position * segmentCount), segmentCount - 1);
  const fraction = position * segmentCount - segment;
  const start = stops[segment];
  const end = stops[segment + 1];
  return start.map((component, index) =>
    Math.round(component + (end[index] - component) * fraction));
}

function toRgb(color: number[]) {
  return `rgb(${color.join(", ")})`;
}

function ColorSlider({
  gradient,
  position,
  onChange,
  label,
}: {
  gradient: [string, string, ...string[]];
  position: number;
  onChange: (position: number) => void;
  label: string;
}) {
  const [left, setLeft] = useState(0);
  const [width, setWidth] = useState(0);

  const updateFromGesture = (event: GestureResponderEvent) => {
    if (width <= 0) return;
    const x = Math.max(0, Math.min(width, event.nativeEvent.pageX - left));
    onChange(x / width);
  };
  const ref = useRef<View>(null);
  return (
    <View
      ref={ref}
      style={styles.container}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(position * 100) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const step = e.nativeEvent.actionName === "increment" ? 0.05 : -0.05;
        onChange(Math.max(0, Math.min(1, position + step)));
      }}
      pointerEvents="auto"
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
        ref.current?.measure((_x, _y, _width, _height, pageX) => setLeft(pageX));
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={updateFromGesture}
      onResponderMove={updateFromGesture}
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
          left: Math.max(0, Math.min(position * width - 14, width - 28)),
        }}
      />
      <LinearGradient
        style={styles.gradient}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        colors={gradient}
      />
    </View>
  );
}

export default function ColorPicker({ giveColor }: { giveColor: (color: string) => void }) {
  const [hue, setHue] = useState(0);

  return (
    <ColorSlider label="Color" gradient={customColorGradient} position={hue}
      onChange={(position) => {
        setHue(position);
        giveColor(toRgb(getColorAtPosition(position, colorStops)));
      }} />
  );
}

const styles = StyleSheet.create({
  container: {
    height: 20,
    width: "100%",
    position: "relative",
    ...(Platform.OS === "web" ? { touchAction: "none" } : {}),
  },
  gradient: { height: 20, width: "100%", position: "absolute", borderRadius: 10 },
});
