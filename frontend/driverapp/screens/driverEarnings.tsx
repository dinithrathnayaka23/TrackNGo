import React, { useMemo, useState, useEffect } from 'react';
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
import { useUser } from '@/context/UserContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';  // Import the Print module
import * as Sharing from 'expo-sharing'; // Import the Sharing module to allow sharing the generated PDF
import { useTheme } from '@/context/ThemeContext';


type EarningItem = {
  id: string; // Unique identifier for each earning item
  route: string;
  date: string;
  time: string;
  amount: string;
}; // Define the type for each earning item

type WeeklyPoint = {
  day: string;
  amount: number;
  isHighlighted?: boolean; // in the chart
}; // Define the type for each weekly point

export default function DriverEarningsScreen() { 
  const router = useRouter();   
  const { user } = useUser();  // Get the current user from the UserContext 
  const insets = useSafeAreaInsets(); // Get the safe area insets to ensure content is not hidden behind notches or system UI elements
  const { width } = useWindowDimensions();  // Get the window width 

  const [showWeekly, setShowWeekly] = useState(false);  // State to controlweekly earnings breakdown modal
  const [profileData, setProfileData] = useState<DriverProfile | null>(null); // comng fom the user context

  
  

  const earningsData: EarningItem[] = [
    {
      id: '1',
      route: 'Colombo - Kandy',
      date: 'Oct 24',
      time: '10:00 AM',
      amount: 'LKR 4,500',
    },
    {
      id: '2',
      route: 'Kandy - Colombo',
      date: 'Oct 24',
      time: '03:30 PM',
      amount: 'LKR 4,500',
    },
    {
      id: '3',
      route: 'Colombo - Galle',
      date: 'Oct 23',
      time: '08:00 AM',
      amount: 'LKR 3,500',
    },
  ];

  const weeklyData: WeeklyPoint[] = [
    { day: 'Mon', amount: 2500 },
    { day: 'Tue', amount: 4500 },
    { day: 'Wed', amount: 4800, isHighlighted: true },
    { day: 'Thu', amount: 3200 },
    { day: 'Fri', amount: 2000 },
    { day: 'Sat', amount: 3500 },
    { day: 'Sun', amount: 2300 },
  ];

  interface DriverProfile {
  driverEarnings: number;
}

  const [receipt, setReceipt] = useState<EarningItem | null>(null);
  useEffect(() => {
  const fetchDriverProfile = async () => {
    if (!user?.userId || !user?.token) { 
      return;
    }

    try {
      const response = await fetch(
        `http://10.233.234.185:8080/api/drivers/${user.userId}/profile`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch earnings profile: ${response.statusText}`);
      }

      const result = await response.json(); //wait till the response is converted to json

      if (result.success && result.data) {
        setProfileData(result.data);
      }
    } catch (error) {
      console.error('Error fetching earnings profile:', error);
    }
  };

  fetchDriverProfile();
}, [user?.userId, user?.token]);

const earningsAmount = profileData?.driverEarnings ?? 0;


  const maxAmount = Math.max(...weeklyData.map((d) => d.amount)); // Find the maximum amount in the weeklyData array for bar chart
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
            border-bottom: 2px solid #0066FF;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }

          .header h1 {
            margin: 0;
            font-size: 22px;
            color: #0066FF;
          }

          .sub {
            font-size: 12px;
            color: #666;
            margin-top: 6px;
          }

          .card {
            background: #f5f7ff;
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
            background: #0066FF;
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
            color: #0066FF;
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
          <h1>Driver Earnings Report</h1>
          <div class="sub">Monthly Summary Statement</div>
        </div>

        <div class="card">
          <div class="label">Driver Name</div>
          <div class="value">${user?.firstName || 'Driver'}</div>
        </div>

        <div class="card">
          <div class="label">Total Earnings</div>
          <div class="value">LKR ${earningsAmount.toLocaleString('en-US', { //convert amount to string with d.p & commas
              minimumFractionDigits: 2,
              maximumFractionDigits: 2, // 2 d.p
            })}</div>
        </div>

        <h3>Weekly Breakdown</h3>

        <table>
          <tr>
            <th>Day</th>
            <th>Amount</th>
          </tr>
          ${weeklyData
            .map(
              (d) => `
            <tr>
              <td>${d.day}</td>
              <td>LKR ${d.amount}</td>
            </tr>
          `
            )
            .join('')} //join the table rows
        </table> 

        <div class="total">
          Net Total: LKR ${earningsAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2, // 2 d.p
          })}
        </div>

        <div class="footer">
          Generated by TrackNgo Driver App
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
  background: darkMode ? '#111' : '#F5F5F5',
  card: darkMode ? '#1E1E1E' : '#FFF',
  text: darkMode ? '#FFF' : '#000',
  secondaryText: darkMode ? '#AAA' : '#666',
  border: darkMode ? '#333' : '#E0E0E0',
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
            <Text style={styles.earningAmount}>{item.amount}</Text>
            <View style={styles.netEarningsBadge}>
              <Text style={styles.netEarningsText}>Net Earnings</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.receiptLink}
        onPress={() => setReceipt(item)}
      >

        <Text style={styles.receiptLinkText}>View Receipt</Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color="#0066FF" />
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
                Earnings
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Hello, {user?.firstName || 'Driver'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => alert('Loading notifications...')}
            >
              <MaterialCommunityIcons name="bell" size={24} color={theme.text} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>

          <View style={styles.earningsCard}>
            <View style={[styles.cardHeader, isCompact && styles.cardHeaderStack]}> 
              <Text style={styles.cardLabel}>Your Monthly Earnings</Text>

              <View style={styles.percentageBadge}>
                <MaterialCommunityIcons name="trending-up" size={14} color="#22C55E" />
                <Text style={styles.percentageText}>+12%</Text>
              </View>
            </View>

            <Text style={styles.earningsAmountTotal}>
              LKR {earningsAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.updatedText}>Updated just now</Text>
          </View>

          <View style={styles.weeklySection}>
            <View style={[styles.weeklyHeader, isCompact && styles.weeklyHeaderStack]}> 
              <View style={styles.weeklyHeaderText}>
                <Text style={styles.weeklyTitle}>Weekly Earnings</Text>
                <Text style={styles.weeklySubtitle}>Last 7 Days</Text>
              </View>

              <Text style={styles.weeklyAmount}>LKR 84.5k</Text>
            </View>

            <View style={styles.chartContainer}>
              <View style={styles.chartYAxis}>
                <Text style={styles.yAxisLabel}>6000</Text>
                <Text style={styles.yAxisLabel}>4000</Text>
                <Text style={styles.yAxisLabel}>2000</Text>
                <Text style={styles.yAxisLabel}>0</Text>
              </View>

              <View style={styles.barsContainer}>
                {weeklyData.map((data) => (
                  <View key={data.day} style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: (data.amount / maxAmount) * 120,
                          backgroundColor: data.isHighlighted ? '#0066FF' : '#D1D5DB',
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
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
                    </View>

          <View style={styles.earningsListSection}>{earningsData.map(renderEarningItem)}</View>

          <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF}>
            <MaterialCommunityIcons name="download" size={20} color='#FFF' />
            <Text style={styles.exportButtonText}>Export Monthly Report</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {receipt && (
  <View style={styles.modalOverlay}>
    <View style={styles.receiptModal}>
      
      <Text style={styles.receiptTitle}>Trip Receipt</Text>

      <View style={styles.receiptRow}>
        <Text style={styles.receiptLabel}>Route</Text>
        <Text style={styles.receiptValue}>{receipt.route}</Text>
      </View>

      <View style={styles.receiptRow}>
        <Text style={styles.receiptLabel}>Date</Text>
        <Text style={styles.receiptValue}>{receipt.date}</Text>
      </View>

      <View style={styles.receiptRow}>
        <Text style={styles.receiptLabel}>Time</Text>
        <Text style={styles.receiptValue}>{receipt.time}</Text>
      </View>

      <View style={styles.amountBox}>
        <Text style={styles.amountText}>{receipt.amount}</Text>
      </View>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setReceipt(null)}
      >
        <Text style={styles.closeText}>Close</Text>
      </TouchableOpacity>

    </View>
  </View>
)}

{showWeekly && (
  <View style={styles.modalOverlay}>
    <View style={styles.weeklyModal}>

      <Text style={styles.weeklyTitleModal}>Weekly Earnings</Text>
      <Text style={styles.weeklySubtitleModal}>Last 7 Days Breakdown</Text>

      {weeklyData.map((d) => (
        <View key={d.day} style={styles.weekRow}>
          <Text style={styles.weekDay}>{d.day}</Text>
          <Text style={styles.weekAmount}>LKR {d.amount}</Text>
        </View>
      ))}

      <View style={styles.weekTotalBox}>
        <Text style={styles.weekTotalText}>
          Total: LKR {weeklyData.reduce((a, b) => a + b.amount, 0)}
        </Text> 
      </View>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setShowWeekly(false)}
      >
        <Text style={styles.closeText}>Close</Text>
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
    notificationIcon: {
      position: 'relative',
      padding: 8,
      flexShrink: 0,
    },
    headerTitle: {
      fontSize: isSmallPhone ? 16 : 17,
      fontWeight: '700',
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 11,
      color: theme.secondaryText,
      marginTop: 2,
      fontWeight: '500',
    },
    notificationDot: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#0066FF',
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
      fontSize: 12,
      color: theme.text,
      fontWeight: '600',
    },
    earningsAmount: {
      fontSize: isSmallPhone ? 22 : 26,
      fontWeight: '700',
      color: theme.text,
      marginVertical: 8,
      letterSpacing: -0.5,
    },
    percentageBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#E7F5EC',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    percentageText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#22C55E',
      marginLeft: 4,
    },
    earningsAmountTotal: {
      fontSize: isSmallPhone ? 24 : 30,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    updatedText: {
      fontSize: 11,
      color: '#999',
      fontWeight: '500',
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
      fontWeight: '700',
      color: theme.text,
    },
    weeklySubtitle: {
      fontSize: 11,
      color: '#999',
      marginTop: 2,
      fontWeight: '500',
    },
    weeklyAmount: {
      fontSize: 15,
      fontWeight: '700',
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
      fontSize: 9,
      color: '#999',
      fontWeight: '600',
    },
    barsContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      borderLeftWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#E0E0E0',
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
      fontSize: 10,
      color: '#666',
      fontWeight: '600',
    },
    viewAllLink: {
      alignSelf: 'flex-end',
    },
    viewAllText: {
      fontSize: 12,
      color: '#0066FF',
      fontWeight: '600',
    },
    earningsListSection: {
      marginHorizontal: horizontalPadding,
      marginVertical: 12,
      gap: 12,
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
      fontWeight: '700',
      color: theme.text,
    },
    dateTimeText: {
      fontSize: 11,
      color: '#999',
      marginTop: 4,
      fontWeight: '500',
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
      fontWeight: '700',
      color: theme.text,
    },
    netEarningsBadge: {
      backgroundColor: '#E7F5EC',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 4,
      marginTop: 6,
    },
    netEarningsText: {
      fontSize: 10,
      color: '#22C55E',
      fontWeight: '600',
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
      color: '#0066FF',
      fontWeight: '600',
      marginRight: 4,
    },
    exportButton: {
      marginHorizontal: horizontalPadding,
      marginVertical: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: '#0066FF',
      backgroundColor:'#0066FF',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    exportButtonText: {
      fontSize: 13,
      fontWeight: '700',
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
      borderColor: '#0066FF',
      borderRadius: 16,
      padding: 20,
    },

    receiptTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 16,
      textAlign: 'center',
      color: '#0066FF',
    },

    receiptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },

    receiptLabel: {
      fontSize: 12,
      color: theme.secondaryText,
      fontWeight: '600',
    },

    receiptValue: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.text,
    },

    amountBox: {
      marginTop: 16,
      padding: 14,
      backgroundColor: '#E3F2FD',
      borderRadius: 10,
      alignItems: 'center',
    },

    amountText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#0066FF',
    },

    closeBtn: {
      marginTop: 16,
      padding: 12,
      backgroundColor: '#0066FF',
      borderRadius: 10,
      alignItems: 'center',
    },

    closeText: {
      color: '#FFF',
      fontWeight: '700',
    },

    weeklyModal: {
  width: '100%',
  backgroundColor: theme.card,
  borderRadius: 16,
  padding: 20,
},

weeklyTitleModal: {
  fontSize: 18,
  fontWeight: '700',
  color: '#0066FF',
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
  borderBottomColor: '#F0F0F0',
},

weekDay: {
  fontSize: 13,
  fontWeight: '600',
  color: theme.text,
},

weekAmount: {
  fontSize: 13,
  fontWeight: '700',
  color: '#0066FF',
},

weekTotalBox: {
  marginTop: 16,
  padding: 12,
  backgroundColor: '#E3F2FD',
  borderRadius: 10,
  alignItems: 'center',
},

weekTotalText: {
  fontSize: 14,
  fontWeight: '700',
  color: '#0066FF',
},
      });
    }
