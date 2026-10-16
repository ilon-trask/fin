import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, View } from "react-native";

const MIN_VISIBLE_OVERVIEW_HEIGHT = 100;
const DRAG_THRESHOLD = 10;
const FLING_VELOCITY = 0.5;

export function useExpenseSheet(overviewHeight: number, viewportHeight: number, dialogOpen: boolean) {
  const sheetTravel = Math.max(0, Math.min(overviewHeight, viewportHeight - MIN_VISIBLE_OVERVIEW_HEIGHT));
  const [scrollY] = useState(() => new Animated.Value(0));
  const [expensesExpanded, setExpensesExpanded] = useState(false);
  const expenseSheet = useRef<View>(null);
  const sheetPosition = useRef(0);
  const dragStart = useRef(0);
  const listOffset = useRef(0);

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      sheetPosition.current = value;
    });
    return () => scrollY.removeListener(listener);
  }, [scrollY]);

  const settleSheet = useCallback((expanded: boolean) => {
    setExpensesExpanded(false);
    Animated.spring(scrollY, {
      toValue: expanded ? sheetTravel : 0,
      stiffness: 260,
      damping: 28,
      mass: 1,
      overshootClamping: true,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setExpensesExpanded(expanded);
    });
  }, [scrollY, sheetTravel]);

  // Gesture callbacks need the latest animated position and scroll offset.
  // eslint-disable-next-line react-hooks/refs
  const sheetGesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (dialogOpen || gesture.numberActiveTouches !== 1) return false;
      const verticalDrag = Math.abs(gesture.dy) > DRAG_THRESHOLD
        && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5;
      return verticalDrag && (sheetPosition.current < sheetTravel - 1
        || (gesture.dy > 0 && listOffset.current <= 0));
    },
    onPanResponderGrant: () => {
      dragStart.current = sheetPosition.current;
      scrollY.stopAnimation((value) => {
        dragStart.current = value;
      });
      setExpensesExpanded(false);
    },
    onPanResponderMove: (_, gesture) => {
      scrollY.setValue(Math.max(0, Math.min(sheetTravel, dragStart.current - gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      const expanded = Math.abs(gesture.vy) > FLING_VELOCITY
        ? gesture.vy < 0
        : sheetPosition.current > sheetTravel / 2;
      settleSheet(expanded);
    },
    onPanResponderTerminate: () => settleSheet(sheetPosition.current > sheetTravel / 2),
  }), [dialogOpen, scrollY, settleSheet, sheetTravel]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const element = expenseSheet.current as unknown as HTMLElement | null;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (!expensesExpanded || (event.deltaY < 0 && listOffset.current <= 0)) {
        event.preventDefault();
        settleSheet(event.deltaY > 0);
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [expensesExpanded, settleSheet]);

  return { scrollY, expenseSheet, listOffset, expensesExpanded, sheetTravel, sheetGesture };
}
