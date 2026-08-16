import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { LocalizedText as Text } from "../utils/i18n";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface Props {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
}

export function ImageViewerModal({ visible, imageUrl, onClose }: Props) {
  const [saving, setSaving] = useState(false);

  const saveToGallery = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Storage permission is required to save images.",
        );
        return;
      }

      const fileName = `TrackNGo_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      const download = await FileSystem.downloadAsync(imageUrl, fileUri);
      await MediaLibrary.saveToLibraryAsync(download.uri);

      if (Platform.OS === "android") {
        Alert.alert("Saved", "Image saved to gallery.");
      } else {
        Alert.alert("Saved", "Image saved to camera roll.");
      }
    } catch {
      Alert.alert("Save failed", "Could not save the image.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <View style={styles.backdrop}>
        {/* top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
          <Pressable onPress={saveToGallery} style={styles.downloadBtn}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.downloadTxt}>Save</Text>
            )}
          </Pressable>
        </View>

        {/* image */}
        <Image
          source={{ uri: imageUrl }}
          style={styles.fullImage}
          resizeMode="contain"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 36,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeTxt: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  downloadBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    flexDirection: "row",
    alignItems: "center",
  },
  downloadTxt: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.75,
  },
});
