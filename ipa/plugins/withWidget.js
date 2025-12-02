const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const WIDGET_TARGET_NAME = 'ShiftWidget';
const APP_GROUP_IDENTIFIER = 'group.com.ghichu.widgetdata';

const withWidget = (config) => {
  // 1. Thêm App Group vào App Chính
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

      // --- COPY FILES ---
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

      // --- [FIX] ĐẢM BẢO NHÓM 'Products' TỒN TẠI ---
      // Đây là bước quan trọng để hàm addTarget không bị crash
      if (!project.pbxGroupByName('Products')) {
         const productsGroupUuid = project.generateUuid();
         project.hash.project.objects['PBXGroup'][productsGroupUuid] = {
             isa: 'PBXGroup',
             children: [],
             name: 'Products',
             sourceTree: '<group>'
         };
         // Link vào Main Group
         const mainGroup = project.getFirstProject()['firstProject']['mainGroup'];
         project.getPBXGroupByKey(mainGroup).children.push({ value: productsGroupUuid, comment: 'Products' });
      }

      // --- 1. TẠO TARGET (Dùng hàm chuẩn để tránh lỗi cấu hình) ---
      const target = project.addTarget(WIDGET_TARGET_NAME, 'app_extension', WIDGET_TARGET_NAME);

      // --- 2. THÊM FILE VÀO TARGET ---
      // Thêm file Swift vào Build Phase của Target
      project.addSourceFile(
          `${WIDGET_TARGET_NAME}/ShiftWidget.swift`,
          { target: target.uuid },
          project.getFirstTarget().uuid // Main Group hint
      );
      
      // Thêm Info.plist (chỉ add reference)
      project.addFile(`${WIDGET_TARGET_NAME}/Info.plist`);

      // --- 3. ENTITLEMENTS ---
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
      project.addFile(`${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`);
      
      // --- 4. CẬP NHẬT BUILD SETTINGS ---
      const configurations = project.pbxXCBuildConfigurationSection();
      const widgetBundleId = `${config.ios.bundleIdentifier}.${WIDGET_TARGET_NAME}`;

      for (const key in configurations) {
        if (typeof configurations[key] === 'object') {
          const buildSettings = configurations[key].buildSettings;
          // Chỉ sửa cấu hình của Widget Target
          if (buildSettings['PRODUCT_NAME'] === `"${WIDGET_TARGET_NAME}"` || buildSettings['PRODUCT_NAME'] === WIDGET_TARGET_NAME) {
            
            buildSettings['INFOPLIST_FILE'] = `${WIDGET_TARGET_NAME}/Info.plist`;
            buildSettings['PRODUCT_BUNDLE_IDENTIFIER'] = widgetBundleId;
            buildSettings['SWIFT_VERSION'] = '5.0';
            buildSettings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0';
            buildSettings['TARGETED_DEVICE_FAMILY'] = '"1"'; 
            buildSettings['SKIP_INSTALL'] = 'YES';
            buildSettings['CODE_SIGN_ENTITLEMENTS'] = `${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`;
            buildSettings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon';
            // Tắt Signing
            buildSettings['CODE_SIGNING_ALLOWED'] = 'NO';
            buildSettings['CODE_SIGNING_REQUIRED'] = 'NO';
            buildSettings['CODE_SIGN_IDENTITY'] = '""';
            buildSettings['DEVELOPMENT_TEAM'] = '""';
          }
        }
      }

      // --- 5. EMBED WIDGET VÀO MAIN APP (Thủ công) ---
      // Tìm file .appex vừa được tạo bởi addTarget
      const productFile = project.pbxFileReferenceByPath(`${WIDGET_TARGET_NAME}.appex`);
      const productFileRefUuid = productFile ? productFile.fileRef : null;

      if (productFileRefUuid) {
          const embedPhaseUuid = project.generateUuid();
          const productBuildFileUuid = project.generateUuid();
          const containerProxyUuid = project.generateUuid();
          const targetDependencyUuid = project.generateUuid();

          // Tìm Main App Target
          let mainAppTargetKey = null;
          const nativeTargets = project.hash.project.objects['PBXNativeTarget'];
          for (const key in nativeTargets) {
              if (key !== target.uuid && nativeTargets[key].productType === '"com.apple.product-type.application"') {
                  mainAppTargetKey = key;
                  break;
              }
          }

          if (mainAppTargetKey) {
              // Build File
              const appexBuildFile = {
                  isa: 'PBXBuildFile',
                  fileRef: productFileRefUuid,
                  settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] }
              };
              project.hash.project.objects['PBXBuildFile'][productBuildFileUuid] = appexBuildFile;

              // Proxy & Dependency (Liên kết target)
              const containerProxy = {
                  isa: 'PBXContainerItemProxy',
                  containerPortal: project.hash.project.rootObject,
                  proxyType: 1,
                  remoteGlobalIDString: target.uuid,
                  remoteInfo: WIDGET_TARGET_NAME
              };
              project.hash.project.objects['PBXContainerItemProxy'][containerProxyUuid] = containerProxy;

              const targetDependency = {
                  isa: 'PBXTargetDependency',
                  target: target.uuid,
                  targetProxy: containerProxyUuid
              };
              project.hash.project.objects['PBXTargetDependency'][targetDependencyUuid] = targetDependency;

              // Copy Files Phase
              const copyFilesPhase = {
                  isa: 'PBXCopyFilesBuildPhase',
                  buildActionMask: 2147483647,
                  dstPath: '""',
                  dstSubfolderSpec: 13, // PlugIns
                  files: [{ value: productBuildFileUuid, comment: `${WIDGET_TARGET_NAME}.appex in Embed App Extensions` }],
                  name: '"Embed App Extensions"',
                  runOnlyForDeploymentPostprocessing: 0
              };
              project.hash.project.objects['PBXCopyFilesBuildPhase'][embedPhaseUuid] = copyFilesPhase;

              // Gắn vào Main App
              const mainAppTarget = nativeTargets[mainAppTargetKey];
              
              if (!mainAppTarget.dependencies) mainAppTarget.dependencies = [];
              mainAppTarget.dependencies.push({ value: targetDependencyUuid, comment: 'PBXTargetDependency' });

              if (!mainAppTarget.buildPhases) mainAppTarget.buildPhases = [];
              mainAppTarget.buildPhases.push({ value: embedPhaseUuid, comment: 'Embed App Extensions' });
              
              console.log('✅ EMBED SUCCESS');
          }
      }

      fs.writeFileSync(projectPath, project.writeSync());
    });

    return config;
  });

  return config;
};

module.exports = withWidget;