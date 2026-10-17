const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, search, replacement) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(search)) {
      content = content.replaceAll(search, replacement);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[Patch] Updated: ${filePath}`);
    }
  }
}

// 1. Fix Swift tools version for Xcode 16.4 (Swift 6.1) and add concurrency flags in Package.swift
const packageSwift = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Package.swift'
);
replaceInFile(packageSwift, '// swift-tools-version: 6.2', '// swift-tools-version: 6.1');
replaceInFile(
  packageSwift,
  '.enableUpcomingFeature("NonisolatedNonsendingByDefault"),',
  '// .enableUpcomingFeature("NonisolatedNonsendingByDefault"),'
);
replaceInFile(
  packageSwift,
  '.enableUpcomingFeature("InferIsolatedConformances"),',
  '// .enableUpcomingFeature("InferIsolatedConformances"),'
);
replaceInFile(
  packageSwift,
  '"-clang-header-expose-decls=has-expose-attr",',
  '"-clang-header-expose-decls=has-expose-attr",\n          "-strict-concurrency=minimal",\n          "-suppress-warnings",'
);

// 2. Fix RuntimeScheduler.h constructor annotation
const headerFile = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI-Cxx',
  'include',
  'RuntimeScheduler.h'
);
replaceInFile(headerFile, 'SWIFT_RETURNS_RETAINED RuntimeScheduler', 'RuntimeScheduler');

// 3. Fix trailing comma in JavaScriptRuntime.swift (SE-0439 syntax rejected by Swift 6.1)
const jsRuntimeSwift = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI',
  'Runtime',
  'JavaScriptRuntime.swift'
);
replaceInFile(
  jsRuntimeSwift,
  '_ arguments: consuming JavaScriptValuesBuffer,',
  '_ arguments: consuming JavaScriptValuesBuffer'
);

// 4. Fix 'weak let' and nonisolated(unsafe) for weak properties in Sendable classes
const sourcesDir = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources'
);
if (fs.existsSync(sourcesDir)) {
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walkDir(fullPath);
      } else if (file.endsWith('.swift')) {
        replaceInFile(fullPath, 'weak let', 'nonisolated(unsafe) weak var');
        replaceInFile(fullPath, 'private weak var runtime:', 'nonisolated(unsafe) private weak var runtime:');
        replaceInFile(fullPath, 'internal weak var runtime:', 'nonisolated(unsafe) internal weak var runtime:');
        // Clean up accidental duplicate annotations if previously patched
        replaceInFile(fullPath, 'nonisolated(unsafe) nonisolated(unsafe)', 'nonisolated(unsafe)');
      }
    }
  }
  walkDir(sourcesDir);
}

console.log('[Patch] ExpoModulesJSI patch complete.');
