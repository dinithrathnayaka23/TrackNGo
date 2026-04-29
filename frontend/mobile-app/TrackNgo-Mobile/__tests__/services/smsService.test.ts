import * as SMS from "expo-sms";
import {
  buildSosMessage,
  sendSosSmsDirect,
} from "../../services/smsService";
import { getEmergencyContacts } from "../../services/emergencyContactApi";

jest.mock("expo-sms", () => ({
  isAvailableAsync: jest.fn(),
  sendSMSAsync: jest.fn(),
}));

jest.mock("../../services/emergencyContactApi", () => ({
  getEmergencyContacts: jest.fn(),
}));

const mockedGetEmergencyContacts = getEmergencyContacts as jest.MockedFunction<typeof getEmergencyContacts>;
const mockedIsAvailableAsync = SMS.isAvailableAsync as jest.MockedFunction<typeof SMS.isAvailableAsync>;
const mockedSendSMSAsync = SMS.sendSMSAsync as jest.MockedFunction<typeof SMS.sendSMSAsync>;

describe("smsService", () => {
  /** Resets direct-SMS mocks before each SMS service test. */
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(jest.fn());
    jest.spyOn(console, "error").mockImplementation(jest.fn());
  });

  /** Restores runtime spies after each SMS service test completes. */
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Verifies that SOS SMS messages format user, route, bus, and location details consistently. */
  it("buildSosMessage formats the SOS message body", () => {
    expect(
      buildSosMessage({
        userName: "Jane Doe",
        userId: 12,
        userType: "PASSENGER",
        busNumber: "NB-17",
        startLocation: "Colombo",
        endLocation: "Kandy",
        sharedLocation: "6.927079, 79.861244 - Logged user location",
      }),
    ).toBe(
      "TrackNGo SOS : Passenger Jane Doe triggered an emergency. Bus: NB-17. Route: Colombo to Kandy. Current location: 6.927079, 79.861244. Please check on them immediately.",
    );
  });

  /** Verifies that unavailable SMS capability skips direct sending safely. */
  it("sendSosSmsDirect returns false when device SMS is unavailable", async () => {
    mockedIsAvailableAsync.mockResolvedValueOnce(false);

    const result = await sendSosSmsDirect({
      userName: "Jane Doe",
      userId: 12,
      userType: "PASSENGER",
    });

    expect(result).toEqual({ sent: false, contactCount: 0 });
    expect(mockedGetEmergencyContacts).not.toHaveBeenCalled();
  });

  /** Verifies that direct SMS loads the user's emergency contacts and sends the composed message. */
  it("sendSosSmsDirect sends SOS SMS to every emergency contact", async () => {
    mockedIsAvailableAsync.mockResolvedValueOnce(true);
    mockedGetEmergencyContacts.mockResolvedValueOnce([
      {
        contactId: 1,
        ownerId: 12,
        ownerType: "passenger",
        name: "Alice",
        teleNumber: "0711111111",
        relationship: "Sister",
      },
      {
        contactId: 2,
        ownerId: 12,
        ownerType: "passenger",
        name: "Bob",
        teleNumber: "0722222222",
        relationship: "Friend",
      },
    ]);
    mockedSendSMSAsync.mockResolvedValueOnce({ result: "sent" } as never);

    const result = await sendSosSmsDirect({
      userName: "Jane Doe",
      userId: 12,
      userType: "PASSENGER",
      busNumber: "NB-17",
      startLocation: "Colombo",
      endLocation: "Kandy",
      sharedLocation: "6.927079, 79.861244 - Logged user location",
    });

    expect(mockedGetEmergencyContacts).toHaveBeenCalledWith(12, "passenger");
    expect(mockedSendSMSAsync).toHaveBeenCalledWith(
      ["0711111111", "0722222222"],
      "TrackNGo SOS : Passenger Jane Doe triggered an emergency. Bus: NB-17. Route: Colombo to Kandy. Current location: 6.927079, 79.861244. Please check on them immediately.",
    );
    expect(result).toEqual({ sent: true, contactCount: 2 });
  });
});
