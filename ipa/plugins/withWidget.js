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

      // --- 1. TẠO TARGET (Khung sườn) ---
      const target = project.addTarget(WIDGET_TARGET_NAME, 'app_extension', WIDGET_TARGET_NAME);

      // --- 2. THÊM FILE VÀO PROJECT (Nhưng chưa link) ---
      const mainGroupUuid = project.getFirstProject()['firstProject']['mainGroup'];
      
      // Add file bằng hàm thư viện cho an toàn phần file ref
      const swiftFile = project.addFile(`${WIDGET_TARGET_NAME}/ShiftWidget.swift`, mainGroupUuid, {});
      const plistFile = project.addFile(`${WIDGET_TARGET_NAME}/Info.plist`, mainGroupUuid, {});

      // Tạo Group riêng cho Widget
      const widgetGroup = project.addPbxGroup(
        [swiftFile.fileRef, plistFile.fileRef],
        WIDGET_TARGET_NAME,
        WIDGET_TARGET_NAME
      );
      // Link Group vào Main Group
      const mainGroup = project.getPBXGroupByKey(mainGroupUuid);
      mainGroup.children.push({ value: widgetGroup.uuid, comment: WIDGET_TARGET_NAME });

      // --- 3. XỬ LÝ BUILD PHASES (FIX LỖI CRASH TẠI ĐÂY) ---
      const nativeTarget = project.hash.project.objects['PBXNativeTarget'][target.uuid];
      
      // A. Tìm Sources Build Phase (Để compile Swift)
      let sourcesPhaseUuid = null;
      if (nativeTarget.buildPhases) {
          const found = nativeTarget.buildPhases.find(phase => {
              return project.hash.project.objects['PBXSourcesBuildPhase'] && 
                     project.hash.project.objects['PBXSourcesBuildPhase'][phase.value];
          });
          if (found) sourcesPhaseUuid = found.value;
      }

      // Nếu không tìm thấy (Lỗi của anh lúc nãy), thì TỰ TẠO MỚI
      if (!sourcesPhaseUuid) {
          sourcesPhaseUuid = project.generateUuid();
          const newSourcesPhase = {
              isa: 'PBXSourcesBuildPhase',
              buildActionMask: 2147483647,
              files: [],
              runOnlyForDeploymentPostprocessing: 0
          };
          project.hash.project.objects['PBXSourcesBuildPhase'] = project.hash.project.objects['PBXSourcesBuildPhase'] || {};
          project.hash.project.objects['PBXSourcesBuildPhase'][sourcesPhaseUuid] = newSourcesPhase;
          project.hash.project.objects['PBXSourcesBuildPhase'][sourcesPhaseUuid + '_comment'] = 'Sources';
          
          // Gắn vào Target
          nativeTarget.buildPhases = nativeTarget.buildPhases || [];
          nativeTarget.buildPhases.push({ value: sourcesPhaseUuid, comment: 'Sources' });
      }

      // B. Thêm file Swift vào Sources Phase
      const swiftBuildFileUuid = project.generateUuid();
      const swiftBuildFile = {
          isa: 'PBXBuildFile',
          fileRef: swiftFile.fileRef,
          settings: {}
      };
      project.hash.project.objects['PBXBuildFile'] = project.hash.project.objects['PBXBuildFile'] || {};
      project.hash.project.objects['PBXBuildFile'][swiftBuildFileUuid] = swiftBuildFile;
      project.hash.project.objects['PBXBuildFile'][swiftBuildFileUuid + '_comment'] = 'ShiftWidget.swift in Sources';

      // Push vào mảng files của phase
      project.hash.project.objects['PBXSourcesBuildPhase'][sourcesPhaseUuid].files.push({ 
          value: swiftBuildFileUuid, 
          comment: 'ShiftWidget.swift in Sources' 
      });

      // --- 4. TẠO ENTITLEMENTS ---
      const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>${APP_GROUP_IDENTIFIER}</string></array></dict></plist>`;
      fs.writeFileSync(path.join(widgetDestDir, `${WIDGET_TARGET_NAME}.entitlements`), entitlementsContent.trim());
      
      // Add entitlements file reference (không cần add vào build phase)
      project.addFile(`${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`);

      // --- 5. CẬP NHẬT BUILD SETTINGS ---
      const configurations = project.pbxXCBuildConfigurationSection();
      const widgetBundleId = `${config.ios.bundleIdentifier}.${WIDGET_TARGET_NAME}`;

      for (const key in configurations) {
        if (typeof configurations[key] === 'object') {
          const buildSettings = configurations[key].buildSettings;
          if (buildSettings['PRODUCT_NAME'] === `"${WIDGET_TARGET_NAME}"` || buildSettings['PRODUCT_NAME'] === WIDGET_TARGET_NAME) {
            
            buildSettings['INFOPLIST_FILE'] = `${WIDGET_TARGET_NAME}/Info.plist`;
            buildSettings['PRODUCT_BUNDLE_IDENTIFIER'] = widgetBundleId;
            buildSettings['SWIFT_VERSION'] = '5.0';
            buildSettings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0';
            buildSettings['TARGETED_DEVICE_FAMILY'] = '"1"'; 
            buildSettings['SKIP_INSTALL'] = 'YES';
            buildSettings['CODE_SIGN_ENTITLEMENTS'] = `${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`;
            buildSettings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon';
            buildSettings['CODE_SIGNING_ALLOWED'] = 'NO';
            buildSettings['CODE_SIGNING_REQUIRED'] = 'NO';
            buildSettings['CODE_SIGN_IDENTITY'] = '""';
            buildSettings['DEVELOPMENT_TEAM'] = '""';
          }
        }
      }

      // --- 6. EMBED WIDGET (Gắn kết) ---
      // Tìm file .appex (Product của Widget)
      const productFileRef = nativeTarget.productReference;
      
      if (productFileRef) {
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
              // 1. Tạo Build File cho Embed
              const appexBuildFile = {
                  isa: 'PBXBuildFile',
                  fileRef: productFileRef,
                  settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] }
              };
              project.hash.project.objects['PBXBuildFile'][productBuildFileUuid] = appexBuildFile;

              // 2. Tạo Proxy & Dependency
              const containerProxy = {
                  isa: 'PBXContainerItemProxy',
                  containerPortal: project.hash.project.rootObject,
                  proxyType: 1,
                  remoteGlobalIDString: target.uuid,
                  remoteInfo: WIDGET_TARGET_NAME
              };
              project.hash.project.objects['PBXContainerItemProxy'] = project.hash.project.objects['PBXContainerItemProxy'] || {};
              project.hash.project.objects['PBXContainerItemProxy'][containerProxyUuid] = containerProxy;

              const targetDependency = {
                  isa: 'PBXTargetDependency',
                  target: target.uuid,
                  targetProxy: containerProxyUuid
              };
              project.hash.project.objects['PBXTargetDependency'] = project.hash.project.objects['PBXTargetDependency'] || {};
              project.hash.project.objects['PBXTargetDependency'][targetDependencyUuid] = targetDependency;

              // 3. Tạo Embed Phase
              const copyFilesPhase = {
                  isa: 'PBXCopyFilesBuildPhase',
                  buildActionMask: 2147483647,
                  dstPath: '""',
                  dstSubfolderSpec: 13, // PlugIns
                  files: [{ value: productBuildFileUuid, comment: `${WIDGET_TARGET_NAME}.appex in Embed App Extensions` }],
                  name: '"Embed App Extensions"',
                  runOnlyForDeploymentPostprocessing: 0
              };
              project.hash.project.objects['PBXCopyFilesBuildPhase'] = project.hash.project.objects['PBXCopyFilesBuildPhase'] || {};
              project.hash.project.objects['PBXCopyFilesBuildPhase'][embedPhaseUuid] = copyFilesPhase;

              // 4. Gắn vào App Chính
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