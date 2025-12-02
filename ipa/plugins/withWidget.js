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

  // 2. Chỉnh sửa Xcode Project (DIRECT INJECTION MODE)
  config = withXcodeProject(config, async (config) => {
    const projectPath = config.modResults.filepath;
    const project = xcode.project(projectPath);

    project.parse(async function (err) {
      if (err) {
        console.error('Error parsing project:', err);
        return;
      }

      // --- TẠO TOÀN BỘ UUID CẦN THIẾT ---
      const targetUuid = project.generateUuid();
      const groupUuid = project.generateUuid();
      const configurationListUuid = project.generateUuid();
      const productFileRefUuid = project.generateUuid(); 
      const sourcesBuildPhaseUuid = project.generateUuid();
      const resourcesBuildPhaseUuid = project.generateUuid();
      
      const swiftFileUuid = project.generateUuid();
      const swiftBuildFileUuid = project.generateUuid();
      
      const plistFileUuid = project.generateUuid();
      const entitlementsFileUuid = project.generateUuid();
      
      const debugConfigUuid = project.generateUuid();
      const releaseConfigUuid = project.generateUuid();

      // UUID cho Embed
      const embedPhaseUuid = project.generateUuid();
      const productBuildFileUuid = project.generateUuid();
      const containerProxyUuid = project.generateUuid();
      const targetDependencyUuid = project.generateUuid();

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

      // =================================================================
      // BẮT ĐẦU CAN THIỆP TRỰC TIẾP (KHÔNG DÙNG HÀM ADD...)
      // =================================================================

      // 1. TẠO FILE REFERENCE (SWIFT, PLIST, ENTITLEMENTS)
      const objects = project.hash.project.objects;

      // Swift File Ref
      objects['PBXFileReference'] = objects['PBXFileReference'] || {};
      objects['PBXFileReference'][swiftFileUuid] = {
          isa: 'PBXFileReference',
          path: 'ShiftWidget.swift',
          name: 'ShiftWidget.swift',
          sourceTree: '<group>',
          fileEncoding: 4,
          lastKnownFileType: 'sourcecode.swift',
          includeInIndex: 1
      };
      objects['PBXFileReference'][swiftFileUuid + '_comment'] = 'ShiftWidget.swift';

      // Info.plist Ref
      objects['PBXFileReference'][plistFileUuid] = {
          isa: 'PBXFileReference',
          path: 'Info.plist',
          name: 'Info.plist',
          sourceTree: '<group>',
          fileEncoding: 4,
          lastKnownFileType: 'text.plist.xml',
          includeInIndex: 1
      };
      objects['PBXFileReference'][plistFileUuid + '_comment'] = 'Info.plist';

      // Entitlements Ref
      objects['PBXFileReference'][entitlementsFileUuid] = {
          isa: 'PBXFileReference',
          path: `${WIDGET_TARGET_NAME}.entitlements`,
          name: `${WIDGET_TARGET_NAME}.entitlements`,
          sourceTree: '<group>',
          fileEncoding: 4,
          lastKnownFileType: 'text.plist.xml',
          includeInIndex: 1
      };
      objects['PBXFileReference'][entitlementsFileUuid + '_comment'] = `${WIDGET_TARGET_NAME}.entitlements`;

      // 2. TẠO GROUP WIDGET & LINK VÀO MAIN GROUP
      const widgetGroup = {
          isa: 'PBXGroup',
          children: [
              { value: swiftFileUuid, comment: 'ShiftWidget.swift' },
              { value: plistFileUuid, comment: 'Info.plist' },
              { value: entitlementsFileUuid, comment: `${WIDGET_TARGET_NAME}.entitlements` }
          ],
          name: WIDGET_TARGET_NAME,
          sourceTree: '<group>'
      };
      objects['PBXGroup'] = objects['PBXGroup'] || {};
      objects['PBXGroup'][groupUuid] = widgetGroup;
      objects['PBXGroup'][groupUuid + '_comment'] = WIDGET_TARGET_NAME;

      // Tìm Main Group và nhét Widget Group vào
      const mainGroupUuid = project.getFirstProject()['firstProject']['mainGroup'];
      if (objects['PBXGroup'][mainGroupUuid]) {
          objects['PBXGroup'][mainGroupUuid].children.push({ value: groupUuid, comment: WIDGET_TARGET_NAME });
      }

      // 3. TẠO FILE REFERENCE CHO SẢN PHẨM (.APPEX)
      const productFile = {
        isa: 'PBXFileReference',
        explicitFileType: '"wrapper.app-extension"',
        includeInIndex: 0,
        path: `"${WIDGET_TARGET_NAME}.appex"`,
        sourceTree: 'BUILT_PRODUCTS_DIR'
      };
      objects['PBXFileReference'][productFileRefUuid] = productFile;
      objects['PBXFileReference'][productFileRefUuid + '_comment'] = `${WIDGET_TARGET_NAME}.appex`;

      // Thêm vào nhóm Products (nếu tìm thấy)
      for (const key in objects['PBXGroup']) {
          if (objects['PBXGroup'][key].name === 'Products') {
              objects['PBXGroup'][key].children.push({ value: productFileRefUuid, comment: `${WIDGET_TARGET_NAME}.appex` });
              break;
          }
      }

      // 4. TẠO BUILD FILE (SWIFT)
      objects['PBXBuildFile'] = objects['PBXBuildFile'] || {};
      objects['PBXBuildFile'][swiftBuildFileUuid] = {
          isa: 'PBXBuildFile',
          fileRef: swiftFileUuid
      };
      objects['PBXBuildFile'][swiftBuildFileUuid + '_comment'] = 'ShiftWidget.swift in Sources';

      // 5. TẠO BUILD PHASES
      // Sources
      objects['PBXSourcesBuildPhase'] = objects['PBXSourcesBuildPhase'] || {};
      objects['PBXSourcesBuildPhase'][sourcesBuildPhaseUuid] = {
          isa: 'PBXSourcesBuildPhase',
          buildActionMask: 2147483647,
          files: [{ value: swiftBuildFileUuid, comment: 'ShiftWidget.swift in Sources' }],
          runOnlyForDeploymentPostprocessing: 0
      };
      objects['PBXSourcesBuildPhase'][sourcesBuildPhaseUuid + '_comment'] = 'Sources';

      // Resources
      objects['PBXResourcesBuildPhase'] = objects['PBXResourcesBuildPhase'] || {};
      objects['PBXResourcesBuildPhase'][resourcesBuildPhaseUuid] = {
          isa: 'PBXResourcesBuildPhase',
          buildActionMask: 2147483647,
          files: [],
          runOnlyForDeploymentPostprocessing: 0
      };
      objects['PBXResourcesBuildPhase'][resourcesBuildPhaseUuid + '_comment'] = 'Resources';

      // 6. BUILD SETTINGS & CONFIGURATION
      const widgetBundleId = `${config.ios.bundleIdentifier}.${WIDGET_TARGET_NAME}`;
      const commonSettings = {
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
        CODE_SIGNING_ALLOWED: 'NO', 
        CODE_SIGNING_REQUIRED: 'NO', 
        CODE_SIGN_IDENTITY: '""', 
        DEVELOPMENT_TEAM: '""'
      };

      objects['XCBuildConfiguration'] = objects['XCBuildConfiguration'] || {};
      objects['XCBuildConfiguration'][debugConfigUuid] = {
          isa: 'XCBuildConfiguration',
          buildSettings: { ...commonSettings, MTL_ENABLE_DEBUG_INFO: 'INCLUDE_SOURCE' },
          name: 'Debug'
      };
      objects['XCBuildConfiguration'][releaseConfigUuid] = {
          isa: 'XCBuildConfiguration',
          buildSettings: { ...commonSettings, MTL_ENABLE_DEBUG_INFO: 'NO' },
          name: 'Release'
      };

      objects['XCConfigurationList'] = objects['XCConfigurationList'] || {};
      objects['XCConfigurationList'][configurationListUuid] = {
          isa: 'XCConfigurationList',
          buildConfigurations: [
              { value: debugConfigUuid, comment: 'Debug' },
              { value: releaseConfigUuid, comment: 'Release' }
          ],
          defaultConfigurationIsVisible: 0,
          defaultConfigurationName: 'Release'
      };

      // 7. TẠO TARGET
      const nativeTarget = {
          isa: 'PBXNativeTarget',
          buildConfigurationList: configurationListUuid,
          buildPhases: [
              { value: sourcesBuildPhaseUuid, comment: 'Sources' },
              { value: resourcesBuildPhaseUuid, comment: 'Resources' }
          ],
          buildRules: [],
          dependencies: [],
          name: WIDGET_TARGET_NAME,
          productName: WIDGET_TARGET_NAME,
          productReference: productFileRefUuid,
          productType: '"com.apple.product-type.app-extension"'
      };
      objects['PBXNativeTarget'] = objects['PBXNativeTarget'] || {};
      objects['PBXNativeTarget'][targetUuid] = nativeTarget;
      objects['PBXNativeTarget'][targetUuid + '_comment'] = WIDGET_TARGET_NAME;

      // Link Target vào Project
      const pbxProjectSection = objects['PBXProject'];
      for (const key in pbxProjectSection) {
          if (!key.endsWith('_comment')) {
              pbxProjectSection[key].targets.push({ value: targetUuid, comment: WIDGET_TARGET_NAME });
              break;
          }
      }

      // --- 8. TẠO FILE ENTITLEMENTS (VẬT LÝ) ---
      const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>${APP_GROUP_IDENTIFIER}</string></array></dict></plist>`;
      fs.writeFileSync(path.join(widgetDestDir, `${WIDGET_TARGET_NAME}.entitlements`), entitlementsContent.trim());

      // --- 9. EMBED WIDGET (TỰ ĐỘNG) ---
      // Tìm Main App Target
      let mainAppTargetKey = null;
      for (const key in objects['PBXNativeTarget']) {
          if (key !== targetUuid && objects['PBXNativeTarget'][key].productType === '"com.apple.product-type.application"') {
              mainAppTargetKey = key;
              break;
          }
      }

      if (mainAppTargetKey) {
          // Build File cho .appex
          objects['PBXBuildFile'][productBuildFileUuid] = {
              isa: 'PBXBuildFile',
              fileRef: productFileRefUuid,
              settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] }
          };
          objects['PBXBuildFile'][productBuildFileUuid + '_comment'] = `${WIDGET_TARGET_NAME}.appex in Embed App Extensions`;

          // Container Proxy
          objects['PBXContainerItemProxy'] = objects['PBXContainerItemProxy'] || {};
          objects['PBXContainerItemProxy'][containerProxyUuid] = {
              isa: 'PBXContainerItemProxy',
              containerPortal: project.hash.project.rootObject,
              proxyType: 1,
              remoteGlobalIDString: targetUuid,
              remoteInfo: WIDGET_TARGET_NAME
          };

          // Target Dependency
          objects['PBXTargetDependency'] = objects['PBXTargetDependency'] || {};
          objects['PBXTargetDependency'][targetDependencyUuid] = {
              isa: 'PBXTargetDependency',
              target: targetUuid,
              targetProxy: containerProxyUuid
          };

          // Copy Files Build Phase
          objects['PBXCopyFilesBuildPhase'] = objects['PBXCopyFilesBuildPhase'] || {};
          objects['PBXCopyFilesBuildPhase'][embedPhaseUuid] = {
              isa: 'PBXCopyFilesBuildPhase',
              buildActionMask: 2147483647,
              dstPath: '""',
              dstSubfolderSpec: 13, // PlugIns
              files: [{ value: productBuildFileUuid, comment: `${WIDGET_TARGET_NAME}.appex in Embed App Extensions` }],
              name: '"Embed App Extensions"',
              runOnlyForDeploymentPostprocessing: 0
          };

          // Link vào Main App Target
          const mainAppTarget = objects['PBXNativeTarget'][mainAppTargetKey];
          if (!mainAppTarget.dependencies) mainAppTarget.dependencies = [];
          mainAppTarget.dependencies.push({ value: targetDependencyUuid, comment: 'PBXTargetDependency' });

          if (!mainAppTarget.buildPhases) mainAppTarget.buildPhases = [];
          mainAppTarget.buildPhases.push({ value: embedPhaseUuid, comment: 'Embed App Extensions' });
          
          console.log('✅ EMBED SUCCESS - DIRECT INJECTION');
      }

      fs.writeFileSync(projectPath, project.writeSync());
    });
    return config;
  });
  return config;
};

module.exports = withWidget;