import {
  addEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContacts,
} from "../../services/emergencyContactApi";
import { httpDelete, httpGet, httpPost } from "../../services/http";

jest.mock("../../services/http", () => ({
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  httpDelete: jest.fn(),
}));

const mockedHttpGet = httpGet as jest.MockedFunction<typeof httpGet>;
const mockedHttpPost = httpPost as jest.MockedFunction<typeof httpPost>;
const mockedHttpDelete = httpDelete as jest.MockedFunction<typeof httpDelete>;

describe("emergencyContactApi", () => {
  /** Resets emergency-contact API mocks before each service-level test. */
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Verifies that contact loading normalizes owner type query values before calling the backend. */
  it("getEmergencyContacts lowercases the owner type query", async () => {
    mockedHttpGet.mockResolvedValueOnce({
      success: true,
      message: "Fetched",
      data: [{ contactId: 1, name: "Alice" }],
    } as never);

    const result = await getEmergencyContacts(12, "PASSENGER");

    expect(mockedHttpGet).toHaveBeenCalledWith("/api/emergency-contacts", {
      ownerId: 12,
      ownerType: "passenger",
    });
    expect(result).toEqual([{ contactId: 1, name: "Alice" }]);
  });

  /** Verifies that contact creation lowercases the owner type and normalizes empty relationships to null. */
  it("addEmergencyContact posts the normalized contact payload", async () => {
    mockedHttpPost.mockResolvedValueOnce({
      success: true,
      message: "Created",
      data: { contactId: 2, name: "Bob" },
    } as never);

    await addEmergencyContact({
      ownerId: 12,
      ownerType: "DRIVER",
      name: "Bob",
      teleNumber: "0770000000",
    });

    expect(mockedHttpPost).toHaveBeenCalledWith(
      "/api/emergency-contacts",
      undefined,
      {
        ownerId: 12,
        ownerType: "driver",
        name: "Bob",
        teleNumber: "0770000000",
        relationship: null,
      },
    );
  });

  /** Verifies that deleting a contact calls the selected emergency-contact endpoint. */
  it("deleteEmergencyContact targets the selected contact id", async () => {
    mockedHttpDelete.mockResolvedValueOnce({
      success: true,
      message: "Deleted",
      data: undefined,
    } as never);

    await deleteEmergencyContact(7);

    expect(mockedHttpDelete).toHaveBeenCalledWith("/api/emergency-contacts/7");
  });
});
