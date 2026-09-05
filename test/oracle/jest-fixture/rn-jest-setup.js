/**
 * Historical react-native/jest/setup.js essentials for unit-test hosts.
 */
global.__DEV__ = true;
global.__METRO_GLOBAL_PREFIX__ = "";

// Fake timers helpers expected by some RN internals
if (typeof global.requestAnimationFrame !== "function") {
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}
