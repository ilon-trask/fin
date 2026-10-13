import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { Platform } from "react-native";
import { startSync } from "@/data/sync/service";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { COLOR } from "@/constants/tokens";

void SystemUI.setBackgroundColorAsync(COLOR.bg);

export default function RootLayout() {
  useEffect(() => startSync(), []);
  useEffect(() => {
    if (Platform.OS === "web" && !__DEV__ && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Offline app shell could not be installed", error));
    }
  }, []);
  const [loaded, error] = useFonts({
    "Google-Sans-Code": require("../assets/fonts/GoogleSansCode-VariableFont_MONO,wght.ttf"),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLOR.bg },
        }}
      />
    </>
  );
}
