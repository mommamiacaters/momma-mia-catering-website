// Metro config for an Expo app inside a pnpm monorepo, wrapped with NativeWind v4.
// https://docs.expo.dev/guides/monorepos/ | https://www.nativewind.dev/docs/getting-started/installation
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in shared `packages/*` hot-reload.
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Wrap LAST, after all monorepo customizations are applied.
module.exports = withNativeWind(config, { input: "./global.css" });
