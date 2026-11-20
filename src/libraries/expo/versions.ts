/**
 * Expo / jest-expo SDK pairing check. The definitions tables the expo-core
 * shim consumes come from jest-expo, so they only track the installed Expo
 * SDK when the two majors match.
 */

export type VersionPairing = {
  match: boolean;
  note?: string;
};

function sdkMajor(version: string | null): number | null {
  if (!version) return null;
  const m = /^(\d+)/.exec(version.trim());
  return m ? Number(m[1]) : null;
}

/**
 * Compare the installed `expo` and `jest-expo` versions. Nulls mean the
 * package was not installed (nothing to mismatch); a present expo with a
 * missing or off-major jest-expo is a mismatch.
 */
export function checkExpoJestExpoVersions(expoVersion: string | null, jestExpoVersion: string | null): VersionPairing {
  const expoMajor = sdkMajor(expoVersion);
  const jestExpoMajor = sdkMajor(jestExpoVersion);
  if (expoMajor == null && jestExpoMajor == null) return { match: true };
  if (expoMajor != null && jestExpoMajor != null) {
    if (expoMajor === jestExpoMajor) return { match: true };
    return {
      match: false,
      note: `expo ${expoVersion} is paired with jest-expo ${jestExpoVersion}; native-module definitions may not match this SDK. Install jest-expo@~${expoMajor}.0.0`,
    };
  }
  const which = expoMajor != null ? `jest-expo@~${expoMajor}.0.0` : "expo";
  return {
    match: false,
    note: `Install ${which} so the native-module definitions match the installed SDK.`,
  };
}
