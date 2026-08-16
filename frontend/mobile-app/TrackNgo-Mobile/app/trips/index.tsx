import React from "react";
import { View, StyleSheet } from "react-native";
import { LocalizedText as Text } from "../../utils/i18n";

export default function PlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F7F9",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
});
