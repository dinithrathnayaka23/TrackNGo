import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSession } from "../../store/sessionStore";
import { CorporateTabBar } from "../../components/CorporateTabBar";
import {
  type CorporateContract,
  type CorporateInvoice,
  type InvoiceStatus,
  computeOutstandingBalance,
  daysRemaining,
  displayInvoiceStatus,
  formatAmount,
  formatContractDate,
  getCorporateContracts,
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

/**
 * Due-date wording for an unpaid invoice: overdue invoices say by how much,
 * upcoming ones say how long is left.
 */
function describeDueDate(invoice: CorporateInvoice): { label: string; urgent: boolean } {
  if (!invoice.dueDate) {
    return { label: "No due date set", urgent: false };
  }
  const days = daysRemaining(invoice.dueDate);
  if (days < 0) {
    const overdue = Math.abs(days);
    return { label: `Overdue by ${overdue} day${overdue === 1 ? "" : "s"}`, urgent: true };
  }
  if (days === 0) {
    return { label: "Due today", urgent: true };
  }
  return { label: `Due in ${days} day${days === 1 ? "" : "s"}`, urgent: false };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CorporateBillingScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { currentUser } = useSession();

  const [invoices, setInvoices] = useState<CorporateInvoice[]>([]);
  const [contracts, setContracts] = useState<CorporateContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerAnim = useFadeSlide(0);
  const cardAnim = useFadeSlide(80);
  const outstandingAnim = useFadeSlide(140);
  const invoicesAnim = useFadeSlide(180);

  // Deep link from the dashboard's Outstanding Balance card.
  const scrollRef = useRef<ScrollView>(null);
  const outstandingSectionY = useRef(0);
  const didAutoScroll = useRef(false);

  // ── Data loading ─────────────────────────────────────────────────
  const loadInvoices = useCallback(
    async (isRefresh = false) => {
      if (!currentUser?.userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        // Contracts come along so each invoice can be shown against the route
        // it belongs to rather than a bare contract id.
        const [invoiceData, contractData] = await Promise.all([
          getCorporateInvoices(currentUser.userId),
          getCorporateContracts(currentUser.userId),
        ]);
        setInvoices(invoiceData);
        setContracts(contractData);
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

  useEffect(() => {
    if (loading || section !== "outstanding" || didAutoScroll.current) return;
    didAutoScroll.current = true;
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(outstandingSectionY.current - 12, 0),
        animated: true,
      });
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [loading, section]);

  // ── Computed values ──────────────────────────────────────────────
  const outstandingBalance = computeOutstandingBalance(invoices);
  // Unpaid invoices, most urgent (earliest due date) first.
  const outstandingInvoices = invoices
    .filter((inv) => inv.status === "pending" || inv.status === "overdue")
    .sort((a, b) => (a.dueDate ?? a.date).localeCompare(b.dueDate ?? b.date));
  const overdueCount = outstandingInvoices.filter((inv) => inv.status === "overdue").length;
  const recentInvoices = [...invoices]
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 10);

  const contractLabel = (contractId: number): string => {
    const contract = contracts.find((c) => c.contractId === contractId);
    if (!contract) return `Contract #${contractId}`;
    return `${contract.startingLocation} → ${contract.destination}`;
  };

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
        ref={scrollRef}
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
              <>
                <Text style={styles.balanceAmountTight}>{formatAmount(outstandingBalance)}</Text>
                <Text style={styles.balanceBreakdown}>
                  {outstandingInvoices.length === 0
                    ? "All invoices settled"
                    : `${outstandingInvoices.length} unpaid invoice${
                        outstandingInvoices.length === 1 ? "" : "s"
                      }${overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}`}
                </Text>
              </>
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

        {/* Outstanding breakdown — what makes up the balance above */}
        {!loading && (
          <Animated.View
            onLayout={(event) => {
              outstandingSectionY.current = event.nativeEvent.layout.y;
            }}
            style={{
              opacity: outstandingAnim.opacity,
              transform: [{ translateY: outstandingAnim.translateY }],
              marginBottom: 26,
            }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Outstanding Invoices</Text>
              {outstandingInvoices.length > 0 && (
                <Text style={styles.outstandingTotal}>{formatAmount(outstandingBalance)}</Text>
              )}
            </View>

            {outstandingInvoices.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="check-circle-outline" size={36} color="#86EFAC" />
                <Text style={styles.emptyText}>Nothing outstanding</Text>
                <Text style={styles.emptySubText}>
                  Every invoice raised against your contracts has been paid.
                </Text>
              </View>
            ) : (
              <View style={styles.invoicesCard}>
                {outstandingInvoices.map((inv, idx) => {
                  const st = invoiceStatusStyle(inv.status);
                  const due = describeDueDate(inv);
                  return (
                    <React.Fragment key={`${inv.contractId}-${inv.invoiceNumber}`}>
                      {idx > 0 && <View style={styles.divider} />}
                      <Pressable
                        style={({ pressed }) => [
                          styles.invoiceRow,
                          pressed && styles.invoiceRowPressed,
                        ]}
                        onPress={() =>
                          router.push(`/corporate/contract-detail?contractId=${inv.contractId}`)
                        }
                      >
                        <View style={styles.invoiceLeft}>
                          <Text style={styles.invoiceRef}>{buildInvoiceRef(inv)}</Text>
                          <Text style={styles.invoiceContract} numberOfLines={1}>
                            {contractLabel(inv.contractId)}
                          </Text>
                          <Text style={[styles.dueLabel, due.urgent && styles.dueLabelUrgent]}>
                            {due.label}
                            {inv.dueDate ? ` · ${formatContractDate(inv.dueDate)}` : ""}
                          </Text>
                        </View>
                        <View style={styles.invoiceRight}>
                          <Text style={styles.invoiceAmount}>{formatAmount(inv.amount)}</Text>
                          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                            <Text style={[styles.statusText, { color: st.text }]}>
                              {displayInvoiceStatus(inv.status)}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </React.Fragment>
                  );
                })}
              </View>
            )}
          </Animated.View>
        )}

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
      <CorporateTabBar active="billing" />
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
  balanceAmountTight: {
    fontSize: 32, fontWeight: "800", color: "#FFFFFF",
    letterSpacing: -0.5, marginBottom: 4,
  },
  balanceBreakdown: {
    fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.8)", marginBottom: 20,
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
  invoiceLeft: { flex: 1, paddingRight: 10 },
  invoiceRef: { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 3 },
  invoiceDate: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  invoiceContract: { fontSize: 12, color: "#64748B", fontWeight: "500", marginBottom: 3 },
  dueLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  dueLabelUrgent: { color: "#EF4444" },
  outstandingTotal: { fontSize: 14, fontWeight: "800", color: "#EF4444" },
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

});
