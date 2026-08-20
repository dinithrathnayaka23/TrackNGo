import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getRatingContext,
  submitRating,
  type RatingContextDto,
} from "../../services/ratingsApi";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text, LocalizedTextInput as TextInput } from "../../utils/i18n";

/** Star picker used for the driver, bus, and journey rating rows. */
function StarPicker({
  value,
  onChange,
  size = 30,
}: {
  value: number;
  onChange: (next: number) => void;
  size?: number;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star)} hitSlop={6}>
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={size}
            color={star <= value ? "#F59E0B" : "#CBD5E1"}
            style={styles.starIcon}
          />
        </Pressable>
      ))}
    </View>
  );
}

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

export default function RateBookingScreen() {
  const router = useRouter();
  const { currentUser } = useSession();
  const params = useLocalSearchParams<{
    bookingRef?: string;
    from?: string;
    to?: string;
    busNumber?: string;
    date?: string;
    time?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [context, setContext] = useState<RatingContextDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [driverRating, setDriverRating] = useState(0);
  const [busRating, setBusRating] = useState(0);
  const [journeyRating, setJourneyRating] = useState(0);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    if (!params.bookingRef) {
      setError("Missing booking reference.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const ctx = await getRatingContext(params.bookingRef, currentUser?.userId);
      setContext(ctx);
      setDriverRating(ctx.driverRating ?? 0);
      setBusRating(ctx.busRating ?? 0);
      setJourneyRating(ctx.journeyRating ?? 0);
      setComment(ctx.comment ?? "");
    } catch (e) {
      console.error("[RateBooking] load error", e);
      setError("This booking isn't eligible for a rating yet.");
    } finally {
      setLoading(false);
    }
  }, [params.bookingRef, currentUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!params.bookingRef) {
      return;
    }
    if (context?.driverId && driverRating === 0) {
      Alert.alert("Rate your driver", "Please rate the driver before submitting.");
      return;
    }
    if (context?.busId && busRating === 0) {
      Alert.alert("Rate the bus", "Please rate the bus before submitting.");
      return;
    }
    if (journeyRating === 0) {
      Alert.alert("Rate your journey", "Please rate the overall journey before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      await submitRating(
        {
          bookingReference: params.bookingRef,
          driverRating: context?.driverId ? driverRating : undefined,
          busRating: context?.busId ? busRating : undefined,
          journeyRating,
          comment: comment.trim() || undefined,
        },
        currentUser?.userId,
      );
      Alert.alert(
        "Thank you!",
        "Your rating has been submitted.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e) {
      console.error("[RateBooking] submit error", e);
      Alert.alert("Submit failed", "Could not submit your rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const from = context?.startLocation ?? params.from;
  const to = context?.endLocation ?? params.to;
  const busNumber = context?.busNumber ?? params.busNumber;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Rate Your Trip</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2F6BFF" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#CBD5E1" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Trip summary */}
          <View style={styles.tripCard}>
            <View style={styles.routeRow}>
              <Text style={styles.routeText} numberOfLines={1}>
                {from}
              </Text>
              <Ionicons name="arrow-forward" size={14} color="#94A3B8" style={{ marginHorizontal: 8 }} />
              <Text style={styles.routeText} numberOfLines={1}>
                {to}
              </Text>
            </View>
            <View style={styles.tripMetaRow}>
              {params.date ? (
                <Text style={styles.tripMetaText}>{params.date}</Text>
              ) : null}
              {busNumber ? (
                <Text style={styles.tripMetaText}>Bus {busNumber}</Text>
              ) : null}
              {context?.bookingReference ? (
                <Text style={styles.tripMetaText}>{context.bookingReference}</Text>
              ) : null}
            </View>
          </View>

          {context?.alreadyRated ? (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={16} color="#2563EB" />
              <Text style={styles.infoBannerText}>
                You've already rated this trip. Submitting again will update your rating.
              </Text>
            </View>
          ) : null}

          {/* Driver rating */}
          {context?.driverId ? (
            <View style={styles.ratingSection}>
              <View style={styles.ratingSectionHeader}>
                <Ionicons name="person-circle-outline" size={20} color="#334155" />
                <Text style={styles.ratingSectionTitle}>
                  {context.driverName ? `Driver · ${context.driverName}` : "Driver"}
                </Text>
              </View>
              <StarPicker value={driverRating} onChange={setDriverRating} />
              <Text style={styles.ratingHint}>
                {driverRating ? RATING_LABELS[driverRating] : "Tap a star to rate"}
              </Text>
            </View>
          ) : null}

          {/* Bus rating */}
          {context?.busId ? (
            <View style={styles.ratingSection}>
              <View style={styles.ratingSectionHeader}>
                <Ionicons name="bus-outline" size={20} color="#334155" />
                <Text style={styles.ratingSectionTitle}>
                  {busNumber ? `Bus · ${busNumber}` : "Bus"}
                </Text>
              </View>
              <StarPicker value={busRating} onChange={setBusRating} />
              <Text style={styles.ratingHint}>
                {busRating ? RATING_LABELS[busRating] : "Tap a star to rate"}
              </Text>
            </View>
          ) : null}

          {/* Journey rating */}
          <View style={styles.ratingSection}>
            <View style={styles.ratingSectionHeader}>
              <Ionicons name="navigate-outline" size={20} color="#334155" />
              <Text style={styles.ratingSectionTitle}>Overall Journey</Text>
            </View>
            <StarPicker value={journeyRating} onChange={setJourneyRating} />
            <Text style={styles.ratingHint}>
              {journeyRating ? RATING_LABELS[journeyRating] : "Tap a star to rate"}
            </Text>
          </View>

          {/* Comment */}
          <Text style={styles.sectionLabel}>Additional Comments (optional)</Text>
          <TextInput
            multiline
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us more about your experience..."
            placeholderTextColor="#9CA3AF"
            style={styles.commentInput}
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {context?.alreadyRated ? "Update Rating" : "Submit Rating"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F6F7F9" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  errorText: { fontSize: 12, color: "#64748B", fontWeight: "600", textAlign: "center" },

  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },

  tripCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  routeText: { fontSize: 16, fontWeight: "700", color: "#1F2937", flexShrink: 1 },
  tripMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tripMetaText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
  },
  infoBannerText: { fontSize: 12, color: "#1D4ED8", flex: 1, lineHeight: 17 },

  ratingSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  ratingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  ratingSectionTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937" },
  starRow: { flexDirection: "row", gap: 6 },
  starIcon: { marginHorizontal: 2 },
  ratingHint: { fontSize: 12, color: "#94A3B8", fontWeight: "600", marginTop: 10 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 2,
  },
  commentInput: {
    minHeight: 100,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 18,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },

  submitButton: {
    backgroundColor: "#2F6BFF",
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 4,
  },
  submitButtonText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  submitButtonDisabled: { opacity: 0.8 },
});
