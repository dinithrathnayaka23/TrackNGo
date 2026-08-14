import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  type CorporateInvoice,
  type InvoiceStatus,
  computeOutstandingBalance,
  displayInvoiceStatus,
  formatAmount,
  formatContractDate,
  getCorporateInvoices,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function invoiceStatusStyle(status: InvoiceStatus): { bg: string; text: string } {
  switch (status) {
    case "paid":      return { bg: "#D1FAE5", text: "#065F46" };
    case "pending":   return { bg: "#FEF3C7", text: "#B45309" };
    case "overdue":   return { bg: "#FEE2E2", text: "#991B1B" };
    case "cancelled": return { bg: "#F1F5F9", text: "#64748B" };
  }
}

function buildInvoiceRef(invoice: CorporateInvoice): string {
  const year = invoice.date ? invoice.date.substring(0, 4) : new Date().getFullYear();
  const num = String(invoice.invoiceNumber).padStart(4, "0");
  return `INV-${year}-${num}`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CorporateBillingScreen() {
  const router = useRouter();
  const { currentUser } = useSession();

  const [invoices, setInvoices] = useState<CorporateInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerAnim = useFadeSlide(0);
  const cardAnim = useFadeSlide(80);
  const invoicesAnim = useFadeSlide(180);

  // ── Data loading ─────────────────────────────────────────────────
  const loadInvoices = useCallback(
    async (isRefresh = false) => {
      if (!currentUser?.userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getCorporateInvoices(currentUser.userId);
        setInvoices(data);
      } catch (err) {
        console.error("[CorporateBilling] Failed to load invoices:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser],
  );

  useFocusEffect(
    useCallback(() => {
      void loadInvoices();
    }, [loadInvoices]),
  );

  // ── Computed values ──────────────────────────────────────────────
  const outstandingBalance = computeOutstandingBalance(invoices);
  const recentInvoices = [...invoices]
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 10);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { opacity: headerAnim.opacity, transform: [{ translateY: headerAnim.translateY }] },
        ]}
      >
        <Text style={styles.headerTitle}>Billing & Payments</Text>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadInvoices(true)}
            tintColor="#067BF9"
          />
        }
      >
        {/* Balance Card */}
        <Animated.View
          style={{ opacity: cardAnim.opacity, transform: [{ translateY: cardAnim.translateY }] }}
        >
          <View style={styles.balanceCard}>
            <View style={styles.decorCircleLg} />
            <View style={styles.decorCircleSm} />

            <Text style={styles.balanceLabel}>TOTAL BALANCE DUE</Text>

            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="large" style={{ marginVertical: 10 }} />
            ) : (
              <Text style={styles.balanceAmount}>{formatAmount(outstandingBalance)}</Text>
            )}

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.payBtn}
                activeOpacity={0.85}
                onPress={() =>
                  Alert.alert(
                    "Pay Now",
                    `Redirecting to payment gateway for ${formatAmount(outstandingBalance)}…`,
                  )
                }
              >
                <Text style={styles.payBtnText}>Pay Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.downloadBtn}
                activeOpacity={0.85}
                onPress={() =>
                  Alert.alert("Download PDF", "Generating combined invoice PDF…")
                }
              >
                <Text style={styles.downloadBtnText}>Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Recent Invoices */}
        <Animated.View
          style={{ opacity: invoicesAnim.opacity, transform: [{ translateY: invoicesAnim.translateY }] }}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Invoices</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert("All Invoices", "Full invoice history coming soon.")
              }
            >
              <View style={styles.seeAllRow}>
                <Text style={styles.sectionAction}>See All</Text>
                <Ionicons name="chevron-forward" size={14} color="#2F6BFF" />
              </View>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="#067BF9" style={{ marginTop: 12 }} />
          ) : recentInvoices.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="receipt" size={36} color="#CBD5E1" />
              <Text style={styles.emptyText}>No invoices yet</Text>
              <Text style={styles.emptySubText}>
                Invoices will appear here once your contracts are active.
              </Text>
            </View>
          ) : (
            <View style={styles.invoicesCard}>
              {recentInvoices.map((inv, idx) => {
                const st = invoiceStatusStyle(inv.status);
                const label = displayInvoiceStatus(inv.status);
                const ref = buildInvoiceRef(inv);
                return (
                  <React.Fragment key={`${inv.contractId}-${inv.invoiceNumber}`}>
                    {idx > 0 && <View style={styles.divider} />}
                    <Pressable
                      style={({ pressed }) => [
                        styles.invoiceRow,
                        pressed && styles.invoiceRowPressed,
                      ]}
                      onPress={() =>
                        Alert.alert(
                          ref,
                          `Amount: ${formatAmount(inv.amount)}\nStatus: ${label}\nDate: ${formatContractDate(inv.date)}${inv.dueDate ? `\nDue: ${formatContractDate(inv.dueDate)}` : ""}`,
                        )
                      }
                    >
                      <View style={styles.invoiceLeft}>
                        <Text style={styles.invoiceRef}>{ref}</Text>
                        <Text style={styles.invoiceDate}>{formatContractDate(inv.date)}</Text>
                      </View>
                      <View style={styles.invoiceRight}>
                        <Text style={styles.invoiceAmount}>{formatAmount(inv.amount)}</Text>
                        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusText, { color: st.text }]}>{label}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* Summary stats */}
        {!loading && invoices.length > 0 && (
          <Animated.View
            style={{
              opacity: invoicesAnim.opacity,
              transform: [{ translateY: invoicesAnim.translateY }],
              marginTop: 20,
            }}
          >
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{invoices.filter((i) => i.status === "paid").length}</Text>
                <Text style={styles.statLabel}>Paid</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#B45309" }]}>
                  {invoices.filter((i) => i.status === "pending").length}
                </Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#EF4444" }]}>
                  {invoices.filter((i) => i.status === "overdue").length}
                </Text>
                <Text style={styles.statLabel}>Overdue</Text>
              </View>
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

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push("/corporate/corporate-contract")}
        >
          <Ionicons name="document-text-outline" size={22} color="#64748B" />
          <Text style={styles.tabLabel}>Contracts</Text>
        </TouchableOpacity>

        {/* Billing – active */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push("/corporate/corporate-billing")}
        >
          <MaterialCommunityIcons name="receipt" size={22} color="#2F6BFF" />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Billing</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EDF3",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 12 },

  // Balance card
  balanceCard: {
    borderRadius: 18,
    backgroundColor: "#067BF9",
    padding: 24,
    marginBottom: 26,
    overflow: "hidden",
    shadowColor: "#067BF9",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 7,
    position: "relative",
  },
  decorCircleLg: {
    position: "absolute", top: -40, right: -40, width: 160, height: 160,
    borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)",
  },
  decorCircleSm: {
    position: "absolute", bottom: -20, left: -20, width: 100, height: 100,
    borderRadius: 50, backgroundColor: "rgba(255,255,255,0.06)",
  },
  balanceLabel: {
    fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.75)",
    letterSpacing: 1.2, marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 32, fontWeight: "800", color: "#FFFFFF",
    letterSpacing: -0.5, marginBottom: 24,
  },
  cardActions: { flexDirection: "row", gap: 12 },
  payBtn: {
    flex: 1, backgroundColor: "#FFFFFF", borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  payBtnText: { fontSize: 14, fontWeight: "700", color: "#067BF9" },
  downloadBtn: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
  },
  downloadBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  // Section header
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A" },
  sectionAction: { fontSize: 13, fontWeight: "600", color: "#2F6BFF" },
  seeAllRow: { flexDirection: "row", alignItems: "center", gap: 2 },

  // Invoices card
  invoicesCard: {
    backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1,
    borderColor: "#E8EDF3", overflow: "hidden",
    shadowColor: "#0F172A", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  invoiceRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  invoiceRowPressed: { backgroundColor: "#F8FAFC" },
  invoiceLeft: { flex: 1 },
  invoiceRef: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 3 },
  invoiceDate: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  invoiceRight: { alignItems: "flex-end", gap: 5 },
  invoiceAmount: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 3 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 16 },

  // Empty
  emptyCard: {
    backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1,
    borderColor: "#E8EDF3", alignItems: "center", paddingVertical: 32, gap: 8,
  },
  emptyText: { fontSize: 13, color: "#94A3B8", fontWeight: "600" },
  emptySubText: {
    fontSize: 12, color: "#CBD5E1", textAlign: "center", paddingHorizontal: 24,
  },

  // Stats
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#E8EDF3",
    shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: "#10B981", marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },

  // Tab bar
  tabBar: {
    flexDirection: "row", height: 64, backgroundColor: "#FFFFFF",
    borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingBottom: 4,
  },
  tabItem: { flex: 1, justifyContent: "center", alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", marginTop: 2 },
  tabLabelActive: { color: "#2F6BFF" },
});
