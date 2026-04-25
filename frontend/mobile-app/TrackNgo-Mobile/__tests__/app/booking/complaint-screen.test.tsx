import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import ComplaintScreen, {
  guessImageExtension,
  toComplaintTypeValue,
} from "../../../app/booking/complaint";
import {
  createComplaint,
  getMyComplaints,
  type ComplaintDto,
} from "../../../services/complaintsApi";
import { uploadMedia } from "../../../services/chatApi";
import { useSession } from "../../../store/sessionStore";
import { useLocalSearchParams, useRouter } from "expo-router";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useFocusEffect: (callback: () => void) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, name);
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
  CameraType: { back: "back" },
}));

jest.mock("../../../services/complaintsApi", () => ({
  createComplaint: jest.fn(),
  getMyComplaints: jest.fn(),
}));

jest.mock("../../../services/chatApi", () => ({
  uploadMedia: jest.fn(),
}));

jest.mock("../../../store/sessionStore", () => ({
  useSession: jest.fn(),
}));

const mockedCreateComplaint = createComplaint as jest.MockedFunction<typeof createComplaint>;
const mockedGetMyComplaints = getMyComplaints as jest.MockedFunction<typeof getMyComplaints>;
const mockedUploadMedia = uploadMedia as jest.MockedFunction<typeof uploadMedia>;
const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockedUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<
  typeof useLocalSearchParams
>;

describe("ComplaintScreen", () => {
  const router = {
    back: jest.fn(),
    push: jest.fn(),
  };

  /** Resets mock state and applies the default mobile session and route values. */
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue(router as never);
    mockedUseLocalSearchParams.mockReturnValue({ bookingRef: "BK-1001" } as never);
    mockedUseSession.mockReturnValue({
      currentUser: { userId: 15 },
      loading: false,
      setCurrentUser: jest.fn(),
      clearCurrentUser: jest.fn(),
    } as never);
    mockedGetMyComplaints.mockResolvedValue([]);
    mockedCreateComplaint.mockResolvedValue({
      id: 77,
      complaintType: "safety_concern",
      description: "Door was unsafe.",
      status: "pending",
    });
    mockedUploadMedia.mockResolvedValue({ mediaUrl: "https://cdn.example.com/photo.jpg" } as never);
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    jest.spyOn(console, "error").mockImplementation(jest.fn());
  });

  /** Restores runtime spies after each test completes. */
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Verifies that complaint history is loaded and mapped into readable UI labels. */
  it("loads and displays the latest mapped complaint", async () => {
    mockedGetMyComplaints.mockResolvedValueOnce([
      buildComplaintDto({
        id: 42,
        complaintType: "late_arrival",
        description: "Bus came 20 minutes late.",
        status: "under_review",
        adminResponse: "  We are reviewing this issue.  ",
      }),
    ]);

    const { getByText } = render(<ComplaintScreen />);

    await waitFor(() => expect(mockedGetMyComplaints).toHaveBeenCalledWith(15));

    expect(getByText("Late Arrival")).toBeTruthy();
    expect(getByText("Under Review")).toBeTruthy();
    expect(getByText("Bus came 20 minutes late.")).toBeTruthy();
    expect(getByText("Admin Response")).toBeTruthy();
    expect(getByText("We are reviewing this issue.")).toBeTruthy();
  });

  /** Verifies that the screen blocks submission until the complaint category is selected. */
  it("shows an alert when submitting without a category", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByPlaceholderText, getByText } = render(<ComplaintScreen />);

    fireEvent.changeText(
      getByPlaceholderText("Please describe the issue in detail..."),
      "The bus skipped my stop.",
    );
    fireEvent.press(getByText("Submit Complaint"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Missing category",
      "Please select a complaint category.",
    );
    expect(mockedCreateComplaint).not.toHaveBeenCalled();
  });

  /** Verifies that a valid complaint form submits the normalized API payload and refreshes the list. */
  it("submits a complaint and reloads the complaint preview", async () => {
    mockedGetMyComplaints
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildComplaintDto({
          id: 77,
          complaintType: "safety_concern",
          description: "Door was unsafe.",
          status: "pending",
        }),
      ]);

    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByText, getByPlaceholderText } = render(<ComplaintScreen />);

    fireEvent.press(getByText("Select category"));
    fireEvent.press(getByText("Safety Concern"));
    fireEvent.press(getByText("High"));
    fireEvent.changeText(
      getByPlaceholderText("Please describe the issue in detail..."),
      "  Door was unsafe.  ",
    );
    fireEvent.press(getByText("Submit Complaint"));

    await waitFor(() =>
      expect(mockedCreateComplaint).toHaveBeenCalledWith(
        {
          image: undefined,
          bookingReference: "BK-1001",
          complaintType: "safety_concern",
          priority: "high",
          description: "Door was unsafe.",
        },
        15,
      ),
    );

    await waitFor(() => expect(mockedGetMyComplaints).toHaveBeenCalledTimes(2));
    expect(alertSpy).toHaveBeenCalledWith(
      "Complaint submitted",
      "Your complaint has been submitted successfully.",
    );
    expect(getByText("Safety Concern")).toBeTruthy();
    expect(getByText("Door was unsafe.")).toBeTruthy();
    expect(getByPlaceholderText("Please describe the issue in detail...").props.value).toBe("");
  });

  /** Verifies that backend submission failures surface a user-friendly error alert. */
  it("shows an error alert when complaint submission fails", async () => {
    mockedCreateComplaint.mockRejectedValueOnce(new Error("network error"));

    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByText, getByPlaceholderText } = render(<ComplaintScreen />);

    fireEvent.press(getByText("Select category"));
    fireEvent.press(getByText("Route Issue"));
    fireEvent.changeText(
      getByPlaceholderText("Please describe the issue in detail..."),
      "Bus changed the route unexpectedly.",
    );
    fireEvent.press(getByText("Submit Complaint"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Submit failed",
        "Could not submit your complaint.",
      ),
    );
  });

  /** Verifies that helper utilities convert UI labels and MIME types into backend-friendly values. */
  it("maps helper values for complaint types and image extensions", () => {
    expect(toComplaintTypeValue("Driver Behavior")).toBe("driver_behavior");
    expect(toComplaintTypeValue("Something Else")).toBe("other");
    expect(guessImageExtension("image/png")).toBe("png");
    expect(guessImageExtension("image/webp")).toBe("webp");
    expect(guessImageExtension(undefined)).toBe("jpg");
  });

  /** Builds the complaint DTO shape returned by the complaint API mock. */
  function buildComplaintDto(overrides: Partial<ComplaintDto>): ComplaintDto {
    return {
      id: 1,
      complaintType: "driver_behavior",
      description: "Driver issue.",
      status: "pending",
      adminResponse: null,
      createdAt: "2026-04-25T10:00:00",
      ...overrides,
    };
  }
});
