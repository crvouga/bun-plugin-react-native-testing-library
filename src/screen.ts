/**
 * Live RNTL `screen` accessor — prefer `import { screen } from "@testing-library/react-native"`
 * after preload when possible. This helper always resolves RNTL from `process.cwd()`.
 */

export function getScreen(): typeof import("@testing-library/react-native").screen {
  try {
    const pkg = Bun.resolveSync("@testing-library/react-native/package.json", process.cwd());
    const screenPath = pkg.replace(/package\.json$/, "dist/screen.js");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(screenPath).screen;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@testing-library/react-native/dist/screen.js").screen;
  }
}
