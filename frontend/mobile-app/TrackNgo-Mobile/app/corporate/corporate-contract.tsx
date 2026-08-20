import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  Alert,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSession } from "../../store/sessionStore";
import { CorporateTabBar } from "../../components/CorporateTabBar";
import {
  type CorporateContract,
  type CorporateProfileDto,
  describeCompletedContract,
  displayContractStatus,
  formatAmount,
  formatContractDate,
  formatShiftTime,
  getCorporateContracts,
  getCorporateProfile,
  isAwaitingFinalization,
  isContractCompleted,
  isContractRunning,
} from "../../services/corporateApi";

// ─── Entrance animation hook ──────────────────────────────────────────────────

function useFadeSlide(delay: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 480, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 480, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, translateY]);
  return { opacity, translateY };
}

// ─── Status badge colours ─────────────────────────────────────────────────────

function statusBadge(status: CorporateContract["status"]): { bg: string; text: string } {
  switch (status?.toLowerCase()) {
    case "active":   return { bg: "#D1FAE5", text: "#065F46" };
    case "expired":  return { bg: "#FEE2E2", text: "#991B1B" };
    case "pending":  return { bg: "#FEF3C7", text: "#B45309" };
    case "cancelled": return { bg: "#F1F5F9", text: "#64748B" };
    default:         return { bg: "#D1FAE5", text: "#065F46" };
  }
}

// ─── Active Contract Card ─────────────────────────────────────────────────────

function ContractCard({
  contract,
  onPress,
  statusOverride,
}: {
  contract: CorporateContract;
  onPress?: () => void;
  /** Overrides the badge shown on the card — used for "Request Approved" while still pending finalization. */
  statusOverride?: { label: string; bg: string; text: string };
}) {
  const anim = useFadeSlide(120);
  const badge = statusOverride ?? statusBadge(contract.status);
  const displayStatus = statusOverride?.label ?? displayContractStatus(contract.status);
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 20 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18 }).start();

  return (
    <Animated.View
      style={[
        styles.contractCard,
        { opacity: anim.opacity, transform: [{ translateY: anim.translateY }, { scale }] },
      ]}
    >
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
        {/* Top row */}
        <View style={styles.cardTopRow}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>ROUTE</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: badge.text }]} />
            <Text style={[styles.statusText, { color: badge.text }]}>{displayStatus}</Text>
          </View>
          <View style={styles.menuBtn}>
            {onPress && <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />}
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeRow}>
          <Text style={styles.routeCity} numberOfLines={1}>{contract.startingLocation}</Text>
          <Ionicons name="arrow-forward" size={16} color="#1E293B" style={styles.routeArrow} />
          <Text style={styles.routeCity} numberOfLines={1}>{contract.destination}</Text>
        </View>

        {/* Contract name */}
        <Text style={styles.contractName} numberOfLines={1}>{contract.contractName}</Text>

        {/* Shift times */}
        <View style={styles.shiftRow}>
          <Ionicons name="time-outline" size={13} color="#94A3B8" />
          <Text style={styles.shiftText}>
            {formatShiftTime(contract.startShiftTime)} – {formatShiftTime(contract.endShiftTime)}
          </Text>
        </View>

        {/* Dates */}
        <View style={styles.datesRow}>
          <View>
            <Text style={styles.dateLabel}>START DATE</Text>
            <Text style={styles.dateValue}>{formatContractDate(contract.startDate)}</Text>
          </View>
          <View style={styles.dateDivider} />
          <View>
            <Text style={styles.dateLabel}>END DATE</Text>
            <Text style={styles.dateValue}>{formatContractDate(contract.endDate)}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── History Row ──────────────────────────────────────────────────────────────

function HistoryRow({
  contract,
  onPress,
}: {
  contract: CorporateContract;
  onPress?: () => void;
}) {
  const { label, colour } = describeCompletedContract(contract);

  return (
    <Pressable
      style={({ pressed }) => [styles.historyRow, pressed && styles.historyRowPressed]}
      onPress={onPress}
    >
      <View style={styles.historyIconCircle}>
        <MaterialCommunityIcons name="history" size={18} color="#94A3B8" />
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyRoute} numberOfLines={1}>
          {contract.startingLocation} → {contract.destination}
        </Text>
        <Text style={styles.historyName} numberOfLines={1}>{contract.contractName}</Text>
        <Text style={styles.historyPeriod}>
          {formatContractDate(contract.startDate)} – {formatContractDate(contract.endDate)}
        </Text>
      </View>
      <View style={styles.historyRight}>
        <Text style={[styles.historyOutcome, { color: colour }]}>{label}</Text>
        <Text style={styles.historyAmount}>{formatAmount(contract.billingAmount)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CorporateContractScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { currentUser } = useSession();

  const [contracts, setContracts] = useState<CorporateContract[]>([]);
  const [profile, setProfile] = useState<CorporateProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Deep link support: /corporate/corporate-contract?section=active scrolls
  // straight to the Active Contracts block (used by the dashboard stat cards).
  const scrollRef = useRef<ScrollView>(null);
  const activeSectionY = useRef(0);
  const didAutoScroll = useRef(false);

  const headerAnim = useFadeSlide(0);
  const heroAnim = useFadeSlide(60);
  const activeAnim = useFadeSlide(140);
  const historyAnim = useFadeSlide(220);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!currentUser?.userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        // The profile is only needed for the "create contract" completeness check,
        // so a profile failure must not blank out the contract list.
        const [contractsData, profileData] = await Promise.all([
          getCorporateContracts(currentUser.userId),
          getCorporateProfile(currentUser.userId).catch((err) => {
            console.warn("[CorporateContract] Failed to load profile:", err);
            return null;
          }),
        ]);
        setContracts(contractsData);
        setProfile(profileData);
      } catch (err) {
        console.error("[CorporateContract] Failed to load data:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser],
  );

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  // Scroll once the list has rendered, so the measured section offset is real.
  useEffect(() => {
    if (loading || section !== "active" || didAutoScroll.current) return;
    didAutoScroll.current = true;
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(activeSectionY.current - 12, 0),
        animated: true,
      });
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [loading, section]);

  const handleCreateContract = () => {
    if (!profile) {
      Alert.alert(
        "Profile Unavailable",
        "We could not load your company profile. Pull down to refresh and try again.",
      );
      return;
    }


    const isProfileComplete = 
      profile.businessRegistrationNumber && 
      profile.industry && 
      profile.address &&
      profile.contactPersonDesignation &&
      profile.contactPhone;
    
    if (!isProfileComplete) {
      Alert.alert(
        "Profile Incomplete",
        "Please complete your Company Information (Registration Number, Industry, Address) and Contact Person Details (Designation, Phone Number) before creating a contract.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Complete Profile", onPress: () => router.push("/corporate/corporate-profile") }
        ]
      );
      return;
    }

    router.push("/corporate/new-contract");
  };

  const activeContracts = contracts.filter(isContractRunning);
  // Stays here as "Request Approved" once admin approves, until the user
  // finalizes it in the negotiation screen — only then does it move to Active.
  const pendingContracts = contracts.filter(
    (c) => c.status?.toLowerCase() === "pending" || isAwaitingFinalization(c),
  );
  // Finished contracts, most recently ended first.
  const historyContracts = contracts
    .filter(isContractCompleted)
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""));

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { opacity: headerAnim.opacity, transform: [{ translateY: headerAnim.translateY }] },
        ]}
      >
        <Text style={styles.headerTitle}>Contracts</Text>
        <View style={styles.logoMark}>
          <Ionicons name="bus" size={16} color="#FFFFFF" />
        </View>
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#067BF9"
          />
        }
      >
        {/* Create New Contract Hero */}
        <Animated.View
          style={{ opacity: heroAnim.opacity, transform: [{ translateY: heroAnim.translateY }] }}
        >
          <TouchableOpacity
            style={styles.heroCard}
            activeOpacity={0.88}
            onPress={handleCreateContract}
          >
            <View style={styles.heroIconBox}>
              <MaterialCommunityIcons name="file-document-edit-outline" size={26} color="#067BF9" />
            </View>
            <Text style={styles.heroLabel}>Create New Contract</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" style={styles.heroChevron} />
          </TouchableOpacity>
        </Animated.View>

        {/* Loading */}
        {loading && (
          <ActivityIndicator size="large" color="#067BF9" style={{ marginTop: 40 }} />
        )}

        {/* Pending Contracts */}
        {!loading && (
          <Animated.View
            style={{ opacity: activeAnim.opacity, transform: [{ translateY: activeAnim.translateY }], marginBottom: 24 }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Contracts</Text>
              {pendingContracts.length > 0 && (
                <View style={[styles.runningBadge, { backgroundColor: "#FEF3C7" }]}>
                  <View style={[styles.runningDot, { backgroundColor: "#D97706" }]} />
                  <Text style={[styles.runningText, { color: "#92400E" }]}>{pendingContracts.length} IN NEGOTIATION</Text>
                </View>
              )}
            </View>

            <View style={styles.contractList}>
              {pendingContracts.length > 0 ? (
                pendingContracts.map((c) => (
                  <ContractCard
                    key={c.contractId}
                    contract={c}
                    statusOverride={
                      isAwaitingFinalization(c)
                        ? { label: "Request Approved", bg: "#DBEAFE", text: "#1D4ED8" }
                        : undefined
                    }
                    onPress={() => router.push(`/corporate/new-contract?contractId=${c.contractId}&step=3`)}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="time-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No pending contracts</Text>
                  <Text style={styles.emptySubText}>
                    Contracts awaiting admin approval will appear here.
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Active Contracts */}
        {!loading && (
          <Animated.View
            onLayout={(event) => {
              activeSectionY.current = event.nativeEvent.layout.y;
            }}
            style={{ opacity: activeAnim.opacity, transform: [{ translateY: activeAnim.translateY }] }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Contracts</Text>
              {activeContracts.length > 0 && (
                <View style={styles.runningBadge}>
                  <View style={styles.runningDot} />
                  <Text style={styles.runningText}>{activeContracts.length} RUNNING</Text>
                </View>
              )}
            </View>

            <View style={styles.contractList}>
              {activeContracts.length > 0 ? (
                activeContracts.map((c) => (
                  <ContractCard
                    key={c.contractId}
                    contract={c}
                    onPress={() => router.push(`/corporate/contract-detail?contractId=${c.contractId}`)}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No active contracts</Text>
                  <Text style={styles.emptySubText}>
                    {pendingContracts.length > 0
                      ? "You have contracts waiting for approval."
                      : "Tap \"Create New Contract\" above to get started."}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Previous (completed) contracts */}
        {!loading && (
          <Animated.View
            style={{ opacity: historyAnim.opacity, transform: [{ translateY: historyAnim.translateY }] }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Previous Contracts</Text>
              {historyContracts.length > 0 && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>
                    {historyContracts.length} COMPLETED
                  </Text>
                </View>
              )}
            </View>

            {historyContracts.length > 0 ? (
              <View style={styles.historyCard}>
                {historyContracts.map((contract, index) => (
                  <React.Fragment key={contract.contractId}>
                    <HistoryRow
                      contract={contract}
                      onPress={() =>
                        router.push(`/corporate/contract-detail?contractId=${contract.contractId}`)
                      }
                    />
                    {index < historyContracts.length - 1 && (
                      <View style={styles.historyDivider} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="history" size={36} color="#CBD5E1" />
                <Text style={styles.emptyText}>No previous contracts</Text>
                <Text style={styles.emptySubText}>
                  Contracts that have ended or been cancelled will be listed here.
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom Tab Bar */}
      <CorporateTabBar active="contracts" />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F0F2F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EDF3",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A", letterSpacing: -0.3 },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },

  // Hero card
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#067BF9",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 24,
    shadowColor: "#067BF9",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  heroIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  heroLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  heroChevron: { marginLeft: 8 },

  // Section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  runningBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  runningDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  runningText: { fontSize: 11, fontWeight: "700", color: "#10B981", letterSpacing: 0.5 },
  completedBadge: {
    backgroundColor: "#F1F5F9", borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  completedBadgeText: { fontSize: 11, fontWeight: "700", color: "#64748B", letterSpacing: 0.5 },

  contractList: { gap: 12, marginBottom: 28 },

  // Contract card
  contractCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  routeBadge: { backgroundColor: "#E0F0FF", borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  routeBadgeText: { fontSize: 10, fontWeight: "700", color: "#067BF9", letterSpacing: 0.8 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  menuBtn: { marginLeft: "auto", width: 20, alignItems: "flex-end" },
  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  routeCity: { fontSize: 18, fontWeight: "700", color: "#0F172A", flex: 1 },
  routeArrow: { marginHorizontal: 6 },
  contractName: { fontSize: 12, color: "#64748B", fontWeight: "500", marginBottom: 6 },
  shiftRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 12 },
  shiftText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  datesRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12, gap: 24 },
  dateDivider: { width: 1, height: 30, backgroundColor: "#E8EDF3", marginHorizontal: 4 },
  dateLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8", letterSpacing: 0.6, marginBottom: 3 },
  dateValue: { fontSize: 13, fontWeight: "600", color: "#1E293B" },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    gap: 6,
  },
  emptyText: { fontSize: 14, color: "#94A3B8", fontWeight: "600" },
  emptySubText: { fontSize: 12, fontWeight: "500", color: "#CBD5E1", textAlign: "center", paddingHorizontal: 20 },

  // History
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
  },
  historyRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  historyRowPressed: { backgroundColor: "#F8FAFC" },
  historyDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 16 },
  historyIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center",
  },
  historyInfo: { flex: 1 },
  historyRoute: { fontSize: 13, fontWeight: "700", color: "#1E293B", marginBottom: 2 },
  historyName: { fontSize: 11, fontWeight: "500", color: "#64748B", marginBottom: 2 },
  historyPeriod: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  historyRight: { alignItems: "flex-end", gap: 3 },
  historyOutcome: { fontSize: 11, fontWeight: "700" },
  historyAmount: { fontSize: 12, fontWeight: "700", color: "#1E293B" },

});
