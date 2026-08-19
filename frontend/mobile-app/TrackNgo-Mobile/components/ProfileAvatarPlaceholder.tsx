import React from "react";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

/**
 * Neutral avatar shown when a profile has no photo.
 *
 * This is the illustration the admin web app already uses
 * (admin-web/my-react-app/src/assets/images/adminProfilePlaceholder.svg),
 * redrawn with react-native-svg so a person without a photo looks the same in
 * both products. The artwork paints its own circular background, so it does
 * not need a coloured container behind it.
 */
export function ProfileAvatarPlaceholder({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Defs>
        <LinearGradient id="profileAvatarBackground" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#DBEAFE" />
          <Stop offset="1" stopColor="#BFDBFE" />
        </LinearGradient>
        <LinearGradient id="profileAvatarShirt" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#334155" />
          <Stop offset="1" stopColor="#1E3A8A" />
        </LinearGradient>
      </Defs>

      <Rect width="256" height="256" rx="128" fill="url(#profileAvatarBackground)" />
      <Circle cx="128" cy="99" r="48" fill="#F8FAFC" />
      <Path
        d="M48 224c8-48 38-75 80-75s72 27 80 75"
        fill="url(#profileAvatarShirt)"
      />
      <Path
        d="M93 148c9 11 21 17 35 17s26-6 35-17c-6 26-18 39-35 39s-29-13-35-39Z"
        fill="#E2E8F0"
      />
    </Svg>
  );
}

export default ProfileAvatarPlaceholder;
