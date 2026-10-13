import Main from "@/screens/main";
import Settings from "@/screens/settings";
import Analytics from "@/screens/analytics";
import { COLOR } from "@/constants/tokens";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, PanResponder, Platform, StyleSheet, useWindowDimensions, View } from "react-native";

type Tab = "analytics" | "expenses" | "settings";
const pagePositions: Record<Tab, number> = { analytics: -1, expenses: 0, settings: 1 };

export default function Index() {
  const [tab, setTab] = useState<Tab>("expenses");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const width = layoutWidth || windowWidth;
  const [progress] = useState(() => new Animated.Value(0));
  const position = useRef(0);
  const dragStart = useRef(0);

  useEffect(() => {
    const listener = progress.addListener(({ value }) => { position.current = value; });
    return () => progress.removeListener(listener);
  }, [progress]);

  const navigate = useCallback((next: Tab) => {
    setTab(next);
    Animated.spring(progress, {
      toValue: pagePositions[next],
      stiffness: 260,
      damping: 28,
      mass: 1,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const startDrag = useCallback(() => {
    dragStart.current = position.current;
    progress.stopAnimation((value) => { dragStart.current = value; });
  }, [progress]);

  const moveDrag = useCallback((_: unknown, gesture: { dx: number }) => {
    progress.setValue(Math.max(-1, Math.min(1, dragStart.current - gesture.dx / width)));
  }, [progress, width]);

  // PanResponder registers these callbacks; refs are read only when a gesture runs.
  // eslint-disable-next-line react-hooks/refs
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (dialogOpen) return false;
      const movingToNextScreen = (tab !== "settings" && gesture.dx < -12)
        || (tab !== "analytics" && gesture.dx > 12);
      return gesture.numberActiveTouches === 1 && movingToNextScreen
        && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
    },
    onPanResponderGrant: startDrag,
    onPanResponderMove: moveDrag,
    onPanResponderRelease: (_, gesture) => {
      const direction = gesture.dx < 0 ? 1 : -1;
      const distance = Math.abs(gesture.dx);
      const velocity = gesture.vx * -direction;
      const shouldSwitch = distance > width * 0.25 || (distance > 20 && velocity > 0.5);
      const nextPosition = Math.max(-1, Math.min(1, pagePositions[tab] + direction));
      const next = nextPosition === -1 ? "analytics" : nextPosition === 1 ? "settings" : "expenses";
      navigate(shouldSwitch ? next : tab);
    },
    onPanResponderTerminate: () => navigate(tab),
  }), [dialogOpen, moveDrag, navigate, startDrag, tab, width]);

  useEffect(() => {
    if (tab === "expenses") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      navigate("expenses");
      return true;
    });
    return () => subscription.remove();
  }, [navigate, tab]);

  return (
    <View style={styles.app}>
      <View style={styles.viewport} onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)} {...panResponder.panHandlers}>
        <Animated.View style={[styles.pages, {
          width: width * 3,
          transform: [{ translateX: progress.interpolate({ inputRange: [-1, 1], outputRange: [0, -width * 2] }) }],
        }]}>
          <View style={[styles.screen, { width }]} pointerEvents={tab === "analytics" ? "auto" : "none"}
            accessibilityElementsHidden={tab !== "analytics"} importantForAccessibility={tab === "analytics" ? "auto" : "no-hide-descendants"}>
            <Analytics active={tab === "analytics"} onBack={() => navigate("expenses")} />
          </View>
          <View style={[styles.screen, { width }]} pointerEvents={tab === "expenses" ? "auto" : "none"}
            accessibilityElementsHidden={tab !== "expenses"} importantForAccessibility={tab === "expenses" ? "auto" : "no-hide-descendants"}>
            <Main onSettings={() => navigate("settings")} onAnalytics={() => navigate("analytics")} onDialogOpenChange={setDialogOpen} />
          </View>
          <View style={[styles.screen, { width }]} pointerEvents={tab === "settings" ? "auto" : "none"}
            accessibilityElementsHidden={tab !== "settings"} importantForAccessibility={tab === "settings" ? "auto" : "no-hide-descendants"}>
            <Settings onBack={() => navigate("expenses")} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLOR.bg },
  // CSS clip also prevents the browser from scrolling the pager to a focused button.
  viewport: { flex: 1, overflow: Platform.OS === "web" ? "clip" as "hidden" : "hidden" },
  pages: { flex: 1, flexDirection: "row" },
  screen: { height: "100%" },
});
