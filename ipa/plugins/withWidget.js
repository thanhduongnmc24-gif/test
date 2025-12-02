const { withXcodeProject, withDangerousMod, withEntitlementsPlist } = require('@expo/config-plugins');
const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const WIDGET_TARGET_NAME = 'ShiftWidget';
const APP_GROUP_IDENTIFIER = 'group.com.ghichu.widgetdata';

const withWidget = (config) => {
  // 1. Thêm App Group Entitlement vào Main App
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.security.application-groups'] = [APP_GROUP_IDENTIFIER];
    return config;
  });

  // 2. Chỉnh sửa Xcode Project để thêm Target Widget
  config = withXcodeProject(config, async (config) => {
    const projectName = config.modRequest.projectName;
    const projectPath = config.modResults.filepath;
    const project = xcode.project(projectPath);

    project.parse(async function (err) {
      if (err) {
        console.error(`Error parsing Xcode project: ${JSON.stringify(err)}`);
        return;
      }

      const pbxProject = project.hash.project.objects;
      
      // Tạo các UUID cần thiết
      const targetUuid = project.generateUuid();
      const groupUuid = project.generateUuid();
      const sourcesBuildPhaseUuid = project.generateUuid();
      const resourcesBuildPhaseUuid = project.generateUuid();
      const frameworksBuildPhaseUuid = project.generateUuid();
      const configurationListUuid = project.generateUuid();
      // [FIX] Tạo UUID riêng cho file kết quả .appex
      const productFileRefUuid = project.generateUuid(); 

      const mainGroup = project.getFirstProject()['firstProject']['mainGroup'];

      // --- COPY FILE ---
      const widgetSourceDir = path.join(__dirname, '../widget');
      const iosDir = path.join(__dirname, '../ios');
      const widgetDestDir = path.join(iosDir, WIDGET_TARGET_NAME);

      if (!fs.existsSync(widgetDestDir)) {
        fs.mkdirSync(widgetDestDir, { recursive: true });
      }

      // Copy file Swift và Info.plist
      ['ShiftWidget.swift', 'Info.plist'].forEach((file) => {
        const src = path.join(widgetSourceDir, file);
        const dest = path.join(widgetDestDir, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
        } else {
            console.error(`⚠️ KHÔNG TÌM THẤY FILE: ${src}`);
        }
      });

      // --- [FIX QUAN TRỌNG] TẠO FILE REFERENCE CHO SẢN PHẨM .APPEX ---
      // Đây là bước thiếu gây ra lỗi "reading 'name' of undefined"
      const productFile = {
        isa: 'PBXFileReference',
        explicitFileType: '"wrapper.app-extension"',
        includeInIndex: 0,
        path: `"${WIDGET_TARGET_NAME}.appex"`,
        sourceTree: 'BUILT_PRODUCTS_DIR'
      };
      
      // Thêm file .appex vào danh sách file reference
      project.addToPbxFileReferenceSection(productFile, productFileRefUuid);

      // Thêm file .appex vào nhóm "Products" (để Xcode nhận diện)
      const productsGroup = project.pbxGroupByName('Products');
      if (productsGroup) {
        project.addToPbxGroup(productFileRefUuid, 'Products');
      }

      // --- ADD FILE TO PROJECT ---
      const swiftFile = project.addFile(`${WIDGET_TARGET_NAME}/ShiftWidget.swift`, mainGroup, {});
      const plistFile = project.addFile(`${WIDGET_TARGET_NAME}/Info.plist`, mainGroup, {});

      // Tạo Widget Group
      const widgetGroup = project.addPbxGroup(
        [swiftFile.fileRef, plistFile.fileRef],
        WIDGET_TARGET_NAME,
        WIDGET_TARGET_NAME
      );
      
      // Thêm group vào Main Group
      const mainPbxGroup = project.getPBXGroupByKey(mainGroup);
      mainPbxGroup.children.push({ value: widgetGroup.uuid, comment: WIDGET_TARGET_NAME });

      // --- CREATE TARGET ---
      const widgetTarget = {
        isa: 'PBXNativeTarget',
        buildConfigurationList: configurationListUuid,
        buildPhases: [
          { value: sourcesBuildPhaseUuid, comment: 'Sources' },
          { value: resourcesBuildPhaseUuid, comment: 'Resources' },
          { value: frameworksBuildPhaseUuid, comment: 'Frameworks' },
        ],
        buildRules: [],
        dependencies: [],
        name: WIDGET_TARGET_NAME,
        productName: WIDGET_TARGET_NAME,
        productReference: productFileRefUuid, // [FIX] Trỏ đúng vào UUID của file .appex vừa tạo
        productType: '"com.apple.product-type.app-extension"',
      };

      // Thêm Build Phases
      project.addBuildPhase([swiftFile.path], 'PBXSourcesBuildPhase', 'Sources', widgetTarget.uuid);
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', widgetTarget.uuid);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', widgetTarget.uuid);

      // Thêm Target vào Project
      project.addToPbxNativeTargetSection(widgetTarget);
      project.addToPbxProjectSection(widgetTarget);

      // --- CONFIGURATION LIST (Debug/Release) ---
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
        CODE_SIGNING_ALLOWED: 'NO', 
        CODE_SIGNING_REQUIRED: 'NO',
        CODE_SIGN_IDENTITY: '""'
      };

      const xcConfig = {
        isa: 'XCConfigurationList',
        buildConfigurations: [
          {
            name: 'Debug',
            isa: 'XCBuildConfiguration',
            buildSettings: { ...buildSettings, MTL_ENABLE_DEBUG_INFO: 'INCLUDE_SOURCE' },
          },
          {
            name: 'Release',
            isa: 'XCBuildConfiguration',
            buildSettings: { ...buildSettings, MTL_ENABLE_DEBUG_INFO: 'NO' },
          },
        ],
        defaultConfigurationIsVisible: 0,
        defaultConfigurationName: 'Release',
      };
      
      project.hash.project.objects['XCConfigurationList'] = project.hash.project.objects['XCConfigurationList'] || {};
      project.hash.project.objects['XCConfigurationList'][configurationListUuid] = xcConfig;

      // --- TẠO FILE ENTITLEMENTS ---
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
        </plist>
      `;
      fs.writeFileSync(path.join(widgetDestDir, `${WIDGET_TARGET_NAME}.entitlements`), entitlementsContent.trim());
      
      const entitlementsFile = project.addFile(`${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`, widgetGroup.uuid, {});
      
      // Ghi đè lại Project
      fs.writeFileSync(projectPath, project.writeSync());
    });

    return config;
  });

  return config;
};

module.exports = withWidget;