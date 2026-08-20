import React, { useEffect, useRef } from "react"; //useRef for animation values
import {
  Animated, //Animated for animations
  Easing,   //Easing for easing animations
  StyleSheet, 
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons"; // Ionicons for icons

export default function LandingScreen() {
  const router = useRouter();
  const logoScale = useRef(new Animated.Value(0.7)).current; // Initial scale for logo animation
  const logoOpacity = useRef(new Animated.Value(0)).current; // Initial opacity for logo animation
  const textOpacity = useRef(new Animated.Value(0)).current; // Initial opacity for text animation
  const barWidth = useRef(new Animated.Value(0)).current; // Initial width for progress bar animation 

  useEffect(() => {
    Animated.sequence([ // Sequence to run animations one after another
      Animated.parallel([ // Run logo scale and opacity animations together
        Animated.timing(logoScale, { // Animate logo scale means scale to 1
          toValue: 1, // Animate logo scale means scale to 1
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, { // Animate logo opacity means fade in to 1
          toValue: 1, // Animate logo opacity means fade in to 1
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1, // Animate text opacity means fade in to 1
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(barWidth, {
        toValue: 1, // Animate bar width means fill to 100%
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start(() => {
      router.replace('/login');
    });
  }, []); // Empty dependency array means this runs once on mount

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo circle */}
        <Animated.View
          style={[
            styles.logoCircle,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <View style={styles.logoInner}>
            <View style={styles.iconBox}>
              <Ionicons name="bus" size={40} color="#FFFFFF" />
              <View style={styles.pinBadge}>
                <Ionicons name="location" size={16} color="#FFFFFF" />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Brand text */}
        <Animated.View style={{ opacity: textOpacity, alignItems: "center" }}>
          <Text style={styles.brand}>TrackNGo</Text>
          <Text style={styles.tagline}>Driver Management</Text>
        </Animated.View>
      </View>

      {/* Progress bar */}
      <View style={styles.barContainer}>
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              {
                width: barWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F7F9",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 60,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#E8EFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  logoInner: {
    width: 110,
    height: 110,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#2F6BFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pinBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 6,
    fontWeight: "500",
  },
  barContainer: {
    width: 200,
    alignItems: "center",
  },
  barTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#2F6BFF",
  },
});
