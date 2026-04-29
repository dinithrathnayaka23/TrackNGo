import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import BookingSummaryScreen from "../../../app/booking/booking-summary";
import {
  quotePromotion,
  type PromotionQuoteResult,
} from "../../../services/bookingFlowApi";
import { getUserProfile } from "../../../services/userProfileApi";
import { useSession } from "../../../store/sessionStore";
import { useLocalSearchParams, useRouter } from "expo-router";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
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
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../../utils/busImage", () => ({
  getBusImage: jest.fn(() => null),
}));

jest.mock("../../../services/bookingFlowApi", () => {
  const actual = jest.requireActual("../../../services/bookingFlowApi");
  return {
    ...actual,
    quotePromotion: jest.fn(),
  };
});

jest.mock("../../../services/userProfileApi", () => ({
  getUserProfile: jest.fn(),
}));

jest.mock("../../../store/sessionStore", () => ({
  useSession: jest.fn(),
}));

const mockedQuotePromotion = quotePromotion as jest.MockedFunction<typeof quotePromotion>;
const mockedGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockedUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<
  typeof useLocalSearchParams
>;

describe("BookingSummaryScreen promotion flow", () => {
  const router = {
    back: jest.fn(),
    push: jest.fn(),
  };

  /** Resets mock state and applies a stable booking summary route for each test case. */
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue(router as never);
    mockedUseLocalSearchParams.mockReturnValue(
      {
        from: "Kandy",
        to: "Colombo Fort",
        busId: "88",
        busType: "Luxury A/C",
        depart: "08:30",
        date: "2026-04-25",
        seats: "A1,A2",
        pricePerSeat: "1500",
        busBrand: "Unknown",
        amenities: "[]",
      } as never,
    );
    mockedUseSession.mockReturnValue({
      currentUser: { userId: 7 },
      loading: false,
      setCurrentUser: jest.fn(),
      clearCurrentUser: jest.fn(),
    } as never);
    mockedGetUserProfile.mockResolvedValue({
      userId: 7,
      fullName: "Jane Passenger",
      contactPersonName: null,
      phoneNumber: "+94770000000",
      email: "jane@example.com",
      profilePhoto: null,
      userType: "PASSENGER",
    } as never);
  });

  /** Restores runtime spies after each test finishes. */
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Verifies that the screen loads passenger details and the automatic best promotion quote on mount. */
  it("loads the passenger profile and applies the automatic promotion quote", async () => {
    mockedQuotePromotion.mockResolvedValueOnce(
      buildQuote({
        promotionId: 501,
        name: "Weekend Saver",
        discountAmount: 300,
        finalAmount: 2900,
        message: "Best available promotion applied.",
      }),
    );

    const { getByDisplayValue, getByText, getAllByText } = render(<BookingSummaryScreen />);

    await waitFor(() => expect(mockedGetUserProfile).toHaveBeenCalledWith(7));
    await waitFor(() =>
      expect(mockedQuotePromotion).toHaveBeenCalledWith({
        passengerId: 7,
        busId: 88,
        fromLocation: "Kandy",
        toLocation: "Colombo Fort",
        originalAmount: 3200,
        promoCode: undefined,
      }),
    );

    expect(getByDisplayValue("Jane Passenger")).toBeTruthy();
    expect(getByDisplayValue("+94770000000")).toBeTruthy();
    expect(getByDisplayValue("jane@example.com")).toBeTruthy();
    expect(getByText("Weekend Saver applied.")).toBeTruthy();
    expect(getByText("- LKR 300.00")).toBeTruthy();
    expect(getAllByText("LKR 2,900.00").length).toBeGreaterThan(0);
  });

  /** Verifies that applying a promo code sends the trimmed code and forwards promotion data to checkout. */
  it("applies a manual promo code and forwards it to the payment screen", async () => {
    mockedQuotePromotion
      .mockResolvedValueOnce(buildQuote({ promotionId: null, name: null, discountAmount: 0, finalAmount: 3200, promoCode: null }))
      .mockResolvedValueOnce(
        buildQuote({
          promotionId: 33,
          name: "APRIL20",
          promoCode: "APRIL20",
          discountAmount: 500,
          finalAmount: 2700,
        }),
      );

    const { getByPlaceholderText, getByText, getByDisplayValue } = render(<BookingSummaryScreen />);

    await waitFor(() => expect(mockedQuotePromotion).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getByDisplayValue("Jane Passenger")).toBeTruthy());

    fireEvent.changeText(getByPlaceholderText("Enter Promo Code"), "  APRIL20  ");
    fireEvent.press(getByText("Apply"));

    await waitFor(() =>
      expect(mockedQuotePromotion).toHaveBeenNthCalledWith(2, {
        passengerId: 7,
        busId: 88,
        fromLocation: "Kandy",
        toLocation: "Colombo Fort",
        originalAmount: 3200,
        promoCode: "APRIL20",
      }),
    );

    expect(getByText("APRIL20 applied.")).toBeTruthy();

    fireEvent.press(getByText("Terms & Conditions"));
    fireEvent.press(getByText("Confirm & Pay"));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/booking/payment-gateway",
        params: {
          from: "Kandy",
          to: "Colombo Fort",
          busId: "88",
          busType: "Luxury A/C",
          depart: "08:30",
          date: "2026-04-25",
          seats: "A1,A2",
          totalPrice: "2700",
          originalAmount: "3200",
          discountAmount: "500",
          promotionId: "33",
          promoCode: "APRIL20",
          fullName: "Jane Passenger",
          mobile: "+94770000000",
          email: "jane@example.com",
          specialRequest: "",
        },
      }),
    );
  });

  /** Verifies that rejected promo code requests surface the backend error message to the passenger. */
  it("shows a promotion error message when promo application fails", async () => {
    mockedQuotePromotion
      .mockResolvedValueOnce(buildQuote({ promotionId: null, name: null, discountAmount: 0, finalAmount: 3200, promoCode: null }))
      .mockRejectedValueOnce(new Error("Promo expired."));

    const { getByPlaceholderText, getByText } = render(<BookingSummaryScreen />);

    await waitFor(() => expect(mockedQuotePromotion).toHaveBeenCalledTimes(1));

    fireEvent.changeText(getByPlaceholderText("Enter Promo Code"), "EXPIRED");
    fireEvent.press(getByText("Apply"));

    await waitFor(() => expect(getByText("Promo expired.")).toBeTruthy());
    expect(getByText("- LKR 0.00")).toBeTruthy();
  });

  /** Verifies that clearing the promo code reloads the automatic quote and removes the manual discount. */
  it("reloads the automatic quote when the promo field is cleared", async () => {
    mockedQuotePromotion
      .mockResolvedValueOnce(buildQuote({ promotionId: null, name: null, discountAmount: 0, finalAmount: 3200, promoCode: null }))
      .mockResolvedValueOnce(
        buildQuote({
          promotionId: 71,
          name: "SPRING",
          promoCode: "SPRING",
          discountAmount: 400,
          finalAmount: 2800,
        }),
      )
      .mockResolvedValueOnce(buildQuote({ promotionId: null, name: null, discountAmount: 0, finalAmount: 3200, promoCode: null }));

    const { getByPlaceholderText, getByText, queryByText } = render(<BookingSummaryScreen />);

    await waitFor(() => expect(mockedQuotePromotion).toHaveBeenCalledTimes(1));

    const promoInput = getByPlaceholderText("Enter Promo Code");
    fireEvent.changeText(promoInput, "SPRING");
    fireEvent.press(getByText("Apply"));

    await waitFor(() => expect(getByText("SPRING applied.")).toBeTruthy());
    expect(getByText("- LKR 400.00")).toBeTruthy();

    fireEvent.changeText(promoInput, "");

    await waitFor(() =>
      expect(mockedQuotePromotion).toHaveBeenNthCalledWith(3, {
        passengerId: 7,
        busId: 88,
        fromLocation: "Kandy",
        toLocation: "Colombo Fort",
        originalAmount: 3200,
        promoCode: undefined,
      }),
    );

    await waitFor(() => expect(queryByText("SPRING applied.")).toBeNull());
    expect(getByText("- LKR 0.00")).toBeTruthy();
  });

  /** Builds a consistent promotion quote payload for the mocked booking summary responses. */
  function buildQuote(overrides: Partial<PromotionQuoteResult>): PromotionQuoteResult {
    return {
      promotionId: 99,
      name: "Promo Saver",
      targetType: "ROUTE",
      discountType: "FLAT",
      discountValue: 300,
      promoCode: "PROMO",
      originalAmount: 3200,
      discountAmount: 300,
      finalAmount: 2900,
      message: "Promotion applied.",
      eligiblePromotions: [],
      ...overrides,
    };
  }
});
