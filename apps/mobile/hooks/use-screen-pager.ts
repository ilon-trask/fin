import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, PanResponder, useWindowDimensions } from "react-native";

export type Tab = "analytics" | "expenses" | "settings";

const PAGE_POSITION: Record<Tab, number> = {
  analytics: -1,
  expenses: 0,
  settings: 1,
};
const DRAG_THRESHOLD = 12;
const SWITCH_DISTANCE = 0.25;
const FLING_VELOCITY = 0.5;

function tabAt(position: number): Tab {
  if (position < 0) return "analytics";
  if (position > 0) return "settings";
  return "expenses";
}

export function useScreenPager(dialogOpen: boolean) {
  const [tab, setTab] = useState<Tab>("expenses");
  const { width: windowWidth } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const width = layoutWidth || windowWidth;
  const [progress] = useState(() => new Animated.Value(0));
  const position = useRef(0);
  const dragStart = useRef(0);

  useEffect(() => {
    const listener = progress.addListener(({ value }) => {
      position.current = value;
    });
    return () => progress.removeListener(listener);
  }, [progress]);

  const navigate = useCallback((next: Tab) => {
    setTab(next);
    Animated.spring(progress, {
      toValue: PAGE_POSITION[next],
      stiffness: 260,
      damping: 28,
      mass: 1,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const startDrag = useCallback(() => {
    dragStart.current = position.current;
    progress.stopAnimation((value) => {
      dragStart.current = value;
    });
  }, [progress]);

  const moveDrag = useCallback((_: unknown, gesture: { dx: number }) => {
    progress.setValue(Math.max(-1, Math.min(1, dragStart.current - gesture.dx / width)));
  }, [progress, width]);

  // PanResponder calls these later, when the refs contain current gesture state.
  // eslint-disable-next-line react-hooks/refs
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (dialogOpen || gesture.numberActiveTouches !== 1) return false;
      const towardAnotherTab = (tab !== "settings" && gesture.dx < -DRAG_THRESHOLD)
        || (tab !== "analytics" && gesture.dx > DRAG_THRESHOLD);
      return towardAnotherTab && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
    },
    onPanResponderGrant: startDrag,
    onPanResponderMove: moveDrag,
    onPanResponderRelease: (_, gesture) => {
      const direction = gesture.dx < 0 ? 1 : -1;
      const distance = Math.abs(gesture.dx);
      const velocity = gesture.vx * -direction;
      const shouldSwitch = distance > width * SWITCH_DISTANCE
        || (distance > 20 && velocity > FLING_VELOCITY);
      const nextPosition = Math.max(-1, Math.min(1, PAGE_POSITION[tab] + direction));
      navigate(shouldSwitch ? tabAt(nextPosition) : tab);
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

  return { tab, width, setLayoutWidth, progress, navigate, panResponder };
}
