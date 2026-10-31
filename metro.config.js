const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const localCoreRoot = path.resolve(projectRoot, 'packages/core');
const externalCoreRoot = path.resolve(projectRoot, '../SplitIt-Web/packages/core');
const legacyCoreRoot = path.resolve(projectRoot, '../SplitWise-Clone/packages/core');

const config = getDefaultConfig(projectRoot);

// Ensure Metro watches shared package only if directory exists
const watchFolders = [];
if (fs.existsSync(localCoreRoot)) {
  watchFolders.push(localCoreRoot);
} else if (fs.existsSync(externalCoreRoot)) {
  watchFolders.push(externalCoreRoot);
} else if (fs.existsSync(legacyCoreRoot)) {
  watchFolders.push(legacyCoreRoot);
}
config.watchFolders = watchFolders;

// Ensure node modules are resolved correctly
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = config;
