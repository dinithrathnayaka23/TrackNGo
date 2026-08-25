jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({}), {
  virtual: true,
});

// services/http attaches the stored auth token to every request, so AsyncStorage is
// pulled in by anything that talks to the backend and needs its native module stubbed.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
