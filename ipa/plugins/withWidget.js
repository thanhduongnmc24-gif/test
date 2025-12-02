const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const WIDGET_TARGET_NAME = 'ShiftWidget';
const APP_GROUP_IDENTIFIER = 'group.com.ghichu.widgetdata';

const withWidget = (config) => {
  // 1. Thêm App Group
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.security.application-groups'] = [APP_GROUP_IDENTIFIER];
    return config;
  });

  // 2. Chỉnh sửa Xcode Project
  config = withXcodeProject(config, async (config) => {
    const projectPath = config.modResults.filepath;
    const project = xcode.project(projectPath);

    project.parse(async function (err) {
      if (err) {
        console.error('Error parsing project:', err);
        return;
      }

      // --- GENERATE UUIDs ---
      const targetUuid = project.generateUuid();
      const groupUuid = project.generateUuid();
      const configurationListUuid = project.generateUuid();
      const productFileRefUuid = project.generateUuid(); 
      const sourcesBuildPhaseUuid = project.generateUuid();
      const resourcesBuildPhaseUuid = project.generateUuid();
      const swiftBuildFileUuid = project.generateUuid(); 
      
      const embedPhaseUuid = project.generateUuid();
      const productBuildFileUuid = project.generateUuid();
      const containerProxyUuid = project.generateUuid();
      const targetDependencyUuid = project.generateUuid();

      const mainGroup = project.getFirstProject()['firstProject']['mainGroup'];

      // --- COPY FILE ---
      const widgetSourceDir = path.join(__dirname, '../widget');
      const iosDir = path.join(__dirname, '../ios');
      const widgetDestDir = path.join(iosDir, WIDGET_TARGET_NAME);

      if (!fs.existsSync(widgetDestDir)) {
        fs.mkdirSync(widgetDestDir, { recursive: true });
      }

      ['ShiftWidget.swift', 'Info.plist'].forEach((file) => {
        const src = path.join(widgetSourceDir, file);
        const dest = path.join(widgetDestDir, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
        }
      });

      // --- 1. TẠO FILE REFERENCE ---
      const productFile = {
        isa: 'PBXFileReference',
        explicitFileType: '"wrapper.app-extension"',
        includeInIndex: 0,
        path: `"${WIDGET_TARGET_NAME}.appex"`,
        sourceTree: 'BUILT_PRODUCTS_DIR'
      };
      project.hash.project.objects['PBXFileReference'] = project.hash.project.objects['PBXFileReference'] || {};
      project.hash.project.objects['PBXFileReference'][productFileRefUuid] = productFile;
      project.hash.project.objects['PBXFileReference'][productFileRefUuid + '_comment'] = WIDGET_TARGET_NAME + '.appex';
      
      const pbxGroupSection = project.hash.project.objects['PBXGroup'];
      for (const key in pbxGroupSection) {
          if (pbxGroupSection[key].name === 'Products') {
              pbxGroupSection[key].children.push({ value: productFileRefUuid, comment: WIDGET_TARGET_NAME + '.appex' });
              break;
          }
      }

      // --- 2. ADD FILE VÀO PROJECT ---
      const swiftFile = project.addFile(`${WIDGET_TARGET_NAME}/ShiftWidget.swift`, mainGroup, {});
      const plistFile = project.addFile(`${WIDGET_TARGET_NAME}/Info.plist`, mainGroup, {});

      const widgetGroup = project.addPbxGroup([swiftFile.fileRef, plistFile.fileRef], WIDGET_TARGET_NAME, WIDGET_TARGET_NAME);
      const mainPbxGroup = project.getPBXGroupByKey(mainGroup);
      mainPbxGroup.children.push({ value: widgetGroup.uuid, comment: WIDGET_TARGET_NAME });

      // --- 3. TẠO BUILD FILE ---
      const swiftBuildFile = { isa: 'PBXBuildFile', fileRef: swiftFile.fileRef, settings: {} };
      project.hash.project.objects['PBXBuildFile'] = project.hash.project.objects['PBXBuildFile'] || {};
      project.hash.project.objects['PBXBuildFile'][swiftBuildFileUuid] = swiftBuildFile;
      project.hash.project.objects['PBXBuildFile'][swiftBuildFileUuid + '_comment'] = 'ShiftWidget.swift in Sources';

      // --- 4. TẠO BUILD PHASES ---
      const sourcesPhase = {
        isa: 'PBXSourcesBuildPhase',
        buildActionMask: 2147483647,
        files: [ { value: swiftBuildFileUuid, comment: 'ShiftWidget.swift in Sources' } ],
        runOnlyForDeploymentPostprocessing: 0
      };
      project.hash.project.objects['PBXSourcesBuildPhase'] = project.hash.project.objects['PBXSourcesBuildPhase'] || {};
      project.hash.project.objects['PBXSourcesBuildPhase'][sourcesBuildPhaseUuid] = sourcesPhase;
      
      const resourcesPhase = {
        isa: 'PBXResourcesBuildPhase',
        buildActionMask: 2147483647,
        files: [],
        runOnlyForDeploymentPostprocessing: 0
      };
      project.hash.project.objects['PBXResourcesBuildPhase'] = project.hash.project.objects['PBXResourcesBuildPhase'] || {};
      project.hash.project.objects['PBXResourcesBuildPhase'][resourcesBuildPhaseUuid] = resourcesPhase;

      // --- 5. CONFIGURATION LIST ---
      const widgetBundleId = `${config.ios.bundleIdentifier}.${WIDGET_TARGET_NAME}`;
      const buildSettings = {
        INFOPLIST_FILE: `${WIDGET_TARGET_NAME}/Info.plist`,
        PRODUCT_BUNDLE_IDENTIFIER: widgetBundleId,
        SWIFT_VERSION: '5.0',
        IPHONEOS_DEPLOYMENT_TARGET: '17.0',
        TARGETED_DEVICE_FAMILY: '"1"',
        ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
        SKIP_INSTALL: 'YES',
        CODE_SIGN_ENTITLEMENTS: `${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`,
        MARKETING_VERSION: '1.0',
        CURRENT_PROJECT_VERSION: '1',
        CODE_SIGNING_ALLOWED: 'NO', CODE_SIGNING_REQUIRED: 'NO', CODE_SIGN_IDENTITY: '""', DEVELOPMENT_TEAM: '""'
      };

      const xcConfig = {
        isa: 'XCConfigurationList',
        buildConfigurations: [
          { name: 'Debug', isa: 'XCBuildConfiguration', buildSettings: { ...buildSettings, MTL_ENABLE_DEBUG_INFO: 'INCLUDE_SOURCE' } },
          { name: 'Release', isa: 'XCBuildConfiguration', buildSettings: { ...buildSettings, MTL_ENABLE_DEBUG_INFO: 'NO' } },
        ],
        defaultConfigurationIsVisible: 0,
        defaultConfigurationName: 'Release',
      };
      project.hash.project.objects['XCConfigurationList'] = project.hash.project.objects['XCConfigurationList'] || {};
      project.hash.project.objects['XCConfigurationList'][configurationListUuid] = xcConfig;

      // --- 6. NATIVE TARGET (WIDGET) ---
      const nativeTarget = {
        isa: 'PBXNativeTarget',
        buildConfigurationList: configurationListUuid,
        buildPhases: [
          { value: sourcesBuildPhaseUuid, comment: 'Sources' },
          { value: resourcesBuildPhaseUuid, comment: 'Resources' },
        ],
        buildRules: [],
        dependencies: [],
        name: WIDGET_TARGET_NAME,
        productName: WIDGET_TARGET_NAME,
        productReference: productFileRefUuid,
        productType: '"com.apple.product-type.app-extension"',
      };
      project.hash.project.objects['PBXNativeTarget'] = project.hash.project.objects['PBXNativeTarget'] || {};
      project.hash.project.objects['PBXNativeTarget'][targetUuid] = nativeTarget;
      project.hash.project.objects['PBXNativeTarget'][targetUuid + '_comment'] = WIDGET_TARGET_NAME;

      const pbxProjectSection = project.hash.project.objects['PBXProject'];
      for (const key in pbxProjectSection) {
          if (!key.endsWith('_comment')) {
              pbxProjectSection[key].targets.push({ value: targetUuid, comment: WIDGET_TARGET_NAME });
              break; 
          }
      }

      // --- 7. EMBED WIDGET VÀO MAIN APP (ĐÃ FIX LỖI UNDEFINED) ---
      let mainAppTargetKey = null;
      const nativeTargets = project.hash.project.objects['PBXNativeTarget'];
      for (const key in nativeTargets) {
          if (key !== targetUuid && nativeTargets[key].productType === '"com.apple.product-type.application"') {
              mainAppTargetKey = key;
              break;
          }
      }

      if (mainAppTargetKey) {
          // Tạo Build File cho .appex
          const appexBuildFile = {
              isa: 'PBXBuildFile',
              fileRef: productFileRefUuid,
              settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] }
          };
          // [FIX] Khởi tạo object nếu chưa có
          project.hash.project.objects['PBXBuildFile'] = project.hash.project.objects['PBXBuildFile'] || {};
          project.hash.project.objects['PBXBuildFile'][productBuildFileUuid] = appexBuildFile;
          project.hash.project.objects['PBXBuildFile'][productBuildFileUuid + '_comment'] = `${WIDGET_TARGET_NAME}.appex in Embed App Extensions`;

          // Tạo Proxy
          const containerProxy = {
              isa: 'PBXContainerItemProxy',
              containerPortal: project.hash.project.rootObject,
              proxyType: 1,
              remoteGlobalIDString: targetUuid,
              remoteInfo: WIDGET_TARGET_NAME
          };
          // [FIX] Khởi tạo object nếu chưa có
          project.hash.project.objects['PBXContainerItemProxy'] = project.hash.project.objects['PBXContainerItemProxy'] || {};
          project.hash.project.objects['PBXContainerItemProxy'][containerProxyUuid] = containerProxy;

          // Tạo Dependency
          const targetDependency = {
              isa: 'PBXTargetDependency',
              target: targetUuid,
              targetProxy: containerProxyUuid
          };
          // [FIX] Khởi tạo object nếu chưa có
          project.hash.project.objects['PBXTargetDependency'] = project.hash.project.objects['PBXTargetDependency'] || {};
          project.hash.project.objects['PBXTargetDependency'][targetDependencyUuid] = targetDependency;

          // Tạo Copy Files Phase
          const copyFilesPhase = {
              isa: 'PBXCopyFilesBuildPhase',
              buildActionMask: 2147483647,
              dstPath: '""',
              dstSubfolderSpec: 13, // PlugIns
              files: [{ value: productBuildFileUuid, comment: `${WIDGET_TARGET_NAME}.appex in Embed App Extensions` }],
              name: '"Embed App Extensions"',
              runOnlyForDeploymentPostprocessing: 0
          };
          // [FIX] Khởi tạo object nếu chưa có
          project.hash.project.objects['PBXCopyFilesBuildPhase'] = project.hash.project.objects['PBXCopyFilesBuildPhase'] || {};
          project.hash.project.objects['PBXCopyFilesBuildPhase'][embedPhaseUuid] = copyFilesPhase;

          // Gắn vào Main App
          const mainAppTarget = nativeTargets[mainAppTargetKey];
          if (!mainAppTarget.dependencies) mainAppTarget.dependencies = [];
          mainAppTarget.dependencies.push({ value: targetDependencyUuid, comment: 'PBXTargetDependency' });

          if (!mainAppTarget.buildPhases) mainAppTarget.buildPhases = [];
          mainAppTarget.buildPhases.push({ value: embedPhaseUuid, comment: 'Embed App Extensions' });
          
          console.log(`✅ Đã gắn Widget vào App Chính (Target ID: ${mainAppTargetKey})`);
      }

      // --- 8. ENTITLEMENTS ---
      const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>${APP_GROUP_IDENTIFIER}</string></array></dict></plist>`;
      fs.writeFileSync(path.join(widgetDestDir, `${WIDGET_TARGET_NAME}.entitlements`), entitlementsContent.trim());
      project.addFile(`${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`, widgetGroup.uuid, {});
      
      fs.writeFileSync(projectPath, project.writeSync());
    });
    return config;
  });
  return config;
};

module.exports = withWidget;