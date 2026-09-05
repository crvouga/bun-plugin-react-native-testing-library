/**
 * Minimal Jest preset replacing `react-native/jest-preset`, which RN 0.87+ no
 * longer ships. Mirrors the historical RN Jest environment enough for the
 * differential oracle (RNTL + react-test-renderer under Babel).
 */
module.exports = {
  haste: {
    defaultPlatform: "ios",
    platforms: ["android", "ios", "native"],
  },
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  transformIgnorePatterns: ["node_modules/(?!(react-native|@react-native|@react-native-community|@testing-library)/)"],
  setupFiles: ["<rootDir>/rn-jest-setup.js"],
  moduleNameMapper: {
    "^react-native$": "<rootDir>/__mocks__/react-native.js",
    "\\.(png|jpg|jpeg|gif|webp|svg)$": "<rootDir>/asset-stub.js",
  },
  testEnvironment: "node",
};
