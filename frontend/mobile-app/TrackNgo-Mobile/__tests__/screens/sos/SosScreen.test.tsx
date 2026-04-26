import React from "react";
import { Alert, Linking } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { SosScreen } from "../../../screens/sos/SosScreen";
import {
  getActiveEmergencyNumbers,
  triggerSosAlert,
} from "../../../services/sosApi";
import { sendSosSmsDirect } from "../../../services/smsService";
import { getUserProfile } from "../../../services/userProfileApi";
import { useSession } from "../../../store/sessionStore";

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
}));

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return ({ name }: { name: string }) => React.createElement(Text, null, name);
});

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../../store/sessionStore", () => ({
  useSession: jest.fn(),
}));

jest.mock("../../../services/sosApi", () => ({
  getActiveEmergencyNumbers: jest.fn(),
  triggerSosAlert: jest.fn(),
}));

jest.mock("../../../services/smsService", () => ({
  sendSosSmsDirect: jest.fn(),
}));

jest.mock("../../../services/userProfileApi", () => ({
  getUserProfile: jest.fn(),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: {
    High: "high",
  },
}));

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;
const mockedGetActiveEmergencyNumbers = getActiveEmergencyNumbers as jest.MockedFunction<typeof getActiveEmergencyNumbers>;
const mockedTriggerSosAlert = triggerSosAlert as jest.MockedFunction<typeof triggerSosAlert>;
const mockedSendSosSmsDirect = sendSosSmsDirect as jest.MockedFunction<typeof sendSosSmsDirect>;
const mockedGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockedRequestForegroundPermissionsAsync = Location.requestForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.requestForegroundPermissionsAsync
>;
const mockedGetCurrentPositionAsync = Location.getCurrentPositionAsync as jest.MockedFunction<
  typeof Location.getCurrentPositionAsync
>;

describe("SosScreen", () => {
  const navigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  /** Resets SOS screen mocks and applies the default route, session, and location values. */
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSession.mockReturnValue({
      currentUser: { userId: 12, userType: "PASSENGER" },
      loading: false,
      setCurrentUser: jest.fn(),
      clearCurrentUser: jest.fn(),
    } as never);
    mockedUseLocalSearchParams.mockReturnValue({
      busNumber: "NB-17",
      startLocation: "Colombo",
      endLocation: "Kandy",
    } as never);
    mockedGetActiveEmergencyNumbers.mockResolvedValue({
      emergencyId: 1,
      label: "Sri Lanka",
      ambulance: "1990",
      police: "119",
      helpCenter: "1919",
      fireBrigade: "110",
    });
    mockedTriggerSosAlert.mockResolvedValue(undefined);
    mockedSendSosSmsDirect.mockResolvedValue({ sent: true, contactCount: 2 });
    mockedGetUserProfile.mockResolvedValue({ fullName: "Jane Doe" } as never);
    mockedRequestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" } as never);
    mockedGetCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 6.927079,
        longitude: 79.861244,
      },
    } as never);
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    jest.spyOn(console, "error").mockImplementation(jest.fn());
    jest.spyOn(console, "warn").mockImplementation(jest.fn());
  });

  /** Restores runtime spies after each SOS screen test completes. */
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Verifies that the screen loads emergency quick actions and dials the selected number. */
  it("loads emergency quick actions and opens the dialer for a selected service", async () => {
    const { getByText, getByTestId } = render(
      <SosScreen navigation={navigation as never} route={{ key: "1", name: "Sos" } as never} />,
    );

    await waitFor(() => expect(mockedGetActiveEmergencyNumbers).toHaveBeenCalledTimes(1));

    expect(getByText("Ambulance")).toBeTruthy();
    expect(getByText("Police")).toBeTruthy();

    fireEvent.press(getByTestId("quick-action-police"));

    expect(Linking.openURL).toHaveBeenCalledWith("tel:119");
  });

  /** Verifies that a successful SOS trigger sends the backend payload and direct emergency-contact SMS. */
  it("triggers SOS successfully and informs emergency contacts by default", async () => {
    const { getByTestId, getAllByText } = render(
      <SosScreen navigation={navigation as never} route={{ key: "1", name: "Sos" } as never} />,
    );

    await waitFor(() => expect(mockedGetActiveEmergencyNumbers).toHaveBeenCalled());

    fireEvent.press(getByTestId("trigger-sos-button"));

    await waitFor(() =>
      expect(mockedTriggerSosAlert).toHaveBeenCalledWith({
        passengerId: 12,
        driverId: undefined,
        sharedLocation: "6.927079, 79.861244 - Logged user location",
        busNumber: "NB-17",
        startLocation: "Colombo",
        endLocation: "Kandy",
        notifyEmergencyContacts: true,
      }),
    );
    await waitFor(() => expect(mockedGetUserProfile).toHaveBeenCalledWith(12));
    await waitFor(() =>
      expect(mockedSendSosSmsDirect).toHaveBeenCalledWith({
        userName: "Jane Doe",
        userId: 12,
        userType: "PASSENGER",
        busNumber: "NB-17",
        startLocation: "Colombo",
        endLocation: "Kandy",
        sharedLocation: "6.927079, 79.861244 - Logged user location",
      }),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      "SOS sent",
      "Emergency alert has been sent to admin.",
    );
    expect(getAllByText("Help is on the way, please be calm.").length).toBeGreaterThan(0);
  });

  /** Verifies that missing location permission blocks SOS submission and shows the location warning. */
  it("shows an alert when location permission is denied", async () => {
    mockedRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" } as never);

    const { getByTestId } = render(
      <SosScreen navigation={navigation as never} route={{ key: "1", name: "Sos" } as never} />,
    );

    await waitFor(() => expect(mockedGetActiveEmergencyNumbers).toHaveBeenCalled());

    fireEvent.press(getByTestId("trigger-sos-button"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "Location required",
        "Enable location services to send SOS with your live location.",
      ),
    );
    expect(mockedTriggerSosAlert).not.toHaveBeenCalled();
  });

  /** Verifies that disabling emergency-contact notification skips the direct SMS step. */
  it("sends SOS without direct SMS when emergency-contact notification is toggled off", async () => {
    const { getByTestId } = render(
      <SosScreen navigation={navigation as never} route={{ key: "1", name: "Sos" } as never} />,
    );

    await waitFor(() => expect(mockedGetActiveEmergencyNumbers).toHaveBeenCalled());

    fireEvent.press(getByTestId("inform-emergency-contacts-toggle"));
    fireEvent.press(getByTestId("trigger-sos-button"));

    await waitFor(() =>
      expect(mockedTriggerSosAlert).toHaveBeenCalledWith({
        passengerId: 12,
        driverId: undefined,
        sharedLocation: "6.927079, 79.861244 - Logged user location",
        busNumber: "NB-17",
        startLocation: "Colombo",
        endLocation: "Kandy",
        notifyEmergencyContacts: false,
      }),
    );
    expect(mockedSendSosSmsDirect).not.toHaveBeenCalled();
  });
});
