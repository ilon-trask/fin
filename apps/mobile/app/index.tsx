import { useState } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import Analytics from "@/screens/analytics";
import Main from "@/screens/main";
import Settings from "@/screens/settings";
import { COLOR } from "@/constants/tokens";
import { useScreenPager, type Tab } from "@/hooks/use-screen-pager";

export default function Index() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { tab, width, setLayoutWidth, progress, navigate, panResponder } = useScreenPager(dialogOpen);
  const translateX = progress.interpolate({ inputRange: [-1, 1], outputRange: [0, -width * 2] });

  function pageProps(page: Tab) {
    const active = tab === page;
    return {
      style: [styles.screen, { width }],
      pointerEvents: active ? "auto" as const : "none" as const,
      accessibilityElementsHidden: !active,
      importantForAccessibility: active ? "auto" as const : "no-hide-descendants" as const,
    };
  }

  return (
    <View style={styles.app}>
      <View style={styles.viewport}
        onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
        {...panResponder.panHandlers}>
        <Animated.View style={[styles.pages, { width: width * 3, transform: [{ translateX }] }]}>
          <View {...pageProps("analytics")}>
            <Analytics active={tab === "analytics"} onBack={() => navigate("expenses")} />
          </View>
          <View {...pageProps("expenses")}>
            <Main onSettings={() => navigate("settings")}
              onAnalytics={() => navigate("analytics")}
              onDialogOpenChange={setDialogOpen} />
          </View>
          <View {...pageProps("settings")}>
            <Settings onBack={() => navigate("expenses")} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLOR.bg },
  // CSS clip also prevents the browser from scrolling to a focused button.
  viewport: { flex: 1, overflow: Platform.OS === "web" ? "clip" as "hidden" : "hidden" },
  pages: { flex: 1, flexDirection: "row" },
  screen: { height: "100%" },
});
