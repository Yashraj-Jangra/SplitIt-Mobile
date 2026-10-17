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

// 1. Fix Swift tools version and concurrency flags in Package.swift for Xcode 16.4 (Swift 6.1)
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

// 2. Define SWIFT_IMMORTAL_REFERENCE macro for Swift 6.1 in C++ bridging headers
const immortalMacro = `#include <swift/bridging>
#ifndef SWIFT_IMMORTAL_REFERENCE
#define SWIFT_IMMORTAL_REFERENCE __attribute__((swift_attr("import_reference"))) __attribute__((swift_attr("retain:immortal"))) __attribute__((swift_attr("release:immortal")))
#endif`;

const retainedPtrHeader = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI-Cxx',
  'include',
  'RetainedSwiftPointer.h'
);
replaceInFile(retainedPtrHeader, '#include <swift/bridging>', immortalMacro);

const hostFuncClosureHeader = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI-Cxx',
  'include',
  'HostFunctionClosure.h'
);
replaceInFile(hostFuncClosureHeader, '#include <swift/bridging>', immortalMacro);

// Add static create() factory to HostFunctionClosure for Swift 6.1 reference type initialization
const createFactory = `explicit HostFunctionClosure(Context context, Closure closure, Deallocator deallocator) : RetainedSwiftPointer(context, deallocator), _closure(closure) {};

  static HostFunctionClosure *create(Context context, Closure *closure, Deallocator *deallocator) noexcept {
    return new HostFunctionClosure(context, closure, deallocator);
  }`;
replaceInFile(
  hostFuncClosureHeader,
  'explicit HostFunctionClosure(Context context, Closure closure, Deallocator deallocator) : RetainedSwiftPointer(context, deallocator), _closure(closure) {};',
  createFactory
);

// Add static appendPropNameId to HostObjectCallbacks to avoid vector.push_back move-only copy construction in Swift 6.1
const hostObjectCallbacksHeader = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI-Cxx',
  'include',
  'HostObjectCallbacks.h'
);
const propNameIdsHelper = `using PropNameIds = std::vector<facebook::jsi::PropNameID>;

  static inline void appendPropNameId(PropNameIds &vector, facebook::jsi::Runtime &runtime, const std::string &name) {
    vector.emplace_back(facebook::jsi::PropNameID::forUtf8(runtime, name));
  }`;
replaceInFile(
  hostObjectCallbacksHeader,
  'using PropNameIds = std::vector<facebook::jsi::PropNameID>;',
  propNameIdsHelper
);

// 3. Forward declare retain/release functions in RuntimeScheduler.h so SWIFT_SHARED_REFERENCE resolves
const runtimeSchedulerHeader = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI-Cxx',
  'include',
  'RuntimeScheduler.h'
);
const forwardDecl = `namespace expo {
class RuntimeScheduler;
}
inline void retainRuntimeScheduler(expo::RuntimeScheduler *scheduler);
inline void releaseRuntimeScheduler(expo::RuntimeScheduler *scheduler);

namespace expo {`;
replaceInFile(runtimeSchedulerHeader, 'namespace expo {', forwardDecl);

// 4. Fix Task+immediate.swift for Swift 6.1 (remove Task.immediate and Task(name:) which require Swift 6.2 / OS 26)
const taskImmediateSwift = path.join(
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI',
  'Extensions',
  'Task+immediate.swift'
);
const oldTaskBody = `    if #available(macOS 26.0, iOS 26.0, watchOS 26.0, tvOS 26.0, *) {
      return Task.immediate(name: name, priority: priority, operation: operation)
    } else {
      // In the polyfill always use the highest priority and hope it executes earlier.
      return Task(name: name, priority: .high, operation: operation)
    }`;
const newTaskBody = `    return Task(priority: priority ?? .high, operation: operation)`;
replaceInFile(taskImmediateSwift, oldTaskBody, newTaskBody);

// 5. Fix JavaScriptRuntime.swift syntax for Swift 6.1
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

// Replace vector.push_back loop with HostObjectCallbacks.appendPropNameId
const oldPropLoop1 = `      for propertyName in propertyNames {
        let propNameId = facebook.jsi.PropNameID.forUtf8(iRuntime, std.string(propertyName))
        vector.push_back(consuming: propNameId)
      }`;
const oldPropLoop2 = `      for propertyName in propertyNames {
        let propNameId = facebook.jsi.PropNameID.forUtf8(iRuntime, std.string(propertyName))
        vector.push_back(consume propNameId)
      }`;
const oldPropLoop3 = `      for propertyName in propertyNames {
        let propNameId = facebook.jsi.PropNameID.forUtf8(iRuntime, std.string(propertyName))
        vector.push_back(propNameId)
      }`;
const newPropLoop = `      for propertyName in propertyNames {
        expo.HostObjectCallbacks.appendPropNameId(&vector, iRuntime, std.string(propertyName))
      }`;
replaceInFile(jsRuntimeSwift, oldPropLoop1, newPropLoop);
replaceInFile(jsRuntimeSwift, oldPropLoop2, newPropLoop);
replaceInFile(jsRuntimeSwift, oldPropLoop3, newPropLoop);

replaceInFile(
  jsRuntimeSwift,
  'return expo.HostFunctionClosure(context, call, deallocate)',
  'return expo.HostFunctionClosure.create(context, call, deallocate)'
);

// 6. Fix 'weak let' and nonisolated(unsafe) for weak properties in Sendable classes
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
        replaceInFile(fullPath, 'nonisolated(unsafe) nonisolated(unsafe)', 'nonisolated(unsafe)');
      }
    }
  }
  walkDir(sourcesDir);
}

console.log('[Patch] ExpoModulesJSI patch complete.');
