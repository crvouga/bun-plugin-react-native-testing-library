/**
 * Live `screen` accessor that bypasses Bun's CJS→ESM named-export snapshot.
 *
 * RNTL reassigns `exports.screen` on each `render()`. Bun's named ESM import
 * of `screen` keeps the original defaultScreen object, so `import { screen }`
 * always throws "`render` function has not been called". Prefer:
 *
 *   const screen = await render(<Comp />);
 *
 * or this helper:
 *
 *   import { getScreen } from "bun-plugin-react-native-testing-library/screen";
 */

export function getScreen(): typeof import("@testing-library/react-native").screen {
  // Always read the live CJS export.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@testing-library/react-native/dist/screen.js") as {
    screen: typeof import("@testing-library/react-native").screen;
  };
  return mod.screen;
}
