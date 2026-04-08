import type { UserProfile, UserType } from "../types/chat";
import { httpGet, httpPut } from "./http";

const profileCache = new Map<number, UserProfile>();

export async function getUserProfile(userId: number): Promise<UserProfile> {
  const cached = profileCache.get(userId);
  if (cached) {
    return cached;
  }
  const profile = await httpGet<UserProfile>(`/api/users/${userId}/profile`);
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
  const profile = await httpPut<UserProfile>(`/api/users/${userId}/profile`, body);
  profileCache.set(userId, profile);
  return profile;
}
