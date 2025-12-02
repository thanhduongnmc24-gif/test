const { withXcodeProject, withDangerousMod, withEntitlementsPlist } = require('@expo/config-plugins');
const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const WIDGET_TARGET_NAME = 'ShiftWidget';
// [QUAN TRỌNG] App Group ID này phải trùng với trong file Swift
const APP_GROUP_IDENTIFIER = 'group.com.ghichu.widgetdata';

const withWidget = (config) => {
  // 1. Thêm App Group vào App Chính
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.security.application-groups'] = [APP_GROUP_IDENTIFIER];
    return config;
  });

  // 2. Can thiệp vào file Project Xcode
  config = withXcodeProject(config, async (config) => {
    const projectName = config.modRequest.projectName;
    const projectPath = config.modResults.filepath;
    const project = xcode.project(projectPath);

    project.parse(async function (err) {
      if (err) return;

      const pbxProject = project.hash.project.objects;
      const targetUuid = project.generateUuid();
      const groupUuid = project.generateUuid();
      const sourcesBuildPhaseUuid = project.generateUuid();
      const resourcesBuildPhaseUuid = project.generateUuid();
      const configurationListUuid = project.generateUuid();
      const mainGroup = project.getFirstProject()['firstProject']['mainGroup'];

      // --- COPY FILE ---
      const widgetSourceDir = path.join(__dirname, '../widget');
      const iosDir = path.join(__dirname, '../ios');
      const widgetDestDir = path.join(iosDir, WIDGET_TARGET_NAME);

      if (!fs.existsSync(widgetDestDir)) fs.mkdirSync(widgetDestDir);

      ['ShiftWidget.swift', 'Info.plist'].forEach((file) => {
        fs.copyFileSync(path.join(widgetSourceDir, file), path.join(widgetDestDir, file));
      });

      // --- THÊM FILE VÀO PROJECT ---
      const swiftFile = project.addFile(`${WIDGET_TARGET_NAME}/ShiftWidget.swift`, mainGroup, {});
      const plistFile = project.addFile(`${WIDGET_TARGET_NAME}/Info.plist`, mainGroup, {});

      const widgetGroup = project.addPbxGroup([swiftFile.fileRef, plistFile.fileRef], WIDGET_TARGET_NAME, WIDGET_TARGET_NAME);
      const mainPbxGroup = project.getPBXGroupByKey(mainGroup);
      mainPbxGroup.children.push({ value: widgetGroup.uuid, comment: WIDGET_TARGET_NAME });

      // --- TẠO TARGET ---
      const widgetTarget = {
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
        productReference: targetUuid,
        productType: '"com.apple.product-type.app-extension"',
      };

      project.addBuildPhase([swiftFile.path], 'PBXSourcesBuildPhase', 'Sources', widgetTarget.uuid);
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', widgetTarget.uuid);
      
      project.addToPbxNativeTargetSection(widgetTarget);
      project.addToPbxProjectSection(widgetTarget);

      // --- BUILD SETTINGS ---
      // Tự động lấy Bundle ID của app chính + .ShiftWidget
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
        // Quan trọng cho việc compile trên Github Actions không có tài khoản dev
        CODE_SIGNING_ALLOWED: 'NO', 
        CODE_SIGNING_REQUIRED: 'NO',
        CODE_SIGN_IDENTITY: '""'
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
      
      project.hash.project.objects['XCConfigurationList'][configurationListUuid] = xcConfig;

      // --- TẠO ENTITLEMENTS CHO WIDGET (Để dùng App Group) ---
      const entitlementsContent = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${APP_GROUP_IDENTIFIER}</string>
    </array>
</dict>
</plist>`;
      fs.writeFileSync(path.join(widgetDestDir, `${WIDGET_TARGET_NAME}.entitlements`), entitlementsContent.trim());
      project.addFile(`${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`, widgetGroup.uuid, {});
      
      fs.writeFileSync(projectPath, project.writeSync());
    });
    return config;
  });
  return config;
};

module.exports = withWidget;