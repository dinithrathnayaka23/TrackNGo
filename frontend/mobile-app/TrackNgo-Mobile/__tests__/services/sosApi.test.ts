import {
  getActiveEmergencyNumbers,
  triggerSosAlert,
} from "../../services/sosApi";
import { httpGet, httpPost } from "../../services/http";

jest.mock("../../services/http", () => ({
  httpGet: jest.fn(),
  httpPost: jest.fn(),
}));

const mockedHttpGet = httpGet as jest.MockedFunction<typeof httpGet>;
const mockedHttpPost = httpPost as jest.MockedFunction<typeof httpPost>;

describe("sosApi", () => {
  /** Resets SOS API mocks before each service-level test. */
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Verifies that the active emergency number request hits the correct endpoint and unwraps the response. */
  it("getActiveEmergencyNumbers returns the active emergency number row", async () => {
    mockedHttpGet.mockResolvedValueOnce({
      success: true,
      message: "Fetched",
      data: {
        emergencyId: 1,
        label: "Sri Lanka",
        fireBrigade: "110",
        ambulance: "1990",
        police: "119",
        helpCenter: "1919",
      },
    } as never);

    const result = await getActiveEmergencyNumbers();

    expect(mockedHttpGet).toHaveBeenCalledWith("/api/emergency-numbers/active");
    expect(result.police).toBe("119");
  });

  /** Verifies that triggering SOS posts the payload to the backend trigger endpoint. */
  it("triggerSosAlert posts the provided SOS payload", async () => {
    mockedHttpPost.mockResolvedValueOnce({
      success: true,
      message: "Triggered",
      data: null,
    } as never);

    await triggerSosAlert({
      passengerId: 12,
      sharedLocation: "6.927079, 79.861244 - Logged user location",
      busNumber: "NB-17",
      notifyEmergencyContacts: true,
    });

    expect(mockedHttpPost).toHaveBeenCalledWith(
      "/api/sos-alerts/trigger",
      undefined,
      {
        passengerId: 12,
        sharedLocation: "6.927079, 79.861244 - Logged user location",
        busNumber: "NB-17",
        notifyEmergencyContacts: true,
      },
    );
  });
});
