import * as SMS from "expo-sms";
import {
  getEmergencyContacts,
  EmergencyContactDto,
} from "./emergencyContactApi";

export interface SosMessageParams {
  userName: string;
  userId: number;
  userType: "PASSENGER" | "DRIVER";
  busNumber?: string;
  startLocation?: string;
  endLocation?: string;
  sharedLocation?: string;
}

// Builds the SMS body that is shared with the user's emergency contacts.
export function buildSosMessage(params: SosMessageParams): string {
  const typeLabel = params.userType === "PASSENGER" ? "Passenger" : "Driver";
  let message = `TrackNGo SOS : ${typeLabel} ${params.userName} triggered an emergency.`;

  if (params.busNumber) {
    message += ` Bus: ${params.busNumber}.`;
  }

  if (params.startLocation || params.endLocation) {
    message += ` Route: ${params.startLocation ?? "Unknown"} to ${params.endLocation ?? "Unknown"}.`;
  }

  if (params.sharedLocation) {
    const coords = params.sharedLocation
      .replace(/\s*-\s*Logged user location/, "")
      .trim();
    message += ` Current location: ${coords}.`;
  }

  message += " Please check on them immediately.";
  return message;
}

// Sends the SOS message directly from the device to the user's emergency contacts.
export async function sendSosSmsDirect(
  params: SosMessageParams,
): Promise<{ sent: boolean; contactCount: number }> {
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) {
    console.warn("SMS is not available on this device");
    return { sent: false, contactCount: 0 };
  }

  const ownerType = params.userType.toLowerCase();
  let contacts: EmergencyContactDto[];
  try {
    contacts = await getEmergencyContacts(params.userId, ownerType);
  } catch (err) {
    console.error("Failed to fetch emergency contacts for SMS:", err);
    return { sent: false, contactCount: 0 };
  }

  if (!contacts || contacts.length === 0) {
    console.warn("No emergency contacts found for direct SMS");
    return { sent: false, contactCount: 0 };
  }

  const phoneNumbers = contacts.map((c) => c.teleNumber);
  const message = buildSosMessage(params);

  const { result } = await SMS.sendSMSAsync(phoneNumbers, message);

  return {
    sent: result === "sent",
    contactCount: phoneNumbers.length,
  };
}
