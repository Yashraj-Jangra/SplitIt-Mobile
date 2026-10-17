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

// 1. Fix RuntimeScheduler.h constructor annotation
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

// 2. Fix Package.swift concurrency flags
const packageSwift = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Package.swift'
);
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
  'swiftLanguageModes: [.v6],',
  'swiftLanguageModes: [.v5],'
);

// 3. Fix any 'weak let' -> 'weak var' across expo-modules-jsi sources
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
        replaceInFile(fullPath, 'weak let', 'weak var');
      }
    }
  }
  walkDir(sourcesDir);
}

console.log('[Patch] ExpoModulesJSI patch complete.');
