import { Alert, Platform } from "react-native";
import * as Sharing from "expo-sharing";
// The Storage Access Framework only exists on the legacy file-system API in
// SDK 54; the rewritten module does not expose it.
import {
  EncodingType,
  StorageAccessFramework,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";

/**
 * The Android folder picker lists a "Downloads" shortcut backed by a virtual
 * documents provider. That root rejects file creation, so writing to it fails
 * with "isn't writable". The real Download folder lives on the external
 * storage provider and is writable, so the picker is seeded there and a
 * shortcut selection is caught before we attempt the write.
 */
const ANDROID_DOWNLOADS_SHORTCUT_AUTHORITY =
  "com.android.providers.downloads.documents";

type TicketSaveOutcome = "saved" | "declined" | "unwritable" | "failed";

/** Hands the PDF to the system share sheet. */
export async function shareTicketPdf(pdfUri: string, dialogTitle: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert("Unavailable", "Sharing is not available on this device.");
    return;
  }
  await Sharing.shareAsync(pdfUri, {
    mimeType: "application/pdf",
    dialogTitle,
    UTI: "com.adobe.pdf",
  });
}

/**
 * Writes the PDF into a folder the passenger picks. Returns why it did not
 * save so the caller can explain, rather than throwing a raw IOException that
 * reads like the PDF itself failed to build.
 */
async function savePdfToDevice(
  pdfUri: string,
  fileName: string,
): Promise<TicketSaveOutcome> {
  const permission =
    await StorageAccessFramework.requestDirectoryPermissionsAsync(
      StorageAccessFramework.getUriForDirectoryInRoot("Download"),
    );

  if (!permission.granted) {
    return "declined";
  }
  if (permission.directoryUri.includes(ANDROID_DOWNLOADS_SHORTCUT_AUTHORITY)) {
    return "unwritable";
  }

  try {
    const base64 = await readAsStringAsync(pdfUri, {
      encoding: EncodingType.Base64,
    });
    const targetUri = await StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      fileName,
      "application/pdf",
    );
    await writeAsStringAsync(targetUri, base64, {
      encoding: EncodingType.Base64,
    });
    return "saved";
  } catch (error) {
    console.error("[TicketPdf] writing to the chosen folder failed", error);
    return "failed";
  }
}

/**
 * Saves a generated ticket PDF to the device.
 *
 * Android gets a real file save into a folder the passenger chooses. iOS has
 * no user-facing Downloads folder, so there the share sheet is the save flow:
 * it is where "Save to Files" lives. Every ticket screen goes through here so
 * the two behave identically.
 */
export async function downloadTicketPdf(pdfUri: string, fileName: string) {
  if (Platform.OS === "android") {
    const outcome = await savePdfToDevice(pdfUri, fileName);

    if (outcome === "saved") {
      Alert.alert("Ticket saved", `${fileName} was saved to the folder you chose.`);
      return;
    }

    if (outcome === "unwritable") {
      Alert.alert(
        "Pick a different folder",
        "Android does not let apps write to that Downloads shortcut. " +
          "Open the menu in the picker, choose your phone storage, then " +
          "select a folder such as Download or Documents.",
        [
          {
            text: "Share instead",
            onPress: () => {
              void shareTicketPdf(pdfUri, "Save your TrackNGo bus ticket");
            },
          },
          { text: "OK", style: "cancel" },
        ],
      );
      return;
    }

    // "declined" or "failed": fall through to the share sheet so the passenger
    // still has a way to keep the ticket.
  }

  await shareTicketPdf(pdfUri, "Save your TrackNGo bus ticket");
}
