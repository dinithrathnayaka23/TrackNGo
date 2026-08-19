import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSession } from '../../store/sessionStore';
import { getUserProfile } from '../../services/userProfileApi';
// PlacesInput uses Google Places with route-stop fallback suggestions.
import PlacesInput from '../../components/PlacesInput';
import { httpGet } from '../../services/http';
import { formatLocalDate, isPastCalendarDate, normalizeBookableDate, PAST_BOOKING_DATE_MESSAGE, startOfToday } from '../../utils/bookingDate';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../../utils/i18n';
import { useTimeOfDayGreeting } from '../../utils/greeting';

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
  const greeting = useTimeOfDayGreeting();
  const { busCategory } = useLocalSearchParams<{ busCategory?: string }>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedDate, setSelectedDate] = useState(startOfToday());
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
  const [routeStops, setRouteStops] = useState<string[]>([]);

  /* ── Autocomplete State ────────────────────────────────── */
  // Route stops are loaded once so matching bus terminals can appear instantly
  // while the debounced Google Places request is still in flight.

  /* ── Lifecycle Effects ────────────────────────────────── */

  // Fetch user profile to personalise the greeting message
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

  // Keep the route stop master list available for instant local suggestions and
  // as a fallback when Google Places is unavailable.
  useEffect(() => {
    let active = true;

    httpGet<{ success: boolean; data: Array<{ stops?: string[] }> }>('/api/routes')
      .then((response) => {
        if (!active) return;

        const stops = new Set<string>();
        response.data?.forEach((route) => {
          route.stops?.forEach((stop) => {
            const normalized = stop.trim();
            if (normalized) stops.add(normalized);
          });
        });

        setRouteStops(Array.from(stops).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {
        if (active) setRouteStops([]);
      });

    return () => {
      active = false;
    };
  }, []);

  // NOTE: filterSuggestions, handleFromChange, and handleToChange have been removed.
  // PlacesInput handles text changes and filtering internally via Google Places API.
  // The parent (this screen) only receives the final selected location name via
  // the onSelect callback, which calls setFrom(name) or setTo(name).

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

    if (isPastCalendarDate(selectedDate)) {
      Alert.alert('Invalid date', PAST_BOOKING_DATE_MESSAGE);
      setSelectedDate(startOfToday());
      return;
    }

    // NOTE: The old 'allStops' stop-list validation has been removed.
    // Google Places API guarantees that any suggestion the user taps is a real
    // location, so we no longer need to cross-check against a local list.
    // We still normalise for the duplicate-location check below.
    const resolvedFrom = trimmedFrom;
    const resolvedTo = trimmedTo;

    if (normalizeStopKey(resolvedFrom) === normalizeStopKey(resolvedTo)) {
      Alert.alert('Invalid route', 'From and To cannot be the same location.');
      return;
    }
    const journeyDate = formatLocalDate(selectedDate);

    const isAllDay = range.start === 0 && range.end === 1;

    // Navigate with validated parameters
    router.push({
      pathname: '/booking/bus-selection',
      params: {
        from: resolvedFrom,
        to: resolvedTo,
        date: journeyDate,
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
      <FlatList
        data={[{ key: 'search-form' }]}
        keyExtractor={(item) => item.key}
        renderItem={() => (
          <>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>

        {/* Personalized Greeting */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingSub}>{greeting},</Text>
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

          {/* From — Google Maps Places Autocomplete */}
          {/*
            zIndex: 30 keeps this card's dropdown above the 'To' card below.
            overflow: 'visible' lets the floating dropdown render outside
            the bounds of this card's View.
          */}
          <View style={[styles.inputCard, { zIndex: 30, overflow: 'visible' }]}>
            <View style={styles.inputIcon}>
              <MaterialCommunityIcons name="target" size={18} color="#94A3B8" />
            </View>
            {/*
              PlacesInput uses Google suggestions and route stops as a fallback.
              onSelect is called when the user taps a Google suggestion —
              it sets the 'from' state in this screen, same as before.
            */}
            <View style={[styles.inputTextBlock, { overflow: 'visible' }]}>
              <PlacesInput
                label="From"
                placeholder="Search pickup location..."
                onSelect={(name) => setFrom(name)}
                initialValue={from}
                fallbackSuggestions={routeStops}
              />
            </View>
          </View>

          <View style={[styles.verticalConnector, { zIndex: 5 }]} />

          {/* To — Google Maps Places Autocomplete */}
          {/* zIndex: 20 — below From so From's dropdown wins if they overlap */}
          <View style={[styles.inputCard, { zIndex: 20, overflow: 'visible' }]}>
            <View style={[styles.inputIcon, styles.inputIconBlue]}>
              <Ionicons name="location" size={18} color="#2F6BFF" />
            </View>
            <View style={[styles.inputTextBlock, { overflow: 'visible' }]}>
              <PlacesInput
                label="To"
                placeholder="Search drop-off location..."
                onSelect={(name) => setTo(name)}
                initialValue={to}
                fallbackSuggestions={routeStops}
              />
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
          </>
        )}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        scrollEnabled={!dragging}
      />

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
                minimumDate={startOfToday()}
                mode="date"
                display="inline"
                onChange={(_, date) => {
                  if (date) {
                    setSelectedDate(normalizeBookableDate(date));
                    if (isPastCalendarDate(date)) Alert.alert('Invalid date', PAST_BOOKING_DATE_MESSAGE);
                  }
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showDatePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={selectedDate}
          minimumDate={startOfToday()}
          mode="date"
          display="calendar"
          onChange={(event, date) => {
            if (event.type === 'dismissed') {
              setShowDatePicker(false);
              return;
            }
            if (date) {
              setSelectedDate(normalizeBookableDate(date));
              if (isPastCalendarDate(date)) Alert.alert('Invalid date', PAST_BOOKING_DATE_MESSAGE);
            }
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
