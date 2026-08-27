import type { UserProfile, UserType } from "../types/chat";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpDelete, httpGet, httpPostForm, httpPut } from "./http";
import { API_BASE_URL } from "../config/env";

const profileCache = new Map<number, UserProfile>();
const TOKEN_KEY = "trackngo.auth.token";

async function authHeaders(): Promise<Record<string, string> | undefined> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export function resolveProfilePhoto(profilePhoto: string | null | undefined): string | null {
  if (!profilePhoto) return null;
  if (/^https?:\/\//i.test(profilePhoto)) return profilePhoto;
  return `${API_BASE_URL}${profilePhoto.startsWith("/") ? "" : "/"}${profilePhoto}`;
}

export async function getUserProfile(userId: number): Promise<UserProfile> {
  const cached = profileCache.get(userId);
  if (cached) {
    return cached;
  }
  const profile = await httpGet<UserProfile>(
    `/api/users/${userId}/profile`,
    undefined,
    await authHeaders(),
  );
  profileCache.set(userId, profile);
  return profile;
}

export async function updateUserProfile(params: {
  userId: number;
  fullName?: string;
  phoneNumber?: string | null;
  email?: string | null;
  profilePhoto?: string | null;
  userType?: UserType;
}): Promise<UserProfile> {
  const { userId, ...body } = params;
  const profile = await httpPut<UserProfile>(
    `/api/users/${userId}/profile`,
    body,
    await authHeaders(),
  );
  profileCache.set(userId, profile);
  return profile;
}

export interface ProfilePictureUpload {
  imageUrl: string;
  thumbnailUrl: string;
  originalUrl: string;
  sizeBytes: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function uploadProfilePicture(uri: string): Promise<ProfilePictureUpload> {
  const form = new FormData();
  form.append("file", {
    uri,
    name: `profile-${Date.now()}.jpg`,
    type: "image/jpeg",
  } as unknown as Blob);

  const response = await httpPostForm<ApiResponse<ProfilePictureUpload>>(
    "/api/profile/picture",
    form,
    undefined,
    await authHeaders(),
  );
  profileCache.clear();
  return response.data;
}

/**
 * Clears the signed-in user's profile picture. Resolves even when there was nothing
 * stored, so a stale screen tapping remove twice is not treated as a failure.
 */
export async function deleteProfilePicture(): Promise<void> {
  await httpDelete<ApiResponse<{ removed: boolean }>>(
    "/api/profile/picture",
    undefined,
    await authHeaders(),
  );
  profileCache.clear();
}
