import React, { useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

const ACTION_WIDTH = 100;

export default function SwipeableItem() {
  const [translateX] = useState(() => new Animated.Value(0));

  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 10;
      },

      onPanResponderMove: (_, gesture) => {
        // Only allow left swipe
        const x = Math.max(-ACTION_WIDTH, Math.min(0, gesture.dx));
        translateX.setValue(x);
      },

      onPanResponderRelease: (_, gesture) => {
        const shouldOpen = gesture.dx < -ACTION_WIDTH / 2 || gesture.vx < -0.5;

        Animated.spring(translateX, {
          toValue: shouldOpen ? -ACTION_WIDTH : 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  );

  return (
    <View style={styles.container}>
      {/* Hidden action */}
      <View style={styles.actionContainer}>
        <Text style={styles.actionText}>Delete</Text>
      </View>

      {/* Swipeable content */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.item,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <Text>Swipe me left</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 70,
    overflow: "hidden",
  },
  actionContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    color: "white",
    fontWeight: "bold",
  },
  item: {
    flex: 1,
    backgroundColor: "white",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
