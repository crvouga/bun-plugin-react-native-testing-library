---
title: "bun test never consults plugin onResolve for failing bare specifiers"
date: 2026-11-20
category: testing_framework
module: bun test plugin integration
problem_type: architecture_pattern
component: testing_framework
severity: medium
applies_when:
  - "Intercepting or enriching module-resolution failures (missing native packages, actionable diagnostics) under `bun test`"
  - "Designing a Bun plugin whose value depends on seeing imports that fail to resolve"
root_cause: "bun test resolves bare specifiers before plugin resolvers run; plugins only see loads that resolve"
resolution_type: tooling_addition
tags: [bun, bun-test, plugin, module-resolution, diagnostics]
retire_when: "A Bun changelog documents that `bun test` consults plugin onResolve for unresolvable bare specifiers; re-test with a plugin returning a custom namespace for a missing package and delete this doc if interception works."
---

# bun test never consults plugin onResolve for failing bare specifiers

## Context

This repo's plugin makes React Native Testing Library work under `bun test` by combining a runtime plugin (platform resolution, Flow transform) with preload-time `mock.module()` registrations. We wanted resolution failures of ecosystem-shaped imports (e.g. `react-native-fancy-view`, `expo-*`) to produce actionable errors naming the specifier, the importer, and the fix, instead of Bun's bare `Cannot find package 'x'`.

The planned mechanism was a plugin `onResolve` fallback: detect the failing ecosystem specifier and return a custom-namespace module that throws a descriptive error. It does not work, and the failure is silent — the plugin handler is never invoked.

## Guidance

**Resolution interception cannot happen in plugin `onResolve` for imports that fail.** Verified on Bun 1.4.4 (see `src/diagnostics.ts` and `test/contract/resolution-failures.test.ts`): register a plugin whose `onResolve` logs every call, import a nonexistent bare specifier from a test file, and the log never records it — Bun's own package resolution rejects the import before plugin resolvers participate. Plugin `onResolve` fires for loads that resolve (that is what the platform-resolution path relies on), which makes the gap easy to miss in a suite that mostly imports packages that exist.

Intercept resolution failures at **preload time instead**:

- Scan the project's test files statically for ecosystem-shaped specifiers (`react-native-*`, `expo-*`, `@react-native-*`, `@expo/*`), resolve each with `Bun.resolveSync`, and print structured guidance for the ones that cannot resolve (`src/diagnostics.ts` `scanUnresolvedEcosystemImports`, called from `src/preload.ts`).
- Keep the native failure intact. Bun still fails the import loudly; the scan only adds the guidance beside it. Never substitute a mock module for an unresolvable import — that converts a real gap into a silently passing test.
- Cap and prune the scan: skip `node_modules` and dot-directories, bound file count and depth, and skip the dev repo itself when its own tests intentionally reference unresolvable packages.

Applicability note: the same constraint applies to anything else that wanted resolver-level failure hooks under `bun test` — error enrichment, auto-shim suggestions, telemetry on missing packages. The preload scan pattern (or a doctor-style audit that resolves the consumer's dependency tree) is the working substitute until Bun changes this behavior.
