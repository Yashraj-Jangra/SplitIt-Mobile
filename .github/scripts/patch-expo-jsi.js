const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, search, replacement) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(search)) {
      content = content.replaceAll(search, replacement);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[Patch] Updated: ${filePath}`);
    } else {
      const searchCRLF = search.replace(/\r?\n/g, '\r\n');
      const searchLF = search.replace(/\r?\n/g, '\n');
      if (content.includes(searchCRLF)) {
        content = content.replaceAll(searchCRLF, replacement.replace(/\r?\n/g, '\r\n'));
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[Patch] Updated (CRLF): ${filePath}`);
      } else if (content.includes(searchLF)) {
        content = content.replaceAll(searchLF, replacement.replace(/\r?\n/g, '\n'));
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[Patch] Updated (LF): ${filePath}`);
      }
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

  static inline void appendPropNameId(PropNameIds &vector, facebook::jsi::IRuntime &runtime, const std::string &name) {
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

// 7. Force all Expo modules to build from source matching the runner's Swift toolchain
// Remove any prebuilt xcframework tarballs shipped with npm packages that were compiled with incompatible Swift 6.3 / Xcode 26
function removePrebuilds(dir) {
  if (fs.existsSync(dir)) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'prebuilds') {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`[Patch] Removed prebuilt tarballs: ${fullPath}`);
        } else {
          removePrebuilds(fullPath);
        }
      }
    }
  }
}
removePrebuilds('node_modules');

// 8. Patch ExpoModulesCore for Xcode 16.4 / Swift 6.1 compatibility
const expoModulesCorePodspec = path.join(
  'node_modules',
  'expo-modules-core',
  'ExpoModulesCore.podspec'
);
replaceInFile(
  expoModulesCorePodspec,
  'if (!Expo::PackagesConfig.instance.try_link_with_prebuilt_xcframework(s))',
  'if true'
);

replaceInFile(
  expoModulesCorePodspec,
  "  # Swift/Objective-C compatibility\n  s.pod_target_xcconfig = {",
  "  # Swift/Objective-C compatibility\n  s.swift_version = '5.0'\n  s.pod_target_xcconfig = {\n    'SWIFT_VERSION' => '5.0',\n    'SWIFT_STRICT_CONCURRENCY' => 'minimal',\n    'SWIFT_TREAT_WARNINGS_AS_ERRORS' => 'NO',\n    'GCC_TREAT_WARNINGS_AS_ERRORS' => 'NO',"
);
replaceInFile(
  expoModulesCorePodspec,
  "'OTHER_SWIFT_FLAGS' => \"$(inherited) #{new_arch_enabled ? new_arch_compiler_flags : ''}\",",
  "'OTHER_SWIFT_FLAGS' => \"$(inherited) #{new_arch_enabled ? new_arch_compiler_flags : ''} -strict-concurrency=minimal -suppress-warnings\","
);

// Fix invalid @MainActor attribute on protocol conformances and inheritance clauses
const viewDefinitionSwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'Core',
  'Views',
  'ViewDefinition.swift'
);
replaceInFile(
  viewDefinitionSwift,
  'extension UIView: @MainActor AnyArgument {',
  'extension UIView: AnyArgument {'
);

const swiftUIHostingViewSwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'Core',
  'Views',
  'SwiftUI',
  'SwiftUIHostingView.swift'
);
replaceInFile(
  swiftUIHostingViewSwift,
  'internal protocol AnyExpoSwiftUIHostingView {',
  '@MainActor\ninternal protocol AnyExpoSwiftUIHostingView {'
);
replaceInFile(
  swiftUIHostingViewSwift,
  ': ExpoView, @MainActor AnyExpoSwiftUIHostingView {',
  ': ExpoView, AnyExpoSwiftUIHostingView {'
);

const swiftUIVirtualViewSwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'Core',
  'Views',
  'SwiftUI',
  'SwiftUIVirtualView.swift'
);
replaceInFile(
  swiftUIVirtualViewSwift,
  ': SwiftUIVirtualViewObjC, @MainActor ExpoSwiftUIView {',
  ': SwiftUIVirtualViewObjC, ExpoSwiftUIView {'
);
replaceInFile(
  swiftUIVirtualViewSwift,
  'extension ExpoSwiftUI.SwiftUIVirtualView: @MainActor ExpoSwiftUI.ViewWrapper {',
  'extension ExpoSwiftUI.SwiftUIVirtualView: ExpoSwiftUI.ViewWrapper {'
);
replaceInFile(
  swiftUIVirtualViewSwift,
  ': SwiftUIVirtualViewObjCDev, @MainActor ExpoSwiftUIView {',
  ': SwiftUIVirtualViewObjCDev, ExpoSwiftUIView {'
);
replaceInFile(
  swiftUIVirtualViewSwift,
  'extension ExpoSwiftUI.SwiftUIVirtualViewDev: @MainActor ExpoSwiftUI.ViewWrapper {',
  'extension ExpoSwiftUI.SwiftUIVirtualViewDev: ExpoSwiftUI.ViewWrapper {'
);

const expoSwiftUISwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'Core',
  'Views',
  'SwiftUI',
  'ExpoSwiftUI.swift'
);
replaceInFile(
  expoSwiftUISwift,
  '  public protocol ViewWrapper {\n    func getWrappedView() -> Any\n  }',
  '  @MainActor\n  public protocol ViewWrapper {\n    func getWrappedView() -> Any\n  }'
);

const sceneGeometrySwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'Utilities',
  'SceneGeometry.swift'
);
replaceInFile(
  sceneGeometrySwift,
  'public enum SceneGeometry {',
  '@MainActor public enum SceneGeometry {'
);

const urlAuthForwardSenderSwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'DevTools',
  'URLAuthenticationChallengeForwardSender.swift'
);
replaceInFile(
  urlAuthForwardSenderSwift,
  'internal final class URLAuthenticationChallengeForwardSender: NSObject, URLAuthenticationChallengeSender {',
  'internal final class URLAuthenticationChallengeForwardSender: NSObject, URLAuthenticationChallengeSender, @unchecked Sendable {'
);

const urlSessionProxySwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'DevTools',
  'URLSessionSessionDelegateProxy.swift'
);
replaceInFile(
  urlSessionProxySwift,
  'public final class URLSessionSessionDelegateProxy: NSObject, URLSessionDataDelegate {',
  'public final class URLSessionSessionDelegateProxy: NSObject, URLSessionDataDelegate, @unchecked Sendable {'
);

const persistentFileLogSwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'Core',
  'Logging',
  'PersistentFileLog.swift'
);
replaceInFile(
  persistentFileLogSwift,
  'public typealias PersistentFileLogFilter = (String) -> Bool',
  'public typealias PersistentFileLogFilter = @Sendable (String) -> Bool'
);
replaceInFile(
  persistentFileLogSwift,
  'public typealias PersistentFileLogCompletionHandler = (Error?) -> Void',
  'public typealias PersistentFileLogCompletionHandler = @Sendable (Error?) -> Void'
);

const expoReactDelegateSwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'ReactDelegates',
  'ExpoReactDelegate.swift'
);
const oldRootVC = `  @objc
  public func createRootViewController() -> UIViewController {
    return self.handlers.lazy
      .compactMap { $0.createRootViewController() }
      .first(where: { _ in true }) ?? UIViewController()
  }`;
const newRootVC = `  @objc
  public func createRootViewController() -> UIViewController {
    return MainActor.assumeIsolated {
      return self.handlers.lazy
        .compactMap { $0.createRootViewController() }
        .first(where: { _ in true }) ?? UIViewController()
    }
  }`;
replaceInFile(expoReactDelegateSwift, oldRootVC, newRootVC);

const frameObserverSwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'Core',
  'Views',
  'SwiftUI',
  'SwiftUIViewFrameObserver.swift'
);
replaceInFile(
  frameObserverSwift,
  'callback(CGRect(origin: view.frame.origin, size: newValue.size))',
  'MainActor.assumeIsolated { callback(CGRect(origin: view.frame.origin, size: newValue.size)) }'
);

const dynamicSwiftUIViewTypeSwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'Core',
  'DynamicTypes',
  'DynamicSwiftUIViewType.swift'
);
const oldDynamicViewBody = `    return try performSynchronouslyOnMainThread {
      if let view = appContext.findView(withTag: viewTag, ofType: ExpoSwiftUI.SwiftUIVirtualView<ViewType.Props, ViewType>.self) {
        return view.contentView
      }
      if let view = appContext.findView(withTag: viewTag, ofType: ExpoSwiftUI.SwiftUIVirtualViewDev<ViewType.Props, ViewType>.self) {
        return view.contentView
      }
      // For wrapper types
      // e.g. ExpoUIView(SecureFieldView.self)
      if let provider = appContext.findView(withTag: viewTag, ofType: ExpoSwiftUI.ViewWrapper.self),
         let innerView = provider.getWrappedView() as? ViewType {
        return innerView
      }
      // For views using WithHostingView protocol.
      // e.g. View(HostView.self) where HostView conforms to WithHostingView
      guard let view = appContext.findView(withTag: viewTag, ofType: AnyExpoSwiftUIHostingView.self) else {
        throw Exceptions.SwiftUIViewNotFound((tag: viewTag, type: innerType.self))
      }
      return view.getContentView()
    }`;
const newDynamicViewBody = `    return try performSynchronouslyOnMainThread {
      return try MainActor.assumeIsolated {
        if let view = appContext.findView(withTag: viewTag, ofType: ExpoSwiftUI.SwiftUIVirtualView<ViewType.Props, ViewType>.self) {
          return view.contentView
        }
        if let view = appContext.findView(withTag: viewTag, ofType: ExpoSwiftUI.SwiftUIVirtualViewDev<ViewType.Props, ViewType>.self) {
          return view.contentView
        }
        // For wrapper types
        // e.g. ExpoUIView(SecureFieldView.self)
        if let provider = appContext.findView(withTag: viewTag, ofType: ExpoSwiftUI.ViewWrapper.self),
           let innerView = provider.getWrappedView() as? ViewType {
          return innerView
        }
        // For views using WithHostingView protocol.
        // e.g. View(HostView.self) where HostView conforms to WithHostingView
        guard let view = appContext.findView(withTag: viewTag, ofType: AnyExpoSwiftUIHostingView.self) else {
          throw Exceptions.SwiftUIViewNotFound((tag: viewTag, type: innerType.self))
        }
        return view.getContentView()
      }
    }`;
replaceInFile(dynamicSwiftUIViewTypeSwift, oldDynamicViewBody, newDynamicViewBody);

const swiftUIViewDefinitionSwift = path.join(
  'node_modules',
  'expo-modules-core',
  'ios',
  'Core',
  'Views',
  'SwiftUI',
  'SwiftUIViewDefinition.swift'
);
replaceInFile(
  swiftUIViewDefinitionSwift,
  'let content = hostingUIView.getContentView()',
  'let content = MainActor.assumeIsolated { hostingUIView.getContentView() }'
);

// 9. Patch ExpoNotifications for iOS 18.5 SDK compatibility
const dateComponentsSerializerSwift = path.join(
  'node_modules',
  'expo-notifications',
  'ios',
  'ExpoNotifications',
  'Notifications',
  'DateComponentsSerializer.swift'
);
const oldRepeatedDay = `    if #available(iOS 26.0, *) {
      serializedComponents["isRepeatedDay"] = dateComponents.isRepeatedDay ?? false
    }`;
replaceInFile(
  dateComponentsSerializerSwift,
  oldRepeatedDay,
  '    // iOS 26 isRepeatedDay omitted for iOS 18.5 SDK compatibility'
);

// 10. Patch expo-router Toolbar for iOS 18.5 SDK compatibility
const routerToolbarHostViewSwift = path.join(
  'node_modules',
  'expo-router',
  'ios',
  'Toolbar',
  'RouterToolbarHostView.swift'
);
const oldSharedBgHost = `            if #available(iOS 26.0, *) {
              if let hidesSharedBackground = menu.hidesSharedBackground {
                item.hidesSharedBackground = hidesSharedBackground
              }
              if let sharesBackground = menu.sharesBackground {
                item.sharesBackground = sharesBackground
              }
            }`;
replaceInFile(
  routerToolbarHostViewSwift,
  oldSharedBgHost,
  '            // iOS 26 hidesSharedBackground / sharesBackground omitted for iOS 18.5 SDK compatibility'
);

const routerToolbarItemViewSwift = path.join(
  'node_modules',
  'expo-router',
  'ios',
  'Toolbar',
  'RouterToolbarItemView.swift'
);
const oldSearchBarBlock = `    } else if type == .searchBar {
      guard #available(iOS 26.0, *), let controller = self.host?.findViewController() else {
        // Check for iOS 26, should already be guarded by the JS side, so this warning will only fire if controller is nil
        logger?.warn(
          "[expo-router] navigationItem.searchBarPlacementBarButtonItem not available. This is most likely a bug in expo-router."
        )
        currentBarButtonItem = nil
        return
      }
      guard let navController = controller.navigationController else {
        currentBarButtonItem = nil
        return
      }
      guard navController.isNavigationBarHidden == false else {
        logger?.warn(
          "[expo-router] Toolbar.SearchBarPreferredSlot should only be used when stack header is shown."
        )
        currentBarButtonItem = nil
        return
      }

      item = controller.navigationItem.searchBarPlacementBarButtonItem`;
const newSearchBarBlock = `    } else if type == .searchBar {
      logger?.warn("[expo-router] Toolbar.SearchBarPreferredSlot is not supported on iOS 18.5 SDK.")
      currentBarButtonItem = nil
      return`;
replaceInFile(routerToolbarItemViewSwift, oldSearchBarBlock, newSearchBarBlock);

const oldSharedBgItem = `    if #available(iOS 26.0, *) {
      item.hidesSharedBackground = hidesSharedBackground
      item.sharesBackground = sharesBackground
    }`;
replaceInFile(
  routerToolbarItemViewSwift,
  oldSharedBgItem,
  '    // iOS 26 hidesSharedBackground / sharesBackground omitted for iOS 18.5 SDK compatibility'
);

const oldBadgeBlock = `    if #available(iOS 26.0, *) {
      if let badgeConfig = badgeConfiguration {
        var badge = UIBarButtonItem.Badge.indicator()
        if let value = badgeConfig.value {
          badge = .string(value)
        }
        if let backgroundColor = badgeConfig.backgroundColor {
          badge.backgroundColor = backgroundColor
        }
        if let foregroundColor = badgeConfig.color {
          badge.foregroundColor = foregroundColor
        }
        if badgeConfig.fontFamily != nil || badgeConfig.fontSize != nil
          || badgeConfig.fontWeight != nil {
          let font = RouterFontUtils.convertTitleStyleToFont(
            TitleStyle(
              fontFamily: badgeConfig.fontFamily,
              fontSize: badgeConfig.fontSize,
              fontWeight: badgeConfig.fontWeight
            ))
          badge.font = font
        }
        item.badge = badge
      } else {
        item.badge = nil
      }
    }`;
replaceInFile(
  routerToolbarItemViewSwift,
  oldBadgeBlock,
  '    // iOS 26 badge logic omitted for iOS 18.5 SDK compatibility'
);

const routerToolbarModuleSwift = path.join(
  'node_modules',
  'expo-router',
  'ios',
  'Toolbar',
  'RouterToolbarModule.swift'
);
const oldProminentBlock = `    case .prominent:
      if #available(iOS 26.0, *) {
        return .prominent
      } else {
        return .done
      }`;
const newProminentBlock = `    case .prominent:
      return .done`;
replaceInFile(routerToolbarModuleSwift, oldProminentBlock, newProminentBlock);

// Walk all Swift files in expo-modules-core/ios to replace 'weak let' with 'weak var'
const expoCoreIosDir = path.join(
  'node_modules',
  'expo-modules-core',
  'ios'
);
if (fs.existsSync(expoCoreIosDir)) {
  function walkExpoCore(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walkExpoCore(fullPath);
      } else if (file.endsWith('.swift')) {
        replaceInFile(fullPath, 'weak let', 'weak var');
      }
    }
  }
  walkExpoCore(expoCoreIosDir);
}

console.log('[Patch] ExpoModulesJSI and native dependencies patch complete.');
