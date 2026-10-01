const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const corePackageRoot = path.resolve(__dirname, '../SplitWise-Clone/packages/core');

const config = getDefaultConfig(projectRoot);

// Ensure Metro watches external shared monorepo package
config.watchFolders = [corePackageRoot];

// Ensure node modules are resolved correctly
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = config;
