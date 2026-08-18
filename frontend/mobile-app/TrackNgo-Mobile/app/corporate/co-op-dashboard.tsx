import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSession } from "../../store/sessionStore";
import {
  type CorporateContract,
  type CorporateInvoice,
  type CorporateProfileDto,
  computeOutstandingBalance,
  formatAmount,
  getCorporateContracts,
  getCorporateInvoices,
  getCorporateProfile,
  isContractRunning,
} from "../../services/corporateApi";
import { getCorporateUnreadCount } from "../../services/notificationsApi";
import { CorporateTabBar } from "../../components/CorporateTabBar";
import { useTimeOfDayGreeting } from "../../utils/greeting";

export default function CoOpDashboardScreen() {
  const router = useRouter();
  const { currentUser, clearCurrentUser } = useSession();
  const greeting = useTimeOfDayGreeting();

  // ── State ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<CorporateProfileDto | null>(null);
  const [contracts, setContracts] = useState<CorporateContract[]>([]);
  const [invoices, setInvoices] = useState<CorporateInvoice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Derived values ─────────────────────────────────────────────────
  const companyName =
    profile?.companyName?.trim() ||
    profile?.contactPersonName?.trim() ||
    `User ${currentUser?.userId ?? ""}`;

  const companyInitials = companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  // Same rule as the Contracts screen: active status *and* still within its dates.
  const activeContracts = contracts.filter(isContractRunning);
  const pendingContracts = contracts.filter((c) => c.status === "pending");
  const outstandingBalance = computeOutstandingBalance(invoices);

  // The call-to-action speaks to a first-time company ("create your first
  // contract") but would read oddly for one that already has contracts, so the
  // copy follows the account's actual state.
  const ctaCopy = (() => {
    if (loading) {
      return {
        title: "Create New Contract",
        subtitle: "Set up transportation contracts for your employees.",
        action: "Get Started Now",
      };
    }

    if (contracts.length === 0) {
      return {
        title: "Create Your First Contract",
        subtitle:
          "Set up your corporate contract. Start by creating your first transportation contract for your employees.",
        action: "Get Started Now",
      };
    }

    const plural = (count: number) => (count === 1 ? "" : "s");

    if (pendingContracts.length > 0) {
      return {
        title: "Create New Contract",
        subtitle: `${pendingContracts.length} contract request${plural(
          pendingContracts.length,
        )} awaiting approval. You can submit another route or shift any time.`,
        action: "New Contract",
      };
    }

    if (activeContracts.length > 0) {
      return {
        title: "Create New Contract",
        subtitle: `You have ${activeContracts.length} contract${plural(
          activeContracts.length,
        )} running. Add another route or shift for your employees.`,
        action: "New Contract",
      };
    }

    return {
      title: "Create New Contract",
      subtitle:
        "Your previous contracts have ended. Set up a new transportation contract for your employees.",
      action: "New Contract",
    };
  })();

  // ── Data loading ───────────────────────────────────────────────────
  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!currentUser?.userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [profileData, contractData, invoiceData, unread] = await Promise.all([
          getCorporateProfile(currentUser.userId),
          getCorporateContracts(currentUser.userId),
          getCorporateInvoices(currentUser.userId),
          getCorporateUnreadCount(currentUser.userId),
        ]);
        setProfile(profileData);
        setContracts(contractData);
        setInvoices(invoiceData);
        setUnreadCount(unread);
      } catch (err) {
        console.error("[CoOpDashboard] Failed to load data:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser],
  );

  // Reload on focus (e.g. coming back from new-contract screen)
  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  // ── Logout ─────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await clearCurrentUser();
          router.replace("/auth/login?userType=corporate");
        },
      },
    ]);
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <View style={styles.avatarCircle}>
            {loading ? (
              <ActivityIndicator size="small" color="#067BF9" />
            ) : (
              <Text style={styles.avatarText}>{companyInitials}</Text>
            )}
          </View>
          <View style={styles.greetingCol}>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.companyNameText}>{companyName}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push("/notifications/notifications")}
          >
            <Ionicons name="notifications" size={22} color="#1E293B" />
            {/* Only flagged while something is actually unread. */}
            {unreadCount > 0 && (
              <View style={styles.redBadge}>
                <Text style={styles.redBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
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
        {/* Create New Contract CTA */}
        <View style={styles.gradientCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconSquare}>
              <Ionicons name="document-text" size={24} color="#067BF9" />
            </View>
          </View>
          <Text style={styles.cardTitle}>{ctaCopy.title}</Text>
          <Text style={styles.cardSubtitle}>{ctaCopy.subtitle}</Text>
          <TouchableOpacity
            style={styles.getStartedBtn}
            onPress={() => router.push("/corporate/new-contract")}
          >
            <Text style={styles.getStartedBtnText}>{ctaCopy.action}</Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color="#067BF9"
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        </View>

        {/* Quick Overview */}
        <View style={styles.overviewSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.overviewTitle}>Quick Overview</Text>
            <TouchableOpacity onPress={() => loadData(true)}>
              <Text style={styles.updatedText}>
                {loading ? "Loading…" : "Tap to refresh"}
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              size="small"
              color="#067BF9"
              style={{ marginVertical: 16 }}
            />
          ) : (
            <>
              {/* Stats Grid */}
              <View style={styles.overviewGrid}>
                <TouchableOpacity
                  style={styles.overviewCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push("/corporate/corporate-contract?section=active")
                  }
                >
                  <View style={styles.cardIconRow}>
                    <Ionicons name="ribbon-outline" size={20} color="#067BF9" />
                    <Text style={styles.overviewCardLabel}>
                      Active Contracts
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#CBD5E1"
                      style={styles.cardChevron}
                    />
                  </View>
                  <Text style={styles.overviewCardValue}>
                    {activeContracts.length}
                  </Text>
                  <Text style={styles.overviewCardSub}>
                    {activeContracts.length > 0
                      ? `${contracts.length} total contracts`
                      : "No active contracts"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.overviewCard}
                  activeOpacity={0.85}
                  onPress={() => router.push("/corporate/corporate-contract")}
                >
                  <View style={styles.cardIconRow}>
                    <Ionicons
                      name="people-outline"
                      size={20}
                      color="#067BF9"
                    />
                    <Text style={styles.overviewCardLabel}>
                      Total Contracts
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#CBD5E1"
                      style={styles.cardChevron}
                    />
                  </View>
                  <Text style={styles.overviewCardValue}>
                    {contracts.length}
                  </Text>
                  <Text style={styles.overviewCardSub}>
                    {contracts.filter((c) => c.status === "pending").length}{" "}
                    pending approval
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Spend Card */}
              <TouchableOpacity
                style={styles.spendCard}
                activeOpacity={0.85}
                onPress={() =>
                  router.push("/corporate/corporate-billing?section=outstanding")
                }
              >
                <View style={styles.spendLabelRow}>
                  <Ionicons
                    name="wallet-outline"
                    size={20}
                    color="#067BF9"
                  />
                  <Text style={styles.spendLabel}>Outstanding Balance</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color="#CBD5E1"
                    style={styles.cardChevron}
                  />
                </View>
                <Text style={styles.spendValue}>
                  {formatAmount(outstandingBalance)}
                </Text>
                <Text style={styles.spendHint}>
                  {outstandingBalance > 0
                    ? "Tap to see the invoices behind this balance"
                    : "No unpaid invoices"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Empty State when no contracts */}
        {!loading && contracts.length === 0 && (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="bus-outline" size={48} color="#94A3B8" />
              <View style={styles.searchBadge}>
                <Ionicons name="search" size={12} color="#067BF9" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>No Active Partnership</Text>
            <Text style={styles.emptySubtitle}>
              Your dashboard is empty because you haven't started a smart fleet
              partnership yet. Connect with providers to see tracking data here.
            </Text>
          </View>
        )}

        {/* Active contracts preview (max 2) */}
        {!loading && activeContracts.length > 0 && (
          <View style={styles.overviewSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.overviewTitle}>Active Contracts</Text>
              <TouchableOpacity
                onPress={() => router.push("/corporate/corporate-contract")}
              >
                <Text style={styles.updatedText}>See All →</Text>
              </TouchableOpacity>
            </View>
            {activeContracts.slice(0, 2).map((contract) => (
              <TouchableOpacity
                key={contract.contractId}
                style={styles.contractPreviewCard}
                activeOpacity={0.85}
                onPress={() =>
                  router.push(
                    `/corporate/contract-detail?contractId=${contract.contractId}`,
                  )
                }
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#067BF9"
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.contractPreviewName}>
                    {contract.contractName}
                  </Text>
                  <Text style={styles.contractPreviewRoute}>
                    {contract.startingLocation} → {contract.destination}
                  </Text>
                </View>
                <View style={styles.activeDot} />
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#CBD5E1"
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom Tab Bar */}
      <CorporateTabBar active="dashboard" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 70,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#067BF9",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#067BF9" },
  greetingCol: { marginLeft: 12 },
  greetingText: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  companyNameText: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  bellBtn: { position: "relative", padding: 6, marginRight: 8 },
  redBadge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  redBadgeText: { fontSize: 9, fontWeight: "800", color: "#FFFFFF" },
  logoutBtn: { padding: 6 },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  // Hero card
  gradientCard: {
    backgroundColor: "#067BF9",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#067BF9",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  cardHeaderRow: { marginBottom: 16 },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 18,
    marginBottom: 20,
  },
  getStartedBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  getStartedBtnText: { fontSize: 14, fontWeight: "700", color: "#067BF9" },

  // Overview section
  overviewSection: { marginBottom: 24 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  updatedText: { fontSize: 12, color: "#067BF9", fontWeight: "600" },
  overviewGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  overviewCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardIconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  overviewCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 6,
    flexShrink: 1,
  },
  cardChevron: { marginLeft: "auto" },
  overviewCardValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  overviewCardSub: { fontSize: 11, color: "#94A3B8" },
  // Laid out like the stat cards above it: label row, value, sub-line.
  spendCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  spendLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  spendLabel: { fontSize: 13, fontWeight: "600", color: "#64748B", marginLeft: 8 },
  spendValue: { fontSize: 20, fontWeight: "700", color: "#1E293B" },
  spendHint: { fontSize: 11, fontWeight: "500", color: "#94A3B8", marginTop: 4 },

  // Empty state
  emptyStateContainer: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginVertical: 12,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
  },
  searchBadge: {
    position: "absolute",
    top: 24,
    right: 24,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },

  // Contract preview
  contractPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  contractPreviewName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 2,
  },
  contractPreviewRoute: { fontSize: 12, color: "#64748B" },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },

  // Tab bar
});
