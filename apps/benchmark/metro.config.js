const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/**
 * Metro configuration for the monorepo: watch the workspace root so the local
 * `react-native-tgfx` package and hoisted node_modules resolve.
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// The tgfx package's own node_modules carry newer Reanimated, worklets and Nitro
// for its dev tooling. A second Reanimated instance crashes at init and a second
// worklets runtime breaks every other library's mappers (RN Skia's included), so
// the app must only ever see the hoisted copies.
const escape = s => s.replace(/[/\\.]/g, '\\$&');
const nested = path.resolve(workspaceRoot, 'packages/react-native-tgfx/node_modules');
const blockList = new RegExp(
  `^${escape(nested)}[/\\\\](react-native-reanimated|react-native-worklets|react-native-nitro-modules)[/\\\\].*$`
);

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    blockList,
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
