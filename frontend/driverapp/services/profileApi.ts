import { apiUrl } from '@/config/env';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ProfilePictureUploadResult {
  imageUrl: string;
  thumbnailUrl: string;
  originalUrl: string;
  sizeBytes: number;
}

export async function uploadDriverProfilePicture(
  token: string,
  asset: { uri: string; fileName?: string | null; mimeType?: string | null }
): Promise<ProfilePictureUploadResult> {
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName || `profile-${Date.now()}.jpg`,
    type: asset.mimeType || 'image/jpeg',
  } as unknown as Blob);

  const response = await fetch(apiUrl('/api/profile/picture'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const text = await response.text();
  let data: ApiResponse<ProfilePictureUploadResult>;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(text);
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || text);
  }

  return data.data;
}
