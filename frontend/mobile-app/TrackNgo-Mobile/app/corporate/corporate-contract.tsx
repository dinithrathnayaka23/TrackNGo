import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSession } from "../../store/sessionStore";
import {
  type CorporateContract,
  displayContractStatus,
  formatContractDate,
  formatShiftTime,
  getCorporateContracts,
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
  switch (status) {
    case "active":   return { bg: "#D1FAE5", text: "#065F46" };
    case "expired":  return { bg: "#FEE2E2", text: "#991B1B" };
    case "pending":  return { bg: "#FEF3C7", text: "#B45309" };
    case "cancelled": return { bg: "#F1F5F9", text: "#64748B" };
    default:         return { bg: "#D1FAE5", text: "#065F46" };
  }
}

// ─── Active Contract Card ─────────────────────────────────────────────────────

function ContractCard({ contract }: { contract: CorporateContract }) {
  const anim = useFadeSlide(120);
  const badge = statusBadge(contract.status);
  const displayStatus = displayContractStatus(contract.status);
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
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
        {/* Top row */}
        <View style={styles.cardTopRow}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>ROUTE</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: badge.text }]} />
            <Text style={[styles.statusText, { color: badge.text }]}>{displayStatus}</Text>
          </View>
          <View style={styles.menuBtn} />
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

function HistoryRow({ contract }: { contract: CorporateContract }) {
  const label = displayContractStatus(contract.status);
  const colour =
    contract.status === "expired"
      ? "#EF4444"
      : contract.status === "cancelled"
      ? "#F59E0B"
      : "#10B981";

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyIconCircle}>
        <MaterialCommunityIcons name="history" size={18} color="#94A3B8" />
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyRoute}>
          {contract.startingLocation} → {contract.destination}
        </Text>
        <Text style={styles.historyPeriod}>
          {formatContractDate(contract.startDate)} – {formatContractDate(contract.endDate)}
        </Text>
      </View>
      <View style={styles.historyRight}>
        <Text style={styles.historyName} numberOfLines={1}>{contract.contractName}</Text>
        <Text style={[styles.historyOutcome, { color: colour }]}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CorporateContractScreen() {
  const router = useRouter();
  const { currentUser } = useSession();

  const [contracts, setContracts] = useState<CorporateContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerAnim = useFadeSlide(0);
  const heroAnim = useFadeSlide(60);
  const activeAnim = useFadeSlide(140);
  const historyAnim = useFadeSlide(220);

  const loadContracts = useCallback(
    async (isRefresh = false) => {
      if (!currentUser?.userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getCorporateContracts(currentUser.userId);
        setContracts(data);
      } catch (err) {
        console.error("[CorporateContract] Failed to load contracts:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser],
  );

  useFocusEffect(
    useCallback(() => {
      void loadContracts();
    }, [loadContracts]),
  );

  const activeContracts = contracts.filter(
    (c) => c.status === "active" || c.status === "pending",
  );
  const historyContracts = contracts.filter(
    (c) => c.status === "expired" || c.status === "cancelled",
  );

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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadContracts(true)}
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
            onPress={() => router.push("/corporate/new-contract")}
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

        {/* Active / Pending Contracts */}
        {!loading && (
          <Animated.View
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
                  <ContractCard key={c.contractId} contract={c} />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No active contracts</Text>
                  <Text style={styles.emptySubText}>
                    Tap "Create New Contract" above to get started.
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Contract History */}
        {!loading && historyContracts.length > 0 && (
          <Animated.View
            style={{ opacity: historyAnim.opacity, transform: [{ translateY: historyAnim.translateY }] }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Contract History</Text>
            </View>

            <View style={styles.historyCard}>
              {historyContracts.map((contract, index) => (
                <React.Fragment key={contract.contractId}>
                  <HistoryRow contract={contract} />
                  {index < historyContracts.length - 1 && (
                    <View style={styles.historyDivider} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push("/corporate/co-op-dashboard")}
        >
          <Ionicons name="grid-outline" size={22} color="#64748B" />
          <Text style={styles.tabLabel}>Dashboard</Text>
        </TouchableOpacity>

        {/* Contracts – active */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push("/corporate/corporate-contract")}
        >
          <Ionicons name="document-text" size={22} color="#067BF9" />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Contracts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push("/corporate/corporate-billing")}
        >
          <Ionicons name="receipt-outline" size={22} color="#64748B" />
          <Text style={styles.tabLabel}>Billing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push("/corporate/corporate-profile")}
        >
          <Ionicons name="person-outline" size={22} color="#64748B" />
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
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
  heroLabel: { flex: 1, fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  heroChevron: { marginLeft: 8 },

  // Section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A" },
  runningBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  runningDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  runningText: { fontSize: 11, fontWeight: "700", color: "#10B981", letterSpacing: 0.5 },

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
  statusText: { fontSize: 11, fontWeight: "600" },
  menuBtn: { marginLeft: "auto", width: 20 },
  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  routeCity: { fontSize: 17, fontWeight: "700", color: "#0F172A", flex: 1 },
  routeArrow: { marginHorizontal: 6 },
  contractName: { fontSize: 12, color: "#64748B", fontWeight: "500", marginBottom: 6 },
  shiftRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 12 },
  shiftText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  datesRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12, gap: 24 },
  dateDivider: { width: 1, height: 30, backgroundColor: "#E8EDF3", marginHorizontal: 4 },
  dateLabel: { fontSize: 10, fontWeight: "600", color: "#94A3B8", letterSpacing: 0.6, marginBottom: 3 },
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
  emptyText: { fontSize: 13, color: "#94A3B8", fontWeight: "600" },
  emptySubText: { fontSize: 12, color: "#CBD5E1", textAlign: "center", paddingHorizontal: 20 },

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
  historyRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  historyDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 16 },
  historyIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center",
  },
  historyInfo: { flex: 1 },
  historyRoute: { fontSize: 13, fontWeight: "700", color: "#1E293B", marginBottom: 2 },
  historyPeriod: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  historyRight: { alignItems: "flex-end" },
  historyName: { fontSize: 12, fontWeight: "700", color: "#1E293B", marginBottom: 2, maxWidth: 100 },
  historyOutcome: { fontSize: 11, fontWeight: "600" },

  // Tab bar
  tabBar: {
    flexDirection: "row", height: 64, backgroundColor: "#FFFFFF",
    borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingBottom: 4,
  },
  tabItem: { flex: 1, justifyContent: "center", alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", marginTop: 2 },
  tabLabelActive: { color: "#067BF9" },
});
