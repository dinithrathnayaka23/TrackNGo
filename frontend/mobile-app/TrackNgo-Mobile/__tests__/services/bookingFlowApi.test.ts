import {
  quotePromotion,
  type PromotionQuoteRequest,
  type PromotionQuoteResult,
} from "../../services/bookingFlowApi";

describe("quotePromotion", () => {
  const originalFetch = globalThis.fetch;

  /** Replaces the global fetch implementation with a Jest mock for each API test. */
  beforeEach(() => {
    globalThis.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  /** Restores the original fetch implementation after the API tests complete. */
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  /** Verifies that a successful backend response is parsed into the promotion quote result. */
  it("returns the parsed promotion quote when the backend responds successfully", async () => {
    const request = buildRequest();
    const responseBody = {
      success: true,
      message: "Promotion applied.",
      data: buildQuote(),
    };

    (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify(responseBody)),
    } as never);

    await expect(quotePromotion(request)).resolves.toEqual(responseBody.data);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/booking-flow/promotions/quote",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    );
  });

  /** Verifies that backend validation failures surface the API message as a thrown error. */
  it("throws the backend message when the promotion quote request fails", async () => {
    (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          success: false,
          message: "Promo expired.",
          data: null,
        }),
      ),
    } as never);

    await expect(quotePromotion(buildRequest())).rejects.toThrow("Promo expired.");
  });

  /** Builds a stable promotion quote request payload for service-level tests. */
  function buildRequest(): PromotionQuoteRequest {
    return {
      passengerId: 7,
      busId: 88,
      fromLocation: "Kandy",
      toLocation: "Colombo Fort",
      originalAmount: 3200,
      promoCode: "APRIL20",
    };
  }

  /** Builds a representative promotion quote response for service-level assertions. */
  function buildQuote(): PromotionQuoteResult {
    return {
      promotionId: 33,
      name: "APRIL20",
      targetType: "ROUTE",
      discountType: "FLAT",
      discountValue: 500,
      promoCode: "APRIL20",
      originalAmount: 3200,
      discountAmount: 500,
      finalAmount: 2700,
      message: "Promotion applied.",
      eligiblePromotions: [],
    };
  }
});
