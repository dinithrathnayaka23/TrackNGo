import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useFocusEffect } from "expo-router";
import {
  EmergencyContactsScreen,
  mapUserTypeToOwnerType,
} from "../../../screens/sos/EmergencyContactsScreen";
import {
  addEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContacts,
} from "../../../services/emergencyContactApi";
import { useSession } from "../../../store/sessionStore";

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn((callback: () => void) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  }),
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

jest.mock("../../../services/emergencyContactApi", () => ({
  getEmergencyContacts: jest.fn(),
  addEmergencyContact: jest.fn(),
  deleteEmergencyContact: jest.fn(),
}));

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedGetEmergencyContacts = getEmergencyContacts as jest.MockedFunction<typeof getEmergencyContacts>;
const mockedAddEmergencyContact = addEmergencyContact as jest.MockedFunction<typeof addEmergencyContact>;
const mockedDeleteEmergencyContact = deleteEmergencyContact as jest.MockedFunction<typeof deleteEmergencyContact>;

describe("EmergencyContactsScreen", () => {
  const navigation = {
    goBack: jest.fn(),
  };

  /** Resets emergency-contact mocks and applies the default mobile session and contact list. */
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSession.mockReturnValue({
      currentUser: { userId: 12, userType: "PASSENGER" },
      loading: false,
      setCurrentUser: jest.fn(),
      clearCurrentUser: jest.fn(),
    } as never);
    mockedGetEmergencyContacts.mockResolvedValue([
      {
        contactId: 1,
        ownerId: 12,
        ownerType: "passenger",
        name: "Alice",
        teleNumber: "0712345678",
        relationship: "Sister",
      },
    ]);
    mockedAddEmergencyContact.mockResolvedValue({
      contactId: 2,
      ownerId: 12,
      ownerType: "passenger",
      name: "Bob",
      teleNumber: "0770000000",
      relationship: "Friend",
    });
    mockedDeleteEmergencyContact.mockResolvedValue(undefined as never);
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    jest.spyOn(console, "error").mockImplementation(jest.fn());
  });

  /** Restores runtime spies after each emergency-contact test completes. */
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Verifies that the screen loads the signed-in user's contacts and renders them. */
  it("loads and displays the current user's emergency contacts", async () => {
    const { getByText } = render(
      <EmergencyContactsScreen
        navigation={navigation as never}
        route={{ key: "1", name: "EmergencyContacts" } as never}
      />,
    );

    await waitFor(() => expect(mockedGetEmergencyContacts).toHaveBeenCalledWith(12, "passenger"));

    expect(getByText("Alice")).toBeTruthy();
    expect(getByText("0712345678")).toBeTruthy();
    expect(getByText("Sister")).toBeTruthy();
  });

  /** Verifies that the add-contact flow blocks empty required fields. */
  it("shows a validation alert when required add-contact fields are empty", async () => {
    const { getByTestId } = render(
      <EmergencyContactsScreen
        navigation={navigation as never}
        route={{ key: "1", name: "EmergencyContacts" } as never}
      />,
    );

    await waitFor(() => expect(mockedGetEmergencyContacts).toHaveBeenCalled());

    fireEvent.press(getByTestId("open-add-contact-modal"));
    fireEvent.press(getByTestId("save-contact-button"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Validation",
      "Name and phone number are required.",
    );
    expect(mockedAddEmergencyContact).not.toHaveBeenCalled();
  });

  /** Verifies that adding a contact sends the normalized payload and updates the rendered list. */
  it("adds a new emergency contact and updates the visible list", async () => {
    const { getByPlaceholderText, getByTestId, getByText } = render(
      <EmergencyContactsScreen
        navigation={navigation as never}
        route={{ key: "1", name: "EmergencyContacts" } as never}
      />,
    );

    await waitFor(() => expect(mockedGetEmergencyContacts).toHaveBeenCalled());

    fireEvent.press(getByTestId("open-add-contact-modal"));
    fireEvent.changeText(getByPlaceholderText("Contact name"), "  Bob  ");
    fireEvent.changeText(getByPlaceholderText("+94XXXXXXXXX"), "  0770000000  ");
    fireEvent.changeText(getByPlaceholderText("e.g., Mother, Spouse, Friend"), "  Friend  ");
    fireEvent.press(getByTestId("save-contact-button"));

    await waitFor(() =>
      expect(mockedAddEmergencyContact).toHaveBeenCalledWith({
        ownerId: 12,
        ownerType: "passenger",
        name: "Bob",
        teleNumber: "0770000000",
        relationship: "Friend",
      }),
    );
    expect(getByText("Bob")).toBeTruthy();
    expect(getByText("0770000000")).toBeTruthy();
  });

  /** Verifies that deleting a contact removes it from the list after the confirmation action runs. */
  it("deletes a contact after confirmation", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === "Delete")?.onPress?.();
    });

    const { getByTestId, queryByText } = render(
      <EmergencyContactsScreen
        navigation={navigation as never}
        route={{ key: "1", name: "EmergencyContacts" } as never}
      />,
    );

    await waitFor(() => expect(mockedGetEmergencyContacts).toHaveBeenCalled());

    fireEvent.press(getByTestId("delete-contact-1"));

    await waitFor(() => expect(mockedDeleteEmergencyContact).toHaveBeenCalledWith(1));
    await waitFor(() => expect(queryByText("Alice")).toBeNull());
  });

  /** Verifies that SOS owner-type mapping stays consistent for passenger and driver sessions. */
  it("maps mobile user types to SOS owner types", () => {
    expect(mapUserTypeToOwnerType("DRIVER")).toBe("driver");
    expect(mapUserTypeToOwnerType("PASSENGER")).toBe("passenger");
    expect(mapUserTypeToOwnerType("UNKNOWN")).toBe("passenger");
  });
});
