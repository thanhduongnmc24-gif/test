const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
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

  // 2. Chỉnh sửa Xcode Project (Chế độ chỉnh tay)
  config = withXcodeProject(config, async (config) => {
    const projectPath = config.modResults.filepath;
    const project = xcode.project(projectPath);

    project.parse(async function (err) {
      if (err) {
        console.error('Error parsing project:', err);
        return;
      }

      // --- KHỞI TẠO CÁC UUID (Tự tạo ID cho mọi thứ) ---
      const targetUuid = project.generateUuid();
      const groupUuid = project.generateUuid();
      const configurationListUuid = project.generateUuid();
      const productFileRefUuid = project.generateUuid(); 
      const sourcesBuildPhaseUuid = project.generateUuid();
      const resourcesBuildPhaseUuid = project.generateUuid();

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

      // --- 1. TẠO FILE REFERENCE CHO .APPEX (Sản phẩm đầu ra) ---
      const productFile = {
        isa: 'PBXFileReference',
        explicitFileType: '"wrapper.app-extension"',
        includeInIndex: 0,
        path: `"${WIDGET_TARGET_NAME}.appex"`,
        sourceTree: 'BUILT_PRODUCTS_DIR'
      };
      project.addToPbxFileReferenceSection(productFile, productFileRefUuid);
      
      const productsGroup = project.pbxGroupByName('Products');
      if (productsGroup) {
        project.addToPbxGroup(productFileRefUuid, 'Products');
      }

      // --- 2. THÊM FILE VÀO PROJECT ---
      // Add file (Cách này an toàn)
      const swiftFile = project.addFile(`${WIDGET_TARGET_NAME}/ShiftWidget.swift`, mainGroup, {});
      const plistFile = project.addFile(`${WIDGET_TARGET_NAME}/Info.plist`, mainGroup, {});

      // Tạo Group Widget
      const widgetGroup = project.addPbxGroup(
        [swiftFile.fileRef, plistFile.fileRef],
        WIDGET_TARGET_NAME,
        WIDGET_TARGET_NAME
      );
      const mainPbxGroup = project.getPBXGroupByKey(mainGroup);
      mainPbxGroup.children.push({ value: widgetGroup.uuid, comment: WIDGET_TARGET_NAME });

      // --- 3. TẠO BUILD PHASES (Thủ công) ---
      // Sources
      project.addBuildPhase(
        [swiftFile.path], 
        'PBXSourcesBuildPhase', 
        'Sources', 
        targetUuid, // Link tới Target UUID sắp tạo
        'app_extension', 
        sourcesBuildPhaseUuid
      );

      // Resources
      project.addBuildPhase(
        [], 
        'PBXResourcesBuildPhase', 
        'Resources', 
        targetUuid, 
        'app_extension',
        resourcesBuildPhaseUuid
      );

      // --- 4. TẠO CONFIGURATION LIST ---
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
        CODE_SIGN_IDENTITY: '""',
        DEVELOPMENT_TEAM: '""'
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

      // --- 5. TẠO NATIVE TARGET (GHI TRỰC TIẾP VÀO HASH) ---
      // Đây là bước sửa lỗi "undefined name"
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

      // Ghi thẳng vào bộ nhớ của project, không qua hàm trung gian
      project.hash.project.objects['PBXNativeTarget'] = project.hash.project.objects['PBXNativeTarget'] || {};
      project.hash.project.objects['PBXNativeTarget'][targetUuid] = nativeTarget;
      project.hash.project.objects['PBXNativeTarget'][targetUuid + '_comment'] = WIDGET_TARGET_NAME;

      // Thêm Target vào danh sách Target của Project
      const pbxProjectSection = project.hash.project.objects['PBXProject'];
      for (const key in pbxProjectSection) {
          if (!key.endsWith('_comment')) {
              const pbxProject = pbxProjectSection[key];
              pbxProject.targets.push({ value: targetUuid, comment: WIDGET_TARGET_NAME });
              break;
          }
      }

      // --- 6. ENTITLEMENTS ---
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
      project.addFile(`${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`, widgetGroup.uuid, {});
      
      // Ghi file
      fs.writeFileSync(projectPath, project.writeSync());
    });

    return config;
  });

  return config;
};

module.exports = withWidget;