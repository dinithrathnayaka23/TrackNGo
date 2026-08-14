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
  type CorporateProfileDto,
  getCorporateProfile,
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

// ─── Menu Row ─────────────────────────────────────────────────────────────────

type MenuRowProps = {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  showChevron?: boolean;
};

function MenuRow({
  icon,
  iconBg,
  label,
  subtitle,
  value,
  onPress,
  showChevron = true,
}: MenuRowProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 25 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.menuRow, { transform: [{ scale }] }]}>
        <View style={[styles.menuIconBox, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={styles.menuText}>
          <Text style={styles.menuLabel}>{label}</Text>
          {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={styles.menuValue} numberOfLines={1}>{value}</Text> : null}
        {showChevron && (
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CorporateProfileScreen() {
  const router = useRouter();
  const { currentUser, clearCurrentUser } = useSession();

  const [profile, setProfile] = useState<CorporateProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const avatarAnim = useFadeSlide(0);
  const managementAnim = useFadeSlide(120);
  const detailsAnim = useFadeSlide(180);
  const preferencesAnim = useFadeSlide(240);
  const logoutAnim = useFadeSlide(300);

  // ── Derived values ─────────────────────────────────────────────
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

  // ── Data loading ───────────────────────────────────────────────
  const loadProfile = useCallback(
    async (isRefresh = false) => {
      if (!currentUser?.userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getCorporateProfile(currentUser.userId);
        setProfile(data);
      } catch (err) {
        console.error("[CorporateProfile] Failed to load profile:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser],
  );

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

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

  // ── Render ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile(true)}
            tintColor="#2F6BFF"
          />
        }
      >
        {/* Avatar + company name */}
        <Animated.View
          style={[
            styles.avatarSection,
            { opacity: avatarAnim.opacity, transform: [{ translateY: avatarAnim.translateY }] },
          ]}
        >
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              {loading ? (
                <ActivityIndicator size="small" color="#2F6BFF" />
              ) : (
                <View style={styles.logoMark}>
                  <Ionicons name="bus" size={28} color="#FFFFFF" />
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.editBadge}
              onPress={() =>
                Alert.alert("Edit Profile", "Profile editing coming soon.")
              }
              hitSlop={8}
            >
              <Ionicons name="pencil" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.companyName}>{companyName}</Text>

          {profile?.email ? (
            <Text style={styles.emailText}>{profile.email}</Text>
          ) : null}

          <View style={styles.accountBadge}>
            <MaterialCommunityIcons name="office-building" size={13} color="#2F6BFF" />
            <Text style={styles.accountBadgeText}>Corporate Account</Text>
          </View>
        </Animated.View>

        {/* Management */}
        <Animated.View
          style={{ opacity: managementAnim.opacity, transform: [{ translateY: managementAnim.translateY }] }}
        >
          <Text style={styles.sectionLabel}>Management</Text>
          <View style={styles.menuCard}>
            <MenuRow
              icon={<MaterialCommunityIcons name="office-building" size={20} color="#2F6BFF" />}
              iconBg="#EEF4FF"
              label="Company Details"
              onPress={() =>
                Alert.alert("Company Details", "Company details management coming soon.")
              }
            />
            <View style={styles.menuDivider} />
            <MenuRow
              icon={<Ionicons name="people" size={20} color="#2F6BFF" />}
              iconBg="#EEF4FF"
              label="Contact Person Management"
              onPress={() =>
                Alert.alert("Contact Management", "Contact management coming soon.")
              }
            />
          </View>
        </Animated.View>

        {/* Company details (read-only info from API) */}
        {!loading && profile && (
          <Animated.View
            style={{
              opacity: detailsAnim.opacity,
              transform: [{ translateY: detailsAnim.translateY }],
            }}
          >
            <Text style={styles.sectionLabel}>Company Information</Text>
            <View style={styles.menuCard}>
              {profile.contactPersonName ? (
                <>
                  <MenuRow
                    icon={<Ionicons name="person-outline" size={20} color="#8B5CF6" />}
                    iconBg="#F3F0FF"
                    label="Contact Person"
                    value={profile.contactPersonName}
                    showChevron={false}
                    onPress={() => {}}
                  />
                  <View style={styles.menuDivider} />
                </>
              ) : null}

              {profile.contactPhone ? (
                <>
                  <MenuRow
                    icon={<Ionicons name="call-outline" size={20} color="#8B5CF6" />}
                    iconBg="#F3F0FF"
                    label="Contact Phone"
                    value={profile.contactPhone}
                    showChevron={false}
                    onPress={() => {}}
                  />
                  <View style={styles.menuDivider} />
                </>
              ) : null}

              {profile.industry ? (
                <>
                  <MenuRow
                    icon={<MaterialCommunityIcons name="factory" size={20} color="#8B5CF6" />}
                    iconBg="#F3F0FF"
                    label="Industry"
                    value={profile.industry}
                    showChevron={false}
                    onPress={() => {}}
                  />
                  <View style={styles.menuDivider} />
                </>
              ) : null}

              {profile.address ? (
                <MenuRow
                  icon={<Ionicons name="location-outline" size={20} color="#8B5CF6" />}
                  iconBg="#F3F0FF"
                  label="Address"
                  subtitle={profile.address}
                  showChevron={false}
                  onPress={() => {}}
                />
              ) : null}
            </View>
          </Animated.View>
        )}

        {/* Preferences */}
        <Animated.View
          style={{ opacity: preferencesAnim.opacity, transform: [{ translateY: preferencesAnim.translateY }] }}
        >
          <Text style={styles.sectionLabel}>Preferences</Text>
          <View style={styles.menuCard}>
            <MenuRow
              icon={<MaterialCommunityIcons name="face-agent" size={20} color="#10B981" />}
              iconBg="#D1FAE5"
              label="Support"
              subtitle="Help center & contact us"
              onPress={() => Alert.alert("Support", "Opening help center…")}
            />
          </View>
        </Animated.View>

        <View style={{ flex: 1, minHeight: 24 }} />

        {/* Logout */}
        <Animated.View
          style={{ opacity: logoutAnim.opacity, transform: [{ translateY: logoutAnim.translateY }] }}
        >
          <TouchableOpacity
            style={styles.logoutBtn}
            activeOpacity={0.82}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 16 }} />
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

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push("/corporate/corporate-billing")}
        >
          <Ionicons name="receipt-outline" size={22} color="#64748B" />
          <Text style={styles.tabLabel}>Billing</Text>
        </TouchableOpacity>

        {/* Profile – active */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push("/corporate/corporate-profile")}
        >
          <Ionicons name="person" size={22} color="#2F6BFF" />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F0F2F5" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 28, paddingBottom: 12, flexGrow: 1 },

  // Avatar section
  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatarWrapper: { position: "relative", marginBottom: 14 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0F172A", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 14, elevation: 6,
    borderWidth: 3, borderColor: "#F1F5F9",
  },
  logoMark: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
  },
  editBadge: {
    position: "absolute", bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13, backgroundColor: "#2F6BFF",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFFFFF",
    shadowColor: "#2F6BFF", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 5, elevation: 4,
  },
  companyName: {
    fontSize: 22, fontWeight: "800", color: "#0F172A",
    letterSpacing: -0.3, marginBottom: 4, textAlign: "center",
  },
  emailText: {
    fontSize: 13, color: "#94A3B8", fontWeight: "500", marginBottom: 8,
  },
  accountBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#EEF4FF", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  accountBadgeText: { fontSize: 12, fontWeight: "700", color: "#2F6BFF" },

  // Section label
  sectionLabel: {
    fontSize: 12, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.8,
    textTransform: "uppercase", marginBottom: 10, marginLeft: 2,
  },

  // Menu card
  menuCard: {
    backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1,
    borderColor: "#E8EDF3", overflow: "hidden", marginBottom: 24,
    shadowColor: "#0F172A", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  menuRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 14, backgroundColor: "#FFFFFF",
  },
  menuIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  menuSubtitle: { fontSize: 12, color: "#94A3B8", fontWeight: "500", marginTop: 2 },
  menuValue: { fontSize: 13, color: "#64748B", fontWeight: "500", maxWidth: 120, textAlign: "right" },
  menuDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 16 },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: "#FEF2F2", borderRadius: 14,
    paddingVertical: 16, borderWidth: 1, borderColor: "#FECACA",
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#EF4444" },

  // Tab bar
  tabBar: {
    flexDirection: "row", height: 64, backgroundColor: "#FFFFFF",
    borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingBottom: 4,
  },
  tabItem: { flex: 1, justifyContent: "center", alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", marginTop: 2 },
  tabLabelActive: { color: "#2F6BFF" },
});
