import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions, // Get screen dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@/context/UserContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';  // Import the Print module
import * as Sharing from 'expo-sharing'; // Import the Sharing module to allow sharing the generated PDF
import { apiUrl } from '@/config/env';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';


type EarningItem = {
  id: string; // Unique identifier for each earning item
  bookingReference: string;
  route: string;
  date: string;
  time: string;
  amount: number;
}; // Define the type for each earning item

type WeeklyPoint = {
  date: string;
  day: string;
  amount: number;
  isHighlighted?: boolean; // in the chart
}; // Define the type for each weekly point

type DriverEarningsResponse = {
  totalEarnings: number;
  monthlyEarnings: number;
  weeklyEarnings: number;
  previousWeeklyEarnings: number;
  percentageChange: number;
  earnings: Array<{
    id: string;
    bookingReference: string;
    route: string;
    date: string;
    time: string | null;
    amount: number;
  }>;
  weeklyBreakdown: Array<{
    date: string;
    amount: number;
  }>;
};

const formatAmount = (amount: number) =>
  `LKR ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatCompactAmount = (amount: number) => {
  if (amount >= 1000000) return `LKR ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `LKR ${(amount / 1000).toFixed(1)}k`;
  return formatAmount(amount);
};

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

const formatTime = (time: string | null) => time
  ? new Date(`1970-01-01T${time}`).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  : '-';

const formatWeekday = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
  });

export default function DriverEarningsScreen() { 
  const router = useRouter();   
  const { user } = useUser();  // Get the current user from the UserContext
  const { t } = useLanguage(); // Get the translation function from the LanguageContext
  const insets = useSafeAreaInsets(); // Get the safe area insets to ensure content is not hidden behind notches or system UI elements
  const { width } = useWindowDimensions();  // Get the window width 

  const [showWeekly, setShowWeekly] = useState(false);  // State to controlweekly earnings breakdown modal
  const [earningsResponse, setEarningsResponse] = useState<DriverEarningsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [receipt, setReceipt] = useState<EarningItem | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const fetchDriverEarnings = async () => {
        if (!user?.userId || !user?.token) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setLoadError(null);

        try {
          const response = await fetch(
            apiUrl(`/api/drivers/${user.userId}/earnings`),
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${user.token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const result = await response.json();
          if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || `Failed to fetch earnings (${response.status})`);
          }

          if (!cancelled) {
            setEarningsResponse(result.data);
          }
        } catch (error) {
          if (!cancelled) {
            setLoadError(error instanceof Error ? error.message : 'Failed to load earnings');
            setEarningsResponse(null);
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      };

      void fetchDriverEarnings();
      return () => {
        cancelled = true;
      };
    }, [reloadKey, user?.userId, user?.token])
  );

  const earningsData: EarningItem[] = useMemo(
    () => (earningsResponse?.earnings || []).map((earning) => ({
      id: earning.id,
      bookingReference: earning.bookingReference,
      route: earning.route,
      date: formatDate(earning.date),
      time: formatTime(earning.time),
      amount: Number(earning.amount),
    })),
    [earningsResponse?.earnings]
  );

  const weeklyData: WeeklyPoint[] = useMemo(() => {
    const points = (earningsResponse?.weeklyBreakdown || []).map((point) => ({
      date: point.date,
      day: formatWeekday(point.date),
      amount: Number(point.amount),
    }));
    const max = Math.max(0, ...points.map((point) => point.amount));
    return points.map((point) => ({
      ...point,
      isHighlighted: max > 0 && point.amount === max,
    }));
  }, [earningsResponse?.weeklyBreakdown]);

  const earningsAmount = Number(earningsResponse?.monthlyEarnings || 0);
  const weeklyAmount = Number(earningsResponse?.weeklyEarnings || 0);
  const percentageChange = Number(earningsResponse?.percentageChange || 0);
  const maxAmount = Math.max(1, ...weeklyData.map((d) => d.amount));
  const chartYAxisLabels = [maxAmount, maxAmount * (2 / 3), maxAmount * (1 / 3), 0];
  const percentageLabel = t('earnings.percentageChange', {
    percent: percentageChange.toFixed(2),
  });
  const handleExportPDF = async () => { 
  const html = `
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 24px;
            color: #111;
          }

          .header {
            text-align: center;
            border-bottom: 2px solid #2F6BFF;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }

          .header h1 {
            margin: 0;
            font-size: 22px;
            color: #2F6BFF;
          }

          .sub {
            font-size: 12px;
            color: #666;
            margin-top: 6px;
          }

          .card {
            background: #EAF2FF;
            padding: 16px;
            border-radius: 10px;
            margin-bottom: 20px;
          }

          .label {
            font-size: 12px;
            color: #777;
          }

          .value {
            font-size: 20px;
            font-weight: bold;
            margin-top: 4px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }

          th {
            text-align: left;
            background: #2F6BFF;
            color: white;
            padding: 10px;
            font-size: 12px;
          }

          td {
            padding: 10px;
            border-bottom: 1px solid #eee;
            font-size: 12px;
          }

          .total {
            text-align: right;
            font-size: 16px;
            font-weight: bold;
            margin-top: 16px;
            color: #2F6BFF;
          }

          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #999;
          }
        </style>
      </head>

      <body>

        <div class="header">
          <h1>${t('earnings.driverEarningsReport')}</h1>
          <div class="sub">${t('earnings.monthlySummaryStatement')}</div>
        </div>

        <div class="card">
          <div class="label">${t('earnings.driverName')}</div>
          <div class="value">${user?.firstName || t('earnings.driverFallback')}</div>
        </div>

        <div class="card">
          <div class="label">${t('earnings.totalEarnings')}</div>
          <div class="value">LKR ${earningsAmount.toLocaleString('en-US', { //convert amount to string with d.p & commas
              minimumFractionDigits: 2,
              maximumFractionDigits: 2, // 2 d.p
            })}</div>
        </div>

        <h3>${t('earnings.weeklyBreakdown')}</h3>

        <table>
          <tr>
            <th>${t('earnings.day')}</th>
            <th>${t('earnings.amount')}</th>
          </tr>
          ${weeklyData
            .map(
              (d) => `
            <tr>
              <td>${d.day}</td>
              <td>${formatAmount(d.amount)}</td>
            </tr>
          `
            )
            .join('')} //join the table rows
        </table>

        <div class="total">
          ${t('earnings.netTotal', {
            amount: earningsAmount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2, // 2 d.p
            }),
          })}
        </div>

        <div class="footer">
          ${t('earnings.generatedBy')}
        </div>

      </body>
      </html>
      `;

  const { uri } = await Print.printToFileAsync({ html }); // Generate a PDF file from the HTML content and get the file URI
  await Sharing.shareAsync(uri); // Share the generated PDF file
};

  const isSmallPhone = width < 360;
  const isCompact = width < 390;
  const horizontalPadding = isSmallPhone ? 14 : 16;
  const contentWidth = Math.min(width - horizontalPadding * 2, 560); // calculates the width of the content area

  const chartYAxisWidth = isSmallPhone ? 32 : 38; 
  const chartAreaWidth = contentWidth - 32 - chartYAxisWidth;
  const barWidth = Math.max(16, Math.min(26, Math.floor(chartAreaWidth / 10)));

  const { darkMode } = useTheme(); // Get the current theme mode (dark or light) from the ThemeContext to apply appropriate colors to the UI elements, ensuring that the design is consistent with the user's theme preference and provides good readability and visual appeal in both modes.

  const theme = useMemo(() => ({
  background: darkMode ? '#111' : '#F1F5F9',
  card: darkMode ? '#1E1E1E' : '#FFF',
  text: darkMode ? '#FFF' : '#000',
  secondaryText: darkMode ? '#AAA' : '#666',
  border: darkMode ? '#333' : '#E2E8F0',
  }), [darkMode]);

  const styles = useMemo(
    () =>
      createStyles({
        horizontalPadding,
        bottomInset: insets.bottom,
        isSmallPhone,
        isCompact,
        barWidth,
        theme,
      }),
    [horizontalPadding, insets.bottom, isSmallPhone, isCompact, barWidth, theme]
  );

  const renderEarningItem = (item: EarningItem) => ( //this function renders each earning item
    <View key={item.id}>
      <View style={styles.earningItemContainer}>
        <View style={[styles.earningItem, isCompact && styles.earningItemStack]}>
          <View style={styles.earningDetails}>
            <Text style={styles.routeText} numberOfLines={1}>
              {item.route}
            </Text>
            <Text style={styles.dateTimeText} numberOfLines={1}>
              {item.date} • {item.time}
            </Text>
          </View>

          <View style={[styles.earningRightContainer, isCompact && styles.earningRightCompact]}>
            <Text style={styles.earningAmount}>{formatAmount(item.amount)}</Text>
            <View style={styles.netEarningsBadge}>
              <Text style={styles.netEarningsText}>{t('earnings.netEarnings')}</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.receiptLink}
        onPress={() => setReceipt(item)}
      >

        <Text style={styles.receiptLinkText}>{t('earnings.viewReceipt')}</Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color="#2F6BFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false} // Hide the vertical scroll indicator for a cleaner look
        contentInsetAdjustmentBehavior="automatic" //auto adjust safe area
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerIconButton} onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t('earnings.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('earnings.greeting', { name: user?.firstName || t('earnings.driverFallback') })}
              </Text>
            </View>
          </View>

          <View style={styles.earningsCard}>
            <View style={[styles.cardHeader, isCompact && styles.cardHeaderStack]}>
              <Text style={styles.cardLabel}>{t('earnings.yourMonthlyEarnings')}</Text>

              <View style={styles.percentageBadge}>
                <MaterialCommunityIcons name="trending-up" size={14} color="#22C55E" />
                <Text style={styles.percentageText}>{percentageLabel}</Text>
              </View>
            </View>

            <Text style={styles.earningsAmountTotal}>
              {isLoading ? '—' : formatAmount(earningsAmount)}
            </Text>
            <Text style={styles.updatedText} numberOfLines={2}>
              {loadError || t('earnings.updatedJustNow')}
            </Text>
          </View>

          <View style={styles.weeklySection}>
            <View style={[styles.weeklyHeader, isCompact && styles.weeklyHeaderStack]}>
              <View style={styles.weeklyHeaderText}>
                <Text style={styles.weeklyTitle}>{t('earnings.weeklyEarnings')}</Text>
                <Text style={styles.weeklySubtitle}>{t('earnings.last7Days')}</Text>
              </View>

              <Text style={styles.weeklyAmount}>{formatCompactAmount(weeklyAmount)}</Text>
            </View>

            <View style={styles.chartContainer}>
              <View style={styles.chartYAxis}>
                {chartYAxisLabels.map((label) => (
                  <Text key={label} style={styles.yAxisLabel}>
                    {Math.round(label).toLocaleString('en-US')}
                  </Text>
                ))}
              </View>

              <View style={styles.barsContainer}>
                {weeklyData.map((data) => (
                  <View key={data.day} style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: (data.amount / maxAmount) * 120,
                          backgroundColor: data.isHighlighted ? '#2F6BFF' : '#D1D5DB',
                        },
                      ]}
                    />
                    <Text style={styles.dayLabel}>{data.day}</Text>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity
            style={styles.viewAllLink}
            onPress={() => setShowWeekly(true)}
          >
            <Text style={styles.viewAllText}>{t('earnings.viewAll')}</Text>
          </TouchableOpacity>
                    </View>

          <View style={styles.earningsListSection}>
            {earningsData.length > 0 ? (
              earningsData.map(renderEarningItem)
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="cash-remove"
                  size={28}
                  color={theme.secondaryText}
                />
                <Text style={styles.emptyStateText}>
                  {isLoading
                    ? 'Loading earnings...'
                    : loadError || t('allocations.noDataAvailable')}
                </Text>
                {!isLoading && loadError && (
                  <TouchableOpacity onPress={() => setReloadKey((key) => key + 1)}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF}>
            <MaterialCommunityIcons name="download" size={20} color='#FFF' />
            <Text style={styles.exportButtonText}>{t('earnings.exportMonthlyReport')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {receipt && (
  <View style={styles.modalOverlay}>
    <View style={styles.receiptModal}>

      <Text style={styles.receiptTitle}>{t('earnings.tripReceipt')}</Text>

      <View style={styles.receiptRow}>
        <Text style={styles.receiptLabel}>{t('earnings.route')}</Text>
        <Text style={styles.receiptValue}>{receipt.route}</Text>
      </View>

      <View style={styles.receiptRow}>
        <Text style={styles.receiptLabel}>{t('earnings.date')}</Text>
        <Text style={styles.receiptValue}>{receipt.date}</Text>
      </View>

      <View style={styles.receiptRow}>
        <Text style={styles.receiptLabel}>{t('earnings.time')}</Text>
        <Text style={styles.receiptValue}>{receipt.time}</Text>
      </View>

      <View style={styles.amountBox}>
        <Text style={styles.amountText}>{receipt.amount}</Text>
      </View>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setReceipt(null)}
      >
        <Text style={styles.closeText}>{t('earnings.close')}</Text>
      </TouchableOpacity>

    </View>
  </View>
)}

{showWeekly && (
  <View style={styles.modalOverlay}>
    <View style={styles.weeklyModal}>

      <Text style={styles.weeklyTitleModal}>{t('earnings.weeklyEarnings')}</Text>
      <Text style={styles.weeklySubtitleModal}>{t('earnings.last7DaysBreakdown')}</Text>

      {weeklyData.map((d) => (
        <View key={d.day} style={styles.weekRow}>
          <Text style={styles.weekDay}>{d.day}</Text>
          <Text style={styles.weekAmount}>LKR {d.amount}</Text>
        </View>
      ))}

      <View style={styles.weekTotalBox}>
        <Text style={styles.weekTotalText}>
          {t('earnings.totalAmount', { amount: weeklyAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) })}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setShowWeekly(false)}
      >
        <Text style={styles.closeText}>{t('earnings.close')}</Text>
      </TouchableOpacity>

    </View>
  </View>
)}
    </SafeAreaView>
  );
}

function createStyles({
  horizontalPadding,
  bottomInset,
  isSmallPhone,
  isCompact,
  barWidth,
  theme,
}: {
  horizontalPadding: number;
  bottomInset: number;
  isSmallPhone: boolean;
  isCompact: boolean;
  barWidth: number;
  theme: any;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      paddingBottom: Math.max(24, bottomInset + 16),
    },
    content: {
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: horizontalPadding,
      paddingVertical: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerIconButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      flexShrink: 0,
    },
    headerContent: {
      flex: 1,
      minWidth: 0,
      marginLeft: 12,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: isSmallPhone ? 16 : 18,
      fontWeight: "700",
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 2,
      fontWeight: "500",
    },
    notificationDot: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#2F6BFF',
    },
    earningsCard: {
      marginHorizontal: horizontalPadding,
      marginVertical: 16,
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    cardHeaderStack: {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
    cardLabel: {
      fontSize: 11,
      color: theme.text,
      fontWeight: "600",
    },
    earningsAmount: {
      fontSize: isSmallPhone ? 20 : 24,
      fontWeight: "700",
      color: theme.text,
      marginVertical: 8,
      letterSpacing: -0.5,
    },
    percentageBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#DCFCE7',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    percentageText: {
      fontSize: 11,
      fontWeight: "700",
      color: '#22C55E',
      marginLeft: 4,
    },
    earningsAmountTotal: {
      fontSize: isSmallPhone ? 24 : 28,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    updatedText: {
      fontSize: 11,
      color: '#999',
      fontWeight: "500",
    },
    weeklySection: {
      marginHorizontal: horizontalPadding,
      marginVertical: 12,
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
    },
    weeklyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 16,
    },
    weeklyHeaderStack: {
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    weeklyHeaderText: {
      flexShrink: 1,
    },
    weeklyTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    weeklySubtitle: {
      fontSize: 11,
      color: '#999',
      marginTop: 2,
      fontWeight: "500",
    },
    weeklyAmount: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      flexShrink: 0,
    },
    chartContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 16,
      height: 160,
    },
    chartYAxis: {
      justifyContent: 'space-between',
      height: '100%',
      marginRight: isSmallPhone ? 8 : 12,
      width: isSmallPhone ? 32 : 38,
    },
    yAxisLabel: {
      fontSize: 11,
      color: '#999',
      fontWeight: "600",
    },
    barsContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      borderLeftWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#E2E8F0',
      paddingLeft: 8,
      paddingBottom: 8,
      minWidth: 0,
    },
    barWrapper: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      flex: 1,
    },
    bar: {
      width: barWidth,
      borderRadius: 3,
    },
    dayLabel: {
      fontSize: 11,
      color: '#666',
      fontWeight: "600",
    },
    viewAllLink: {
      alignSelf: 'flex-end',
    },
    viewAllText: {
      fontSize: 12,
      color: '#2F6BFF',
      fontWeight: "600",
    },
    earningsListSection: {
      marginHorizontal: horizontalPadding,
      marginVertical: 12,
      gap: 12,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 30,
      backgroundColor: theme.card,
      borderRadius: 12,
      gap: 8,
    },
    emptyStateText: {
      color: theme.secondaryText,
      fontSize: 14,
      textAlign: 'center',
    },
    retryText: {
      color: '#2F6BFF',
      fontSize: 14,
      fontWeight: "700",
      marginTop: 4,
    },
    earningItemContainer: {
      padding: 14,
      backgroundColor: theme.card,
      borderRadius: 12,
    },
    earningItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    earningItemStack: {
      flexDirection: 'column',
    },
    earningDetails: {
      flex: 1,
      minWidth: 0,
    },
    routeText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
    },
    dateTimeText: {
      fontSize: 11,
      color: '#999',
      marginTop: 4,
      fontWeight: "500",
    },
    earningRightContainer: {
      alignItems: 'flex-end',
      marginLeft: 12,
      flexShrink: 0,
    },
    earningRightCompact: {
      alignItems: 'flex-start',
      marginLeft: 0,
    },
    earningAmount: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
    },
    netEarningsBadge: {
      backgroundColor: '#DCFCE7',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 4,
      marginTop: 6,
    },
    netEarningsText: {
      fontSize: 10,
      color: '#22C55E',
      fontWeight: "600",
    },
    receiptLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    receiptLinkText: {
      fontSize: 12,
      color: '#2F6BFF',
      fontWeight: "600",
      marginRight: 4,
    },
    exportButton: {
      marginHorizontal: horizontalPadding,
      marginVertical: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: '#2F6BFF',
      backgroundColor:'#2F6BFF',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    exportButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: '#fff',
      marginLeft: 8,
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },

    receiptModal: {
      width: '100%',
      backgroundColor: theme.card,
      borderColor: '#2F6BFF',
      borderRadius: 16,
      padding: 20,
    },

    receiptTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 16,
      textAlign: 'center',
      color: '#2F6BFF',
    },

    receiptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },

    receiptLabel: {
      fontSize: 11,
      color: theme.secondaryText,
      fontWeight: "600",
    },

    receiptValue: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.text,
    },

    amountBox: {
      marginTop: 16,
      padding: 14,
      backgroundColor: '#EAF2FF',
      borderRadius: 10,
      alignItems: 'center',
    },

    amountText: {
      fontSize: 18,
      fontWeight: "700",
      color: '#2F6BFF',
    },

    closeBtn: {
      marginTop: 16,
      padding: 12,
      backgroundColor: '#2F6BFF',
      borderRadius: 10,
      alignItems: 'center',
    },

    closeText: {
      color: '#FFF',
      fontWeight: "700",
    },

    weeklyModal: {
  width: '100%',
  backgroundColor: theme.card,
  borderRadius: 16,
  padding: 20,
},

weeklyTitleModal: {
  fontSize: 18,
  fontWeight: "700",
  color: '#2F6BFF',
  textAlign: 'center',
},

weeklySubtitleModal: {
  fontSize: 11,
  color: '#999',
  textAlign: 'center',
  marginBottom: 16,
  marginTop: 4,
},

weekRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingVertical: 8,
  borderBottomWidth: 1,
  borderBottomColor: '#F1F5F9',
},

weekDay: {
  fontSize: 13,
  fontWeight: "600",
  color: theme.text,
},

weekAmount: {
  fontSize: 13,
  fontWeight: "700",
  color: '#2F6BFF',
},

weekTotalBox: {
  marginTop: 16,
  padding: 12,
  backgroundColor: '#EAF2FF',
  borderRadius: 10,
  alignItems: 'center',
},

weekTotalText: {
  fontSize: 14,
  fontWeight: "700",
  color: '#2F6BFF',
},
      });
    }
