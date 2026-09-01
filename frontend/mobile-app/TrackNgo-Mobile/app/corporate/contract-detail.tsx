import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSession } from "../../store/sessionStore";
import {
  type CorporateContractDetail,
  type CorporateInvoice,
  type InvoiceStatus,
  contractProgress,
  daysRemaining,
  describeCompletedContract,
  displayContractStatus,
  displayInvoiceStatus,
  formatAmount,
  formatContractDate,
  formatShiftDuration,
  formatShiftTime,
  getCorporateContractDetail,
  isContractCompleted,
  isRenewalDue,
  isScheduledForCancellation,
  parseBusAmenities,
  requestContractCancellation,
  requestContractRenewal,
  respondToContractCancellation,
} from "../../services/corporateApi";
import {
  buildContractPdfHtml,
  buildPaymentReceiptHtml,
  downloadCorporatePdf,
  viewCorporatePdf,
} from "../../utils/corporatePdf";

// Mirrors MIN/MAX_CANCEL_REASON_LENGTH in the backend's CorporateService.
const MIN_CANCEL_REASON_LENGTH = 10;
const MAX_CANCEL_REASON_LENGTH = 500;

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

// ─── Lookups ──────────────────────────────────────────────────────────────────

const AMENITY_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  ac: { icon: <MaterialCommunityIcons name="snowflake" size={15} color="#067BF9" />, label: "A/C" },
  wifi: { icon: <Ionicons name="wifi" size={15} color="#067BF9" />, label: "Wi-Fi" },
  charging: { icon: <MaterialCommunityIcons name="power-plug" size={15} color="#067BF9" />, label: "Power" },
  charging_ports: { icon: <MaterialCommunityIcons name="power-plug" size={15} color="#067BF9" />, label: "Power" },
  entertainment: { icon: <Ionicons name="tv-outline" size={15} color="#067BF9" />, label: "Entertainment" },
  tv: { icon: <Ionicons name="tv-outline" size={15} color="#067BF9" />, label: "TV" },
  water: { icon: <Ionicons name="water" size={15} color="#067BF9" />, label: "Water" },
  gps: { icon: <MaterialCommunityIcons name="crosshairs-gps" size={15} color="#067BF9" />, label: "GPS" },
  cctv: { icon: <MaterialCommunityIcons name="cctv" size={15} color="#067BF9" />, label: "CCTV" },
};

function statusBadge(status: string | null | undefined): { bg: string; text: string } {
  switch (status?.toLowerCase()) {
    case "expired":   return { bg: "#FEE2E2", text: "#991B1B" };
    case "pending":   return { bg: "#FEF3C7", text: "#B45309" };
    case "cancelled": return { bg: "#F1F5F9", text: "#64748B" };
    default:          return { bg: "#D1FAE5", text: "#065F46" };
  }
}

function invoiceStatusStyle(status: InvoiceStatus): { bg: string; text: string } {
  switch (status) {
    case "paid":      return { bg: "#D1FAE5", text: "#065F46" };
    case "pending":   return { bg: "#FEF3C7", text: "#B45309" };
    case "overdue":   return { bg: "#FEE2E2", text: "#991B1B" };
    default:          return { bg: "#F1F5F9", text: "#64748B" };
  }
}

function buildInvoiceRef(invoice: CorporateInvoice): string {
  const year = invoice.date ? invoice.date.substring(0, 4) : new Date().getFullYear();
  return `INV-${year}-${String(invoice.invoiceNumber).padStart(4, "0")}`;
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

// ─── Small building blocks ────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {icon}
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ContractDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contractId?: string }>();
  const { currentUser } = useSession();

  const contractId = params.contractId ? parseInt(params.contractId, 10) : null;

  const [contract, setContract] = useState<CorporateContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [respondSubmitting, setRespondSubmitting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  const heroAnim = useFadeSlide(0);
  const bodyAnim = useFadeSlide(120);

  const loadContract = useCallback(
    async (isRefresh = false) => {
      if (!contractId || !currentUser?.userId) {
        setLoading(false);
        setError("Contract not found.");
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getCorporateContractDetail(contractId, currentUser.userId);
        if (data) {
          setContract(data);
          setError(null);
        } else {
          setError("This contract is no longer available.");
        }
      } catch (err) {
        console.error("[ContractDetail] Failed to load contract:", err);
        setError("Could not load contract details. Pull down to retry.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [contractId, currentUser],
  );

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  const handleCallDriver = (phone: string) => {
    void Linking.openURL(`tel:${phone}`);
  };

  const submitCancelRequest = async () => {
    if (!contractId || !cancelReason.trim()) return;
    if (cancelReason.trim().length < MIN_CANCEL_REASON_LENGTH) {
      Alert.alert(
        "Reason too short",
        `Please explain your reason for cancelling in at least ${MIN_CANCEL_REASON_LENGTH} characters.`,
      );
      return;
    }
    setCancelSubmitting(true);
    try {
      await requestContractCancellation(contractId, cancelReason.trim());
      setCancelModalVisible(false);
      setCancelReason("");
      Alert.alert("Request Sent", "Your cancellation request has been sent to admin for approval.");
      await loadContract();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to request cancellation.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const submitCancelResponse = async (accept: boolean, timing?: "immediate" | "scheduled") => {
    if (!contractId) return;
    setRespondSubmitting(true);
    try {
      await respondToContractCancellation(contractId, accept, undefined, timing);
      Alert.alert(
        accept ? "Cancellation Accepted" : "Cancellation Declined",
        !accept
          ? "You declined admin's request to cancel this contract."
          : timing === "scheduled"
          ? "This contract will keep running and cancel automatically once the notice period ends."
          : "You accepted admin's request to cancel this contract.",
      );
      await loadContract();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to respond to cancellation request.");
    } finally {
      setRespondSubmitting(false);
    }
  };

  /**
   * Accepting an admin-initiated cancellation of an already-active contract
   * requires a timing choice; every other case (a still-pending contract, or
   * a request the corporate user filed themselves) always cancels immediately.
   */
  const handleAcceptCancellation = () => {
    if (!contract) return;
    if (contract.status?.toLowerCase() === "active") {
      Alert.alert(
        "Accept Cancellation",
        "Choose when this contract should end.",
        [
          { text: "Back", style: "cancel" },
          {
            text: "Cancel Immediately",
            style: "destructive",
            onPress: () => submitCancelResponse(true, "immediate"),
          },
          {
            text: "Keep Running 14 More Days",
            onPress: () => submitCancelResponse(true, "scheduled"),
          },
        ],
      );
    } else {
      submitCancelResponse(true);
    }
  };

  const submitRenewalRequest = () => {
    if (!contractId || !currentUser) return;
    Alert.alert(
      "Request Renewal",
      "This asks admin for permission to renew this contract. Once approved, you'll be able to review and submit the renewal details.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Request",
          onPress: async () => {
            setRenewSubmitting(true);
            try {
              await requestContractRenewal(contractId, currentUser.userId);
              Alert.alert("Request Sent", "Your renewal request has been sent to admin.");
              await loadContract();
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to send renewal request.");
            } finally {
              setRenewSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const proceedWithRenewal = () => {
    if (!contractId) return;
    router.push(`/corporate/new-contract?renewFrom=${contractId}`);
  };

  const handleViewContractPdf = async () => {
    if (!contract) return;
    setPdfBusy("view-contract");
    try {
      await viewCorporatePdf(buildContractPdfHtml(contract));
    } catch (err) {
      console.error("[ContractDetail] view contract pdf failed", err);
      Alert.alert("Error", "Could not open the contract PDF right now.");
    } finally {
      setPdfBusy(null);
    }
  };

  const handleDownloadContractPdf = async () => {
    if (!contract) return;
    setPdfBusy("download-contract");
    try {
      await downloadCorporatePdf(
        buildContractPdfHtml(contract),
        `TrackNGo-Contract-${contract.contractId}.pdf`,
      );
    } catch (err) {
      console.error("[ContractDetail] download contract pdf failed", err);
      Alert.alert("Error", "Could not generate the contract PDF. Please try again.");
    } finally {
      setPdfBusy(null);
    }
  };

  const handleDownloadInvoiceReceipt = async (invoice: CorporateInvoice) => {
    if (!contract) return;
    const key = `invoice-${invoice.invoiceNumber}`;
    setPdfBusy(key);
    try {
      const html = buildPaymentReceiptHtml({
        title: "Monthly Billing Payment",
        referenceValue: buildInvoiceRef(invoice),
        companyName: contract.companyName,
        contactPersonName: contract.contactPersonName,
        contractName: contract.contractName,
        description: `Billing period ${formatContractDate(invoice.date)}${invoice.periodEnd ? ` – ${formatContractDate(invoice.periodEnd)}` : ""}`,
        amount: invoice.amount,
        paidAt: invoice.paidAt,
        transactionId: invoice.stripeTransactionId,
      });
      await downloadCorporatePdf(html, `TrackNGo-Receipt-${buildInvoiceRef(invoice)}.pdf`);
    } catch (err) {
      console.error("[ContractDetail] download invoice receipt failed", err);
      Alert.alert("Error", "Could not generate the receipt PDF. Please try again.");
    } finally {
      setPdfBusy(null);
    }
  };

  // ── Derived values ───────────────────────────────────────────────
  // A contract that ran past its end date still carries status = 'active' in the
  // DB, so it is presented as "Completed" rather than "Active".
  const completed = contract ? isContractCompleted(contract) : false;
  const scheduledForCancellation = contract ? isScheduledForCancellation(contract) : false;
  const statusLabel = !contract
    ? ""
    : completed
    ? describeCompletedContract(contract).label
    : scheduledForCancellation
    ? `Ending ${formatContractDate(contract.cancellation.effectiveDate as string)}`
    : displayContractStatus(contract.status);
  const badge =
    completed && contract?.status?.toLowerCase() === "active"
      ? { bg: "#E2E8F0", text: "#475569" }
      : scheduledForCancellation
      ? { bg: "#FEF3C7", text: "#B45309" }
      : statusBadge(contract?.status);
  const remaining = contract ? daysRemaining(contract.endDate) : 0;
  const progress = contract ? contractProgress(contract.startDate, contract.endDate) : 0;
  const amenities = parseBusAmenities(contract?.bus?.amenities);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contract Details</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#067BF9" />
        </View>
      ) : !contract ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadContract(true)} tintColor="#067BF9" />
          }
        >
          <Ionicons name="document-text-outline" size={40} color="#CBD5E1" />
          <Text style={styles.errorText}>{error ?? "Contract not found."}</Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadContract(true)} tintColor="#067BF9" />
          }
        >
          {/* Hero */}
          <Animated.View
            style={{ opacity: heroAnim.opacity, transform: [{ translateY: heroAnim.translateY }] }}
          >
            <View style={styles.heroCard}>
              <View style={styles.decorCircleLg} />
              <View style={styles.decorCircleSm} />

              <View style={styles.heroTopRow}>
                <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: badge.text }]} />
                  <Text style={[styles.statusPillText, { color: badge.text }]}>
                    {statusLabel}
                  </Text>
                </View>
                <Text style={styles.heroContractId}>#CNT-{String(contract.contractId).padStart(4, "0")}</Text>
              </View>

              <Text style={styles.heroName} numberOfLines={2}>{contract.contractName}</Text>

              <View style={styles.heroRouteRow}>
                <Text style={styles.heroRouteCity} numberOfLines={1}>{contract.startingLocation}</Text>
                <Ionicons name="arrow-forward" size={15} color="rgba(255,255,255,0.8)" style={{ marginHorizontal: 8 }} />
                <Text style={styles.heroRouteCity} numberOfLines={1}>{contract.destination}</Text>
              </View>

              <Text style={styles.heroAmountLabel}>
                {(contract.carriedBalance ?? 0) > 0 ? "1ST MONTH BILLING (INCL. WORKED DAYS)" : "MONTHLY BILLING"}
              </Text>
              <Text style={styles.heroAmount}>
                {formatAmount(contract.billingAmount + (contract.carriedBalance ?? 0))}
              </Text>

              {/* Contract period progress */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressText}>{formatContractDate(contract.startDate)}</Text>
                <Text style={styles.progressText}>
                  {remaining > 0
                    ? `${remaining} day${remaining === 1 ? "" : "s"} left`
                    : remaining === 0
                    ? "Ends today"
                    : "Ended"}
                </Text>
                <Text style={styles.progressText}>{formatContractDate(contract.endDate)}</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            style={{ opacity: bodyAnim.opacity, transform: [{ translateY: bodyAnim.translateY }] }}
          >
            {/* Cancellation request banner */}
            {contract.cancellation.status === "pending" && (
              <View style={styles.cancelBanner}>
                <View style={styles.cancelBannerHeader}>
                  <Ionicons name="alert-circle" size={18} color="#B45309" />
                  <Text style={styles.cancelBannerTitle}>
                    {contract.cancellation.requestedBy === "admin"
                      ? "Admin has requested to cancel this contract"
                      : "Your cancellation request is awaiting admin's response"}
                  </Text>
                </View>
                {contract.cancellation.reason && (
                  <Text style={styles.cancelBannerReason}>Reason: {contract.cancellation.reason}</Text>
                )}
                {contract.cancellation.requestedBy === "admin" && contract.status?.toLowerCase() === "active" && (
                  <Text style={styles.cancelBannerReason}>
                    If you accept, you can choose to cancel immediately or keep it running for a 14-day notice period.
                  </Text>
                )}
                {contract.cancellation.requestedBy === "admin" && (
                  <View style={styles.cancelBannerActions}>
                    <TouchableOpacity
                      style={[styles.cancelBannerBtn, { backgroundColor: "#DC2626" }]}
                      disabled={respondSubmitting}
                      onPress={() => submitCancelResponse(false)}
                    >
                      <Text style={styles.cancelBannerBtnText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cancelBannerBtn, { backgroundColor: "#059669" }]}
                      disabled={respondSubmitting}
                      onPress={handleAcceptCancellation}
                    >
                      <Text style={styles.cancelBannerBtnText}>{respondSubmitting ? "Working..." : "Accept"}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Scheduled-cancellation banner: contract stays active until the notice period ends */}
            {isScheduledForCancellation(contract) && (
              <View style={styles.cancelBanner}>
                <View style={styles.cancelBannerHeader}>
                  <Ionicons name="hourglass-outline" size={18} color="#B45309" />
                  <Text style={styles.cancelBannerTitle}>
                    Scheduled to end on {formatContractDate(contract.cancellation.effectiveDate as string)}
                  </Text>
                </View>
                <Text style={styles.cancelBannerReason}>
                  You agreed to cancel this contract. It will keep running until the date above, then cancel automatically.
                </Text>
              </View>
            )}

            {/* Cancellation rejected banner */}
            {contract.cancellation.status === "rejected" && (
              <View style={[styles.cancelBanner, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <View style={styles.cancelBannerHeader}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={[styles.cancelBannerTitle, { color: "#991B1B" }]}>
                    Cancellation Request Declined by Admin
                  </Text>
                </View>
                {contract.cancellation.responseReason && (
                  <View style={{ marginTop: 8, padding: 10, backgroundColor: "#FFF", borderRadius: 8, borderWidth: 1, borderColor: "#FEE2E2" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#991B1B" }}>Admin Instructions / Requirement:</Text>
                    <Text style={{ fontSize: 13, color: "#1E293B", marginTop: 2 }}>{contract.cancellation.responseReason}</Text>
                  </View>
                )}
                <Text style={[styles.cancelBannerReason, { marginTop: 8, color: "#7F1D1D" }]}>
                  Please fulfill what the admin requested above. Once completed, you can request cancellation again.
                </Text>
                <View style={{ marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.cancelBannerBtn, { backgroundColor: "#DC2626", alignSelf: "flex-start", paddingHorizontal: 16 }]}
                    onPress={() => setCancelModalVisible(true)}
                  >
                    <Text style={styles.cancelBannerBtnText}>Request Cancellation Again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Renewal — always available on an active contract, not just near its end date */}
            {contract.status?.toLowerCase() === "active" &&
              (contract.cancellation.status === "none" || contract.cancellation.status === "rejected") &&
              !isScheduledForCancellation(contract) && (
                <View style={styles.renewBanner}>
                  <View style={styles.cancelBannerHeader}>
                    <Ionicons name="refresh-circle" size={18} color="#1D4ED8" />
                    <Text style={styles.renewBannerTitle}>
                      {contract.renewalRequestStatus === "requested"
                        ? "Renewal request sent — awaiting admin's response."
                        : contract.renewalRequestStatus === "approved"
                        ? "Admin approved your renewal request!"
                        : contract.renewalRequestStatus === "declined"
                        ? "Your renewal request was declined."
                        : isRenewalDue(contract)
                        ? remaining >= 0
                          ? `This contract ends in ${remaining} day${remaining === 1 ? "" : "s"} — renew to avoid a gap in service.`
                          : "This contract has ended — renew to resume the service."
                        : "Want to keep this service running? You can request to renew this contract at any time."}
                    </Text>
                  </View>
                  {contract.renewalRequestStatus === "declined" && (
                    <Text style={styles.cancelBannerReason}>
                      Contact admin for more information, or send a new request.
                    </Text>
                  )}
                  {contract.renewalRequestStatus === "requested" ? (
                    <View style={styles.renewPendingBadge}>
                      <View style={styles.renewPendingDot} />
                      <Text style={styles.renewPendingText}>Pending Approval</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.renewBannerBtn}
                      disabled={renewSubmitting}
                      onPress={contract.renewalRequestStatus === "approved" ? proceedWithRenewal : submitRenewalRequest}
                    >
                      <Text style={styles.renewBannerBtnText}>
                        {renewSubmitting
                          ? "Sending..."
                          : contract.renewalRequestStatus === "approved"
                          ? "Proceed with Renewal"
                          : contract.renewalRequestStatus === "declined"
                          ? "Request Again"
                          : "Request Renewal"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

            {/* Daily shift */}
            <SectionCard
              title="Daily Shift"
              icon={<Ionicons name="time-outline" size={18} color="#067BF9" />}
            >
              <View style={styles.shiftRow}>
                <View style={styles.shiftBox}>
                  <Text style={styles.shiftLabel}>MORNING PICKUP</Text>
                  <Text style={styles.shiftValue}>{formatShiftTime(contract.startShiftTime)}</Text>
                </View>
                <View style={styles.shiftArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
                </View>
                <View style={styles.shiftBox}>
                  <Text style={styles.shiftLabel}>EVENING DROP</Text>
                  <Text style={styles.shiftValue}>{formatShiftTime(contract.endShiftTime)}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <InfoRow
                icon={<Ionicons name="hourglass-outline" size={16} color="#64748B" />}
                label="Shift Duration"
                value={formatShiftDuration(contract.startShiftTime, contract.endShiftTime)}
              />
            </SectionCard>

            {/* Assigned bus */}
            <SectionCard
              title="Assigned Bus"
              icon={<Ionicons name="bus-outline" size={18} color="#067BF9" />}
            >
              {contract.bus ? (
                <>
                  <View style={styles.busHeaderRow}>
                    <View style={styles.busIconBox}>
                      <MaterialCommunityIcons name="bus-side" size={24} color="#067BF9" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.busNumber}>{contract.bus.busNumber ?? "—"}</Text>
                      <Text style={styles.busBrand}>
                        {contract.bus.busBrand ?? "Bus"}
                        {contract.bus.seatCapacity ? ` · ${contract.bus.seatCapacity} seats` : ""}
                      </Text>
                    </View>
                    {contract.bus.status && (
                      <View style={[styles.smallPill, { backgroundColor: contract.bus.status === "active" ? "#D1FAE5" : "#FEF3C7" }]}>
                        <Text
                          style={[
                            styles.smallPillText,
                            { color: contract.bus.status === "active" ? "#065F46" : "#B45309" },
                          ]}
                        >
                          {titleCase(contract.bus.status)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {amenities.length > 0 && (
                    <View style={styles.amenitiesRow}>
                      {amenities.map((key) => {
                        const meta = AMENITY_LABELS[key];
                        return (
                          <View key={key} style={styles.amenityChip}>
                            {meta?.icon ?? <Ionicons name="checkmark-circle-outline" size={15} color="#067BF9" />}
                            <Text style={styles.amenityText}>{meta?.label ?? titleCase(key)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <View style={styles.divider} />

                  <InfoRow
                    icon={<Ionicons name="card-outline" size={16} color="#64748B" />}
                    label="Registration Number"
                    value={contract.bus.registrationNumber ?? "—"}
                  />
                  <InfoRow
                    icon={<MaterialCommunityIcons name="wrench-outline" size={16} color="#64748B" />}
                    label="Condition"
                    value={titleCase(contract.bus.busCondition)}
                  />
                  {contract.bus.routeName && (
                    <InfoRow
                      icon={<Ionicons name="git-branch-outline" size={16} color="#64748B" />}
                      label="Assigned Route"
                      value={contract.bus.routeName}
                    />
                  )}

                  {contract.bus.driverName && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.driverRow}>
                        <View style={styles.driverAvatar}>
                          <Text style={styles.driverInitials}>
                            {contract.bus.driverName
                              .split(" ")
                              .map((part) => part.charAt(0))
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.infoLabel}>DRIVER</Text>
                          <Text style={styles.driverName}>{contract.bus.driverName}</Text>
                        </View>
                        {contract.bus.driverPhone && (
                          <TouchableOpacity
                            style={styles.callBtn}
                            activeOpacity={0.85}
                            onPress={() => handleCallDriver(contract.bus!.driverPhone!)}
                          >
                            <Ionicons name="call" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}
                </>
              ) : (
                <View style={styles.emptyBlock}>
                  <Ionicons name="bus-outline" size={30} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No bus assigned yet</Text>
                  <Text style={styles.emptySubText}>
                    A bus will be allocated to this contract by the operations team.
                  </Text>
                </View>
              )}
            </SectionCard>

            {/* Billing */}
            <SectionCard
              title="Billing Summary"
              icon={<MaterialCommunityIcons name="receipt" size={18} color="#067BF9" />}
            >
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{formatAmount(contract.totalBilled)}</Text>
                  <Text style={styles.statLabel}>Billed</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: "#059669" }]}>{formatAmount(contract.totalPaid)}</Text>
                  <Text style={styles.statLabel}>Paid</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: contract.outstandingAmount > 0 ? "#EF4444" : "#1E293B" }]}>
                    {formatAmount(contract.outstandingAmount)}
                  </Text>
                  <Text style={styles.statLabel}>Outstanding</Text>
                </View>
              </View>

              {Boolean(contract.renewedFromContractId || (contract.carriedBalance != null && contract.carriedBalance > 0)) && (
                <View style={{ marginTop: 12, padding: 14, backgroundColor: "#FEF2F2", borderRadius: 12, borderWidth: 1, borderColor: "#FECACA" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="receipt" size={18} color="#DC2626" />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#991B1B" }}>
                      1st Month Billing Breakdown
                    </Text>
                  </View>
                  <View style={{ height: 8 }} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: "#64748B" }}>Base Monthly Rate</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#1E293B" }}>{formatAmount(contract.billingAmount)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: (contract.carriedBalance ?? 0) > 0 ? "#DC2626" : "#059669" }}>Predecessor Worked Days</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: (contract.carriedBalance ?? 0) > 0 ? "#DC2626" : "#059669" }}>+{formatAmount(contract.carriedBalance ?? 0)}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: "#FECACA", marginVertical: 6 }} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>1st Month Total Due</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>{formatAmount(contract.billingAmount + (contract.carriedBalance ?? 0))}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, color: "#059669", fontWeight: "600" }}>From Month 2 Onwards</Text>
                    <Text style={{ fontSize: 12, color: "#059669", fontWeight: "600" }}>{formatAmount(contract.billingAmount)} / mo</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: "#7F1D1D", marginTop: 8, lineHeight: 15 }}>
                    Renewed from Contract #{contract.renewedFromContractId ?? 'prior'}. {(contract.carriedBalance ?? 0) > 0 ? `Includes +${formatAmount(contract.carriedBalance)} for days operated before renewal (unworked days deducted).` : `Predecessor worked days balance is Rs. 0.00.`} Starting from month 2, regular monthly rate applies.
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              {contract.invoices.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <MaterialCommunityIcons name="receipt" size={30} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No invoices yet</Text>
                  <Text style={styles.emptySubText}>
                    Invoices raised against this contract will appear here.
                  </Text>
                </View>
              ) : (
                contract.invoices.map((inv, idx) => {
                  const st = invoiceStatusStyle(inv.status);
                  return (
                    <React.Fragment key={`${inv.contractId}-${inv.invoiceNumber}`}>
                      {idx > 0 && <View style={styles.divider} />}
                      <View style={styles.invoiceRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.invoiceRef}>{buildInvoiceRef(inv)}{inv.busNumber ? ` · ${inv.busNumber}` : ""}</Text>
                          <Text style={styles.invoiceDate}>
                            {formatContractDate(inv.date)}
                            {inv.dueDate ? ` · due ${formatContractDate(inv.dueDate)}` : ""}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 5 }}>
                          <Text style={styles.invoiceAmount}>{formatAmount(inv.amount)}</Text>
                          <View style={[styles.smallPill, { backgroundColor: st.bg }]}>
                            <Text style={[styles.smallPillText, { color: st.text }]}>
                              {displayInvoiceStatus(inv.status)}
                            </Text>
                          </View>
                          {inv.status === "paid" && (
                            <TouchableOpacity
                              style={styles.receiptIconBtn}
                              hitSlop={8}
                              disabled={pdfBusy === `invoice-${inv.invoiceNumber}`}
                              onPress={() => handleDownloadInvoiceReceipt(inv)}
                            >
                              {pdfBusy === `invoice-${inv.invoiceNumber}` ? (
                                <ActivityIndicator size="small" color="#067BF9" />
                              ) : (
                                <>
                                  <Ionicons name="download-outline" size={13} color="#067BF9" />
                                  <Text style={styles.receiptIconBtnText}>Receipt</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })
              )}
            </SectionCard>

            {/* Company & contract info */}
            <SectionCard
              title="Contract Information"
              icon={<Ionicons name="business-outline" size={18} color="#067BF9" />}
            >
              {contract.companyName && (
                <InfoRow
                  icon={<Ionicons name="briefcase-outline" size={16} color="#64748B" />}
                  label="Company"
                  value={contract.companyName}
                />
              )}
              {contract.contactPersonName && (
                <InfoRow
                  icon={<Ionicons name="person-outline" size={16} color="#64748B" />}
                  label="Contact Person"
                  value={contract.contactPersonName}
                />
              )}
              {contract.contactPhone && (
                <InfoRow
                  icon={<Ionicons name="call-outline" size={16} color="#64748B" />}
                  label="Contact Phone"
                  value={contract.contactPhone}
                />
              )}
              <InfoRow
                icon={<Ionicons name="calendar-outline" size={16} color="#64748B" />}
                label="Contract Period"
                value={`${formatContractDate(contract.startDate)} – ${formatContractDate(contract.endDate)}`}
              />
              <InfoRow
                icon={<Ionicons name="document-text-outline" size={16} color="#64748B" />}
                label="Created On"
                value={contract.createdAt ? formatContractDate(contract.createdAt.substring(0, 10)) : "—"}
              />
            </SectionCard>

            {/* Contract document */}
            {contract.status === "active" && (
              <SectionCard
                title="Contract Document"
                icon={<Ionicons name="document-attach-outline" size={18} color="#067BF9" />}
              >
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.docActionBtn, styles.docActionBtnOutline]}
                    disabled={pdfBusy === "view-contract"}
                    onPress={handleViewContractPdf}
                  >
                    {pdfBusy === "view-contract" ? (
                      <ActivityIndicator size="small" color="#067BF9" />
                    ) : (
                      <>
                        <Ionicons name="eye-outline" size={16} color="#067BF9" />
                        <Text style={styles.docActionBtnOutlineText}>View PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.docActionBtn, styles.docActionBtnSolid]}
                    disabled={pdfBusy === "download-contract"}
                    onPress={handleDownloadContractPdf}
                  >
                    {pdfBusy === "download-contract" ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.docActionBtnSolidText}>Download PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </SectionCard>
            )}

            {/* Actions */}
            <Pressable
              style={({ pressed }) => [styles.billingBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push("/corporate/corporate-billing")}
            >
              <MaterialCommunityIcons name="receipt" size={18} color="#FFFFFF" />
              <Text style={styles.billingBtnText}>Go to Billing</Text>
            </Pressable>

            {(contract.status === "pending" || contract.status === "active") && contract.cancellation.status !== "pending" && (
              <Pressable
                style={({ pressed }) => [styles.cancelContractBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setCancelModalVisible(true)}
              >
                <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                <Text style={styles.cancelContractBtnText}>
                  {contract.cancellation.status === "rejected" ? "Request Cancellation Again" : "Cancel Contract"}
                </Text>
              </Pressable>
            )}
          </Animated.View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <Modal visible={cancelModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Cancellation</Text>
            <Text style={styles.modalSubtitle}>
              Admin must accept before this contract is actually cancelled.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={cancelReason}
              onChangeText={(text) => setCancelReason(text.slice(0, MAX_CANCEL_REASON_LENGTH))}
              placeholder="Reason for cancellation"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              maxLength={MAX_CANCEL_REASON_LENGTH}
            />
            <Text style={styles.modalCharCount}>{cancelReason.length}/{MAX_CANCEL_REASON_LENGTH}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#F1F5F9" }]}
                onPress={() => { setCancelModalVisible(false); setCancelReason(""); }}
              >
                <Text style={[styles.modalBtnText, { color: "#334155" }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#DC2626", opacity: cancelReason.trim().length >= MIN_CANCEL_REASON_LENGTH ? 1 : 0.5 }]}
                disabled={cancelReason.trim().length < MIN_CANCEL_REASON_LENGTH || cancelSubmitting}
                onPress={submitCancelRequest}
              >
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                  {cancelSubmitting ? "Sending..." : "Send Request"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EDF3",
  },
  backBtn: { width: 32, alignItems: "flex-start" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },

  centered: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  errorText: { fontSize: 12, color: "#94A3B8", fontWeight: "600", textAlign: "center" },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },

  // Hero
  heroCard: {
    borderRadius: 18,
    backgroundColor: "#067BF9",
    padding: 20,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#067BF9",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 7,
  },
  decorCircleLg: {
    position: "absolute", top: -50, right: -40, width: 160, height: 160,
    borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)",
  },
  decorCircleSm: {
    position: "absolute", bottom: -30, left: -25, width: 110, height: 110,
    borderRadius: 55, backgroundColor: "rgba(255,255,255,0.06)",
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  heroContractId: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.75)", letterSpacing: 0.6 },
  heroName: { fontSize: 18, fontWeight: "800", color: "#FFFFFF", marginBottom: 8, letterSpacing: -0.2 },
  heroRouteRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  heroRouteCity: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.92)", flexShrink: 1 },
  heroAmountLabel: {
    fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.2, marginBottom: 4,
  },
  heroAmount: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5, marginBottom: 18 },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  progressText: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.85)" },

  // Cards
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 12 },

  // Info rows
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  infoIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center",
  },
  infoLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8", letterSpacing: 0.6, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: "600", color: "#1E293B" },

  // Shift
  shiftRow: { flexDirection: "row", alignItems: "center" },
  shiftBox: {
    flex: 1, backgroundColor: "#F8FAFC", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 12, alignItems: "center",
  },
  shiftArrow: { paddingHorizontal: 10 },
  shiftLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8", letterSpacing: 0.7, marginBottom: 4 },
  shiftValue: { fontSize: 13, fontWeight: "600", color: "#0F172A" },

  // Bus
  busHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  busIconBox: {
    width: 46, height: 46, borderRadius: 12, backgroundColor: "#E0F0FF",
    alignItems: "center", justifyContent: "center",
  },
  busNumber: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  busBrand: { fontSize: 12, fontWeight: "500", color: "#64748B", marginTop: 2 },
  smallPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  smallPillText: { fontSize: 10, fontWeight: "700" },
  amenitiesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  amenityChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F1F7FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  amenityText: { fontSize: 11, fontWeight: "600", color: "#1E40AF" },

  // Driver
  driverRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  driverAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#0F172A",
    alignItems: "center", justifyContent: "center",
  },
  driverInitials: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  driverName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  callBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: "#10B981",
    alignItems: "center", justifyContent: "center",
  },

  // Billing
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1, backgroundColor: "#F8FAFC", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 8, alignItems: "center",
  },
  statValue: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 4, textAlign: "center" },
  statLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },
  invoiceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  invoiceRef: { fontSize: 13, fontWeight: "700", color: "#1E293B", marginBottom: 3 },
  invoiceDate: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  invoiceAmount: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  receiptIconBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 2 },
  receiptIconBtnText: { fontSize: 11, fontWeight: "700", color: "#067BF9" },

  // Contract document actions
  docActionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderRadius: 10, paddingVertical: 12,
  },
  docActionBtnOutline: { backgroundColor: "#F0F7FF", borderWidth: 1, borderColor: "#BFDBFE" },
  docActionBtnOutlineText: { fontSize: 13, fontWeight: "700", color: "#067BF9" },
  docActionBtnSolid: { backgroundColor: "#067BF9" },
  docActionBtnSolidText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },

  // Empty
  emptyBlock: { alignItems: "center", paddingVertical: 18, gap: 5 },
  emptyText: { fontSize: 14, color: "#94A3B8", fontWeight: "600" },
  emptySubText: { fontSize: 12, fontWeight: "500", color: "#CBD5E1", textAlign: "center", paddingHorizontal: 20 },

  // Action
  billingBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#067BF9", borderRadius: 12, paddingVertical: 14,
    shadowColor: "#067BF9", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  billingBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  // Cancel contract
  cancelContractBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#FECACA",
    paddingVertical: 14, marginTop: 12,
  },
  cancelContractBtnText: { fontSize: 14, fontWeight: "700", color: "#DC2626" },

  // Cancellation banner
  cancelBanner: {
    backgroundColor: "#FFFBEB", borderRadius: 14, borderWidth: 1, borderColor: "#FDE68A",
    padding: 16, marginBottom: 16, gap: 8,
  },
  cancelBannerHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cancelBannerTitle: { fontSize: 13, fontWeight: "700", color: "#92400E", flex: 1 },
  cancelBannerReason: { fontSize: 12, color: "#78350F", fontWeight: "500" },
  cancelBannerActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  cancelBannerBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  cancelBannerBtnText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },

  // Renewal reminder banner
  renewBanner: {
    backgroundColor: "#EFF6FF", borderRadius: 14, borderWidth: 1, borderColor: "#BFDBFE",
    padding: 16, marginBottom: 16, gap: 10,
  },
  renewBannerTitle: { fontSize: 13, fontWeight: "700", color: "#1D4ED8", flex: 1 },
  renewBannerBtn: { backgroundColor: "#1D4ED8", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  renewBannerBtnText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  renewPendingBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "#FEF3C7", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  renewPendingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F59E0B" },
  renewPendingText: { fontSize: 12, fontWeight: "700", color: "#B45309" },

  // Cancel request modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  modalSubtitle: { fontSize: 12, color: "#64748B", marginTop: 4, marginBottom: 12 },
  modalInput: {
    borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 12,
    fontSize: 13, color: "#1E293B", minHeight: 80, textAlignVertical: "top",
  },
  modalCharCount: { fontSize: 11, fontWeight: "600", color: "#94A3B8", textAlign: "right", marginTop: 4 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { fontSize: 13, fontWeight: "700" },
});
