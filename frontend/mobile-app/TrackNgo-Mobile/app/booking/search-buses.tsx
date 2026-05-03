import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSession } from '../../store/sessionStore';
import { getUserProfile } from '../../services/userProfileApi';
import { httpGet } from '../../services/http';

const MIN_GAP = 0.08;

/**
 * Utility to restrict a number within a specified range.
 * Used primarily for the time range slider bounds.
 */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts a fractional day value (0 to 1) into a 24-hour time string (HH:mm).
 * Example: 0.5 -> "12:00"
 */
function formatTime(value: number) {
  const totalMinutes = Math.round(value * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Normalizes stop names for comparison (lowercase, removed spaces/dashes).
 * Ensures that "Kadawatha" matches "kadawatha " or "Kada-watha".
 */
function normalizeStopKey(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '');
}

export default function SearchBusesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useSession();
  const { busCategory } = useLocalSearchParams<{ busCategory?: string }>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [busType, setBusType] = useState<'AC' | 'Non-AC'>('AC');
  const [range, setRange] = useState({ start: 6 / 24, end: 22 / 24 });
  const [sliderWidth, setSliderWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState<'start' | 'end' | null>(null);
  const [tempHour, setTempHour] = useState(0);
  const [tempMinute, setTempMinute] = useState(0);
  const sliderLeft = useRef(0);
  const sliderRef = useRef<View>(null);
  const [displayName, setDisplayName] = useState('User');

  /* ── Autocomplete State ────────────────────────────────── */
  const [allStops, setAllStops] = useState<string[]>([]); // Master list of all available stops
  const [fromSuggestions, setFromSuggestions] = useState<string[]>([]);
  const [toSuggestions, setToSuggestions] = useState<string[]>([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  /* ── Lifecycle Effects ────────────────────────────────── */

  // Fetch user profile to personalize the greeting message
  useEffect(() => {
    if (!currentUser) return;
    getUserProfile(currentUser.userId)
      .then((profile) => {
        const name =
          profile.fullName?.trim() ||
          profile.contactPersonName?.trim() ||
          profile.companyName?.trim() ||
          `User ${currentUser.userId}`;
        setDisplayName(name);
      })
      .catch(() => setDisplayName('User'));
  }, [currentUser]);

  // Fetch all existing route stops from the backend to populate 
  // autocomplete suggestions for 'From' and 'To' fields.
  useEffect(() => {
    httpGet<{ success: boolean; data: { stops: string[] }[] }>('/api/routes')
      .then((res) => {
        const stops = new Set<string>();
        const routes = res.data ?? [];
        // Flatten all stops from all routes into a single unique set
        for (const route of routes) {
          if (route.stops) {
            for (const stop of route.stops) {
              stops.add(stop);
            }
          }
        }
        setAllStops(Array.from(stops).sort());
      })
      .catch(() => { });
  }, []);

  /**
   * Filters the master stop list based on user input.
   * Returns top 8 matches.
   */
  const filterSuggestions = useCallback((text: string) => {
    if (!text.trim()) return [];
    const needle = text.toLowerCase().trim();
    return allStops.filter((s) => s.toLowerCase().includes(needle)).slice(0, 8);
  }, [allStops]);
  // handle from and to change and show suggestions
  const handleFromChange = useCallback((text: string) => {
    setFrom(text);
    const matches = filterSuggestions(text);
    setFromSuggestions(matches);
    setShowFromSuggestions(matches.length > 0 && text.length > 0);
  }, [filterSuggestions]);
  // handle to and show suggestions
  const handleToChange = useCallback((text: string) => {
    setTo(text);
    const matches = filterSuggestions(text);
    setToSuggestions(matches);
    setShowToSuggestions(matches.length > 0 && text.length > 0);
  }, [filterSuggestions]);

  const rangeRef = useRef(range);
  rangeRef.current = range;

  const dateLabel = useMemo(() => {
    const now = new Date();
    const isToday =
      now.getFullYear() === selectedDate.getFullYear() &&
      now.getMonth() === selectedDate.getMonth() &&
      now.getDate() === selectedDate.getDate();
    const formatted = selectedDate.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
    });
    if (isToday) {
      return `Today, ${formatted}`;
    }
    const weekday = selectedDate.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday}, ${formatted}`;
  }, [selectedDate]);

  const updateSliderLeft = () => {
    if (!sliderRef.current) return;
    sliderRef.current.measureInWindow((x) => {
      sliderLeft.current = x;
    });
  };

  const getValueFromMoveX = (moveX: number) => {
    if (!sliderWidth) return 0;
    const relativeX = clamp(moveX - sliderLeft.current, 0, sliderWidth);
    return relativeX / sliderWidth;
  };

  /* ── Time Range Slider Logic (PanResponder) ─────────────── */
  // The slider uses two independent PanResponders for the 'Start' and 'End' handles.

  const startPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setDragging(true);
        updateSliderLeft();
      },
      onPanResponderMove: (_, gesture) => {
        if (!sliderWidth) return;
        // Clamp start handle between 0 and (end - MIN_GAP)
        const next = clamp(getValueFromMoveX(gesture.moveX), 0, rangeRef.current.end - MIN_GAP);
        setRange((prev) => ({ ...prev, start: next }));
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    })
  ).current;

  const endPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setDragging(true);
        updateSliderLeft();
      },
      onPanResponderMove: (_, gesture) => {
        if (!sliderWidth) return;
        // Clamp end handle between (start + MIN_GAP) and 1
        const next = clamp(getValueFromMoveX(gesture.moveX), rangeRef.current.start + MIN_GAP, 1);
        setRange((prev) => ({ ...prev, end: next }));
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    })
  ).current;

  /**
   * Validates form inputs and navigates to the selection screen.
   * Performs normalization on location names to ensure they match backend data.
   */
  const handleSearch = () => {
    const trimmedFrom = from.trim();
    const trimmedTo = to.trim();

    // Basic Validation
    if (!trimmedFrom || !trimmedTo) {
      Alert.alert('Missing fields', 'Please enter both From and To locations.');
      return;
    }

    if (trimmedFrom.toLowerCase() === trimmedTo.toLowerCase()) {
      Alert.alert('Invalid route', 'From and To cannot be the same location.');
      return;
    }

    if (adults < 1) {
      Alert.alert('Invalid passengers', 'At least 1 adult is required.');
      return;
    }

    if (range.start >= range.end) {
      Alert.alert('Invalid time range', 'Please choose a valid departure time range.');
      return;
    }

    // Advanced Validation: Ensure locations exist in the 'allStops' master list
    const stopMap = new Map(allStops.map((stop) => [normalizeStopKey(stop), stop]));
    const resolvedFrom = stopMap.get(normalizeStopKey(trimmedFrom));
    const resolvedTo = stopMap.get(normalizeStopKey(trimmedTo));

    if (!resolvedFrom || !resolvedTo) {
      Alert.alert(
        'Select valid stops',
        'Please choose start and end locations from the route stop suggestions.',
      );
      return;
    }

    if (normalizeStopKey(resolvedFrom) === normalizeStopKey(resolvedTo)) {
      Alert.alert('Invalid route', 'From and To cannot be the same location.');
      return;
    }

    // Prepare date string
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');

    const isAllDay = range.start === 0 && range.end === 1;

    // Navigate with validated parameters
    router.push({
      pathname: '/booking/bus-selection',
      params: {
        from: resolvedFrom,
        to: resolvedTo,
        date: `${yyyy}-${mm}-${dd}`,
        passengers: String(adults + children),
        adults: String(adults),
        children: String(children),
        busType,
        ...(isAllDay ? {} : {
          timeStart: formatTime(range.start),
          timeEnd: formatTime(range.end),
        }),
        ...(busCategory ? { busCategory } : {}),
      },
    });
  };
  // handle open and close time modal
  const openTimeModal = (which: 'start' | 'end') => {
    const value = which === 'start' ? range.start : range.end;
    const totalMinutes = Math.round(value * 24 * 60);
    setTempHour(Math.floor(totalMinutes / 60) % 24);
    setTempMinute(totalMinutes % 60);
    setShowTimeModal(which);
  };

  const confirmTimeModal = () => {
    const newValue = (tempHour * 60 + tempMinute) / (24 * 60);
    if (showTimeModal === 'start') {
      const clamped = clamp(newValue, 0, range.end - MIN_GAP);
      setRange((prev) => ({ ...prev, start: clamped }));
    } else if (showTimeModal === 'end') {
      const clamped = clamp(newValue, range.start + MIN_GAP, 1);
      setRange((prev) => ({ ...prev, end: clamped }));
    }
    setShowTimeModal(null);
  };

  const startX = sliderWidth * range.start;
  const endX = sliderWidth * range.end;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragging}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>

        {/* Personalized Greeting */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingSub}>
            {new Date().getHours() < 12
              ? 'Good Morning,'
              : new Date().getHours() < 17
                ? 'Good Afternoon,'
                : 'Good Evening,'}
          </Text>
          <Text style={styles.greetingMain}>{displayName}</Text>
        </View>

        {/* Main Search Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="bus" size={18} color="#2F6BFF" />
              <Text style={styles.cardTitle}>Search Buses</Text>
            </View>
            <View style={styles.returnPill}>
              <Text style={styles.returnText}>Return</Text>
            </View>
          </View>

          {/* Start Location Input with Autocomplete */}
          <View style={[styles.inputCard, { zIndex: 30 }]}>
            <View style={styles.inputIcon}>
              <MaterialCommunityIcons name="target" size={18} color="#94A3B8" />
            </View>
            <View style={styles.inputTextBlock}>
              <Text style={styles.inputLabel}>From</Text>
              <TextInput
                value={from}
                onChangeText={handleFromChange}
                onFocus={() => {
                  if (from.length > 0) {
                    const matches = filterSuggestions(from);
                    setFromSuggestions(matches);
                    setShowFromSuggestions(matches.length > 0);
                  }
                }}
                onBlur={() => {
                  // Small delay to allow the suggestion click to register before hiding
                  setTimeout(() => setShowFromSuggestions(false), 300);
                }}
                placeholder="Search location..."
                placeholderTextColor="#94A3B8"
                style={styles.inputValue}
              />
              {/* Suggestions Dropdown */}
              {showFromSuggestions && (
                <View style={styles.suggestionsContainer}>
                  {fromSuggestions.map((item) => (
                    <Pressable
                      key={item}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setFrom(item);
                        setShowFromSuggestions(false);
                      }}>
                      <Ionicons name="location-outline" size={14} color="#64748B" />
                      <Text style={styles.suggestionText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={[styles.verticalConnector, { zIndex: 5 }]} />

          <View style={[styles.inputCard, { zIndex: 20 }]}>
            <View style={[styles.inputIcon, styles.inputIconBlue]}>
              <Ionicons name="location" size={18} color="#2F6BFF" />
            </View>
            <View style={styles.inputTextBlock}>
              <Text style={styles.inputLabel}>To</Text>
              <TextInput
                value={to}
                onChangeText={handleToChange}
                onFocus={() => {
                  if (to.length > 0) {
                    const matches = filterSuggestions(to);
                    setToSuggestions(matches);
                    setShowToSuggestions(matches.length > 0);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowToSuggestions(false), 300);
                }}
                placeholder="Search location..."
                placeholderTextColor="#94A3B8"
                style={styles.inputValue}
              />
              {showToSuggestions && (
                <View style={styles.suggestionsContainer}>
                  {toSuggestions.map((item) => (
                    <Pressable
                      key={item}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setTo(item);
                        setShowToSuggestions(false);
                      }}>
                      <Ionicons name="location-outline" size={14} color="#64748B" />
                      <Text style={styles.suggestionText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Date & Passenger Selection Row */}
          <View style={[styles.rowCards, { zIndex: 1 }]}>
            <Pressable style={styles.smallCard} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.inputLabel}>Date</Text>
              <Text style={styles.inputValueText}>{dateLabel}</Text>
            </Pressable>
            <View style={styles.smallCard}>
              <Text style={styles.inputLabel}>Passengers</Text>
              {/* Adult Counter */}
              <View style={styles.passengerRow}>
                <Text style={styles.passengerLabel}>Adult</Text>
                <View style={styles.passengerControls}>
                  <Pressable
                    onPress={() => setAdults((value) => Math.max(1, value - 1))}
                    style={styles.passengerButton}>
                    <Ionicons name="remove" size={14} color="#2F6BFF" />
                  </Pressable>
                  <Text style={styles.passengerCount}>{adults}</Text>
                  <Pressable
                    onPress={() => setAdults((value) => value + 1)}
                    style={styles.passengerButton}>
                    <Ionicons name="add" size={14} color="#2F6BFF" />
                  </Pressable>
                </View>
              </View>
              {/* Children Counter */}
              <View style={styles.passengerRow}>
                <Text style={styles.passengerLabel}>Children</Text>
                <View style={styles.passengerControls}>
                  <Pressable
                    onPress={() => setChildren((value) => Math.max(0, value - 1))}
                    style={styles.passengerButton}>
                    <Ionicons name="remove" size={14} color="#2F6BFF" />
                  </Pressable>
                  <Text style={styles.passengerCount}>{children}</Text>
                  <Pressable
                    onPress={() => setChildren((value) => value + 1)}
                    style={styles.passengerButton}>
                    <Ionicons name="add" size={14} color="#2F6BFF" />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.sectionHeader, { zIndex: 1 }]}>
          <Text style={styles.sectionTitle}>Bus Type</Text>
          <Pressable onPress={() => setBusType('AC')}>
            <Text style={styles.sectionReset}>Reset</Text>
          </Pressable>
        </View>
        <View style={[styles.pillRow, { zIndex: 1 }]}>
          <Pressable onPress={() => setBusType('AC')}>
            <View style={[styles.typePill, busType === 'AC' && styles.typePillActive]}>
              <Ionicons name="snow" size={16} color={busType === 'AC' ? '#2F6BFF' : '#94A3B8'} />
              <Text style={[styles.typePillText, busType === 'AC' && styles.typePillTextActive]}>AC</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setBusType('Non-AC')}>
            <View style={[styles.typePill, busType === 'Non-AC' && styles.typePillActive]}>
              <MaterialCommunityIcons
                name="fan"
                size={16}
                color={busType === 'Non-AC' ? '#2F6BFF' : '#94A3B8'}
              />
              <Text style={[styles.typePillText, busType === 'Non-AC' && styles.typePillTextActive]}>
                Non-AC
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Departure Time</Text>
          <View style={styles.timePill}>
            <Text style={styles.timePillText}>{formatTime(range.start)}  -  {formatTime(range.end)}</Text>
          </View>
        </View>

        <View style={styles.presetRow}>
          {([
            { label: 'Morning', start: 5 / 24, end: 12 / 24, icon: 'sunny-outline' as const },
            { label: 'Afternoon', start: 12 / 24, end: 17 / 24, icon: 'partly-sunny-outline' as const },
            { label: 'Evening', start: 17 / 24, end: 21 / 24, icon: 'moon-outline' as const },
            { label: 'All Day', start: 0, end: 1, icon: 'time-outline' as const },
          ] as const).map((preset) => {
            const isActive =
              Math.abs(range.start - preset.start) < 0.01 &&
              Math.abs(range.end - preset.end) < 0.01;
            return (
              <Pressable
                key={preset.label}
                style={[styles.presetChip, isActive && styles.presetChipActive]}
                onPress={() => setRange({ start: preset.start, end: preset.end })}>
                <Ionicons
                  name={preset.icon}
                  size={13}
                  color={isActive ? '#2F6BFF' : '#94A3B8'}
                />
                <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom Departure Time Range Slider */}
        <Pressable
          style={styles.sliderWrap}
          ref={sliderRef}
          onLayout={(event) => {
            setSliderWidth(event.nativeEvent.layout.width);
            updateSliderLeft();
          }}
          onPress={(event) => {
            // Allow clicking the track to move the nearest handle
            if (!sliderWidth) return;
            const value = clamp(event.nativeEvent.locationX / sliderWidth, 0, 1);
            const distToStart = Math.abs(value - rangeRef.current.start);
            const distToEnd = Math.abs(value - rangeRef.current.end);
            if (distToStart <= distToEnd) {
              const next = clamp(value, 0, rangeRef.current.end - MIN_GAP);
              setRange((prev) => ({ ...prev, start: next }));
            } else {
              const next = clamp(value, rangeRef.current.start + MIN_GAP, 1);
              setRange((prev) => ({ ...prev, end: next }));
            }
          }}>
          {/* Background Track */}
          <View style={styles.sliderTrack} />
          {/* Active (Selected) Segment */}
          <View
            style={[
              styles.sliderTrackActive,
              { left: startX, width: Math.max(0, endX - startX) },
            ]}
          />
          {/* Tooltips visible during dragging */}
          {dragging && (
            <View style={[styles.sliderTooltip, { left: startX - 22 }]}>
              <Text style={styles.sliderTooltipText}>{formatTime(range.start)}</Text>
            </View>
          )}
          {dragging && (
            <View style={[styles.sliderTooltip, { left: endX - 22 }]}>
              <Text style={styles.sliderTooltipText}>{formatTime(range.end)}</Text>
            </View>
          )}
          {/* Left Handle (Start Time) */}
          <View
            style={[styles.sliderHandle, { left: startX - 12 }]}
            {...startPan.panHandlers}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <View style={styles.sliderHandleInner} />
          </View>
          {/* Right Handle (End Time) */}
          <View
            style={[styles.sliderHandle, { left: endX - 12 }]}
            {...endPan.panHandlers}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <View style={styles.sliderHandleInner} />
          </View>
        </Pressable>

        <View style={styles.timeMarks}>
          <Text style={styles.timeMarkText}>00:00</Text>
          <Text style={styles.timeMarkText}>06:00</Text>
          <Text style={styles.timeMarkText}>12:00</Text>
          <Text style={styles.timeMarkText}>18:00</Text>
          <Text style={styles.timeMarkText}>23:59</Text>
        </View>

        <View style={styles.exactTimeRow}>
          <Pressable style={styles.exactTimeCard} onPress={() => openTimeModal('start')}>
            <Text style={styles.exactTimeLabel}>Start Time</Text>
            <View style={styles.exactTimeValueRow}>
              <Ionicons name="time-outline" size={14} color="#2F6BFF" />
              <Text style={styles.exactTimeValue}>{formatTime(range.start)}</Text>
              <Ionicons name="create-outline" size={13} color="#94A3B8" />
            </View>
          </Pressable>
          <View style={styles.exactTimeDash}>
            <Text style={styles.exactTimeDashText}>—</Text>
          </View>
          <Pressable style={styles.exactTimeCard} onPress={() => openTimeModal('end')}>
            <Text style={styles.exactTimeLabel}>End Time</Text>
            <View style={styles.exactTimeValueRow}>
              <Ionicons name="time-outline" size={14} color="#2F6BFF" />
              <Text style={styles.exactTimeValue}>{formatTime(range.end)}</Text>
              <Ionicons name="create-outline" size={13} color="#94A3B8" />
            </View>
          </Pressable>
        </View>

        <Pressable onPress={handleSearch} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Search Buses</Text>
        </Pressable>
      </ScrollView>

      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Date</Text>
                <Pressable onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.modalDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="inline"
                onChange={(_, date) => {
                  if (date) setSelectedDate(date);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showDatePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="calendar"
          onChange={(event, date) => {
            if (event.type === 'dismissed') {
              setShowDatePicker(false);
              return;
            }
            if (date) setSelectedDate(date);
            setShowDatePicker(false);
          }}
        />
      )}

      {showTimeModal !== null && (
        <Modal transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowTimeModal(null)}>
            <Pressable style={styles.timeModalCard} onPress={() => undefined}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Set {showTimeModal === 'start' ? 'Start' : 'End'} Time
                </Text>
                <Pressable onPress={confirmTimeModal}>
                  <Text style={styles.modalDone}>Done</Text>
                </Pressable>
              </View>

              <View style={styles.timePickerRow}>
                <View style={styles.timePickerCol}>
                  <Text style={styles.timePickerLabel}>Hour</Text>
                  <View style={styles.stepperRow}>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => setTempHour((h) => Math.max(0, h - 1))}>
                      <Ionicons name="remove" size={20} color="#2F6BFF" />
                    </Pressable>
                    <TextInput
                      style={styles.stepperInput}
                      value={String(tempHour).padStart(2, '0')}
                      keyboardType="number-pad"
                      maxLength={2}
                      selectTextOnFocus
                      onChangeText={(text) => {
                        const n = parseInt(text, 10);
                        if (!isNaN(n) && n >= 0 && n <= 23) setTempHour(n);
                        else if (text === '') setTempHour(0);
                      }}
                    />
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => setTempHour((h) => Math.min(23, h + 1))}>
                      <Ionicons name="add" size={20} color="#2F6BFF" />
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.timePickerSep}>:</Text>

                <View style={styles.timePickerCol}>
                  <Text style={styles.timePickerLabel}>Minute</Text>
                  <View style={styles.stepperRow}>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => setTempMinute((m) => Math.max(0, m - 5))}>
                      <Ionicons name="remove" size={20} color="#2F6BFF" />
                    </Pressable>
                    <TextInput
                      style={styles.stepperInput}
                      value={String(tempMinute).padStart(2, '0')}
                      keyboardType="number-pad"
                      maxLength={2}
                      selectTextOnFocus
                      onChangeText={(text) => {
                        const n = parseInt(text, 10);
                        if (!isNaN(n) && n >= 0 && n <= 59) setTempMinute(n);
                        else if (text === '') setTempMinute(0);
                      }}
                    />
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => setTempMinute((m) => Math.min(59, m + 5))}>
                      <Ionicons name="add" size={20} color="#2F6BFF" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <Text style={styles.timePickerHint}>Tap the number to type directly</Text>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: '#F6F7F9',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginBottom: 12,
  },
  greetingBlock: {
    marginBottom: 18,
  },
  greetingSub: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  greetingMain: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    zIndex: 10,
    overflow: 'visible',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  returnPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EAF1FF',
  },
  returnText: {
    fontSize: 12,
    color: '#2F6BFF',
    fontWeight: '600',
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  inputIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputIconBlue: {
    backgroundColor: '#EAF1FF',
  },
  inputTextBlock: {
    flex: 1,
    zIndex: 10,
  },
  inputLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  inputValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    paddingVertical: 0,
  },
  inputValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  verticalConnector: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
    marginLeft: 12,
  },
  rowCards: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  smallCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  passengerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  passengerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  passengerButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF1FF',
  },
  passengerCount: {
    width: 18,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  sectionReset: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  typePillActive: {
    borderColor: '#BBD3FF',
    backgroundColor: '#EAF1FF',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  typePillTextActive: {
    color: '#2F6BFF',
  },
  timePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EAF1FF',
  },
  timePillText: {
    color: '#2F6BFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sliderWrap: {
    marginTop: 8,
    height: 48,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  sliderTrackActive: {
    position: 'absolute',
    top: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2F6BFF',
  },
  sliderHandle: {
    position: 'absolute',
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#2F6BFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderHandleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2F6BFF',
  },
  sliderTooltip: {
    position: 'absolute',
    top: -16,
    width: 44,
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  sliderTooltipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  presetChipActive: {
    borderColor: '#BBD3FF',
    backgroundColor: '#EAF1FF',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  presetChipTextActive: {
    color: '#2F6BFF',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 999,
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  suggestionText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  timeMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeMarkText: {
    fontSize: 11,
    color: '#9AA4B2',
  },
  searchButton: {
    marginTop: 22,
    backgroundColor: '#1474F2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalDone: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  exactTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  exactTimeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  exactTimeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exactTimeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exactTimeValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  exactTimeDash: {
    paddingHorizontal: 2,
  },
  exactTimeDashText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  timeModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 8,
    gap: 12,
  },
  timePickerCol: {
    alignItems: 'center',
    gap: 8,
  },
  timePickerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    width: 56,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    paddingVertical: 0,
  },
  timePickerSep: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
  },
  timePickerHint: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 4,
  },
});
