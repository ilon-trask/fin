import Main from "@/screens/main";
import Settings from "@/screens/settings";
import React, { useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";

function Divider() {
  return <View> divider</View>;
}

const data = [
  { id: "1", title: "Main", element: Main },
  { id: "2", title: "Settings", element: Settings },
];
export default function Index() {
  const { width, height } = useWindowDimensions();
  const [scrollEnabled, setScrollEnabled] = useState(true);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={styles.list}
        data={data}
        keyExtractor={(item) => item.id}
        scrollEnabled={scrollEnabled}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        snapToInterval={width}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width, minHeight: height }]}>
            <item.element
              disableParentScroll={() => {
                setScrollEnabled(false);
              }}
              enableParentScroll={() => setScrollEnabled(true)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  slide: {
    height: "100%",
    flex: 1,
  },
});
