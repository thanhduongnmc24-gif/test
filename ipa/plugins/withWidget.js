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

      // ============================================================
      // BƯỚC 1: VÁ LỖI THƯ VIỆN (Tạo nhóm Products nếu thiếu)
      // ============================================================
      // Đây là lý do khiến hàm addTarget bị crash ở các lần thử đầu tiên
      if (!project.pbxGroupByName('Products')) {
         const productsGroupUuid = project.generateUuid();
         project.hash.project.objects['PBXGroup'][productsGroupUuid] = {
             isa: 'PBXGroup',
             children: [],
             name: 'Products',
             sourceTree: '<group>'
         };
         // Link vào Main Group
         const mainGroupUuid = project.getFirstProject()['firstProject']['mainGroup'];
         project.getPBXGroupByKey(mainGroupUuid).children.push({ value: productsGroupUuid, comment: 'Products' });
      }

      // ============================================================
      // BƯỚC 2: TẠO TARGET BẰNG HÀM CHUẨN (An toàn cho CocoaPods)
      // ============================================================
      // Hàm này sẽ tự động tạo ConfigurationList đúng chuẩn
      const target = project.addTarget(WIDGET_TARGET_NAME, 'app_extension', WIDGET_TARGET_NAME);

      // ============================================================
      // BƯỚC 3: THÊM FILE VÀO PROJECT (Thủ công để tránh lỗi 13B07...)
      // ============================================================
      
      // Tạo File Reference cho Swift
      const swiftFileUuid = project.generateUuid();
      const swiftFileRef = {
        isa: 'PBXFileReference',
        path: `${WIDGET_TARGET_NAME}/ShiftWidget.swift`,
        sourceTree: '<group>',
        fileEncoding: 4,
        lastKnownFileType: 'sourcecode.swift',
        name: 'ShiftWidget.swift'
      };
      project.hash.project.objects['PBXFileReference'][swiftFileUuid] = swiftFileRef;
      
      // Tạo File Reference cho Info.plist
      const plistFileUuid = project.generateUuid();
      const plistFileRef = {
        isa: 'PBXFileReference',
        path: `${WIDGET_TARGET_NAME}/Info.plist`,
        sourceTree: '<group>',
        fileEncoding: 4,
        lastKnownFileType: 'text.plist.xml',
        name: 'Info.plist'
      };
      project.hash.project.objects['PBXFileReference'][plistFileUuid] = plistFileRef;

      // Tạo Group Widget và Link vào Main Group
      const mainGroupUuid = project.getFirstProject()['firstProject']['mainGroup'];
      const widgetGroupUuid = project.generateUuid();
      const widgetGroup = {
        isa: 'PBXGroup',
        children: [
            { value: swiftFileUuid, comment: 'ShiftWidget.swift' },
            { value: plistFileUuid, comment: 'Info.plist' }
        ],
        name: WIDGET_TARGET_NAME,
        sourceTree: '<group>'
      };
      project.hash.project.objects['PBXGroup'][widgetGroupUuid] = widgetGroup;
      project.getPBXGroupByKey(mainGroupUuid).children.push({ value: widgetGroupUuid, comment: WIDGET_TARGET_NAME });

      // ============================================================
      // BƯỚC 4: LIÊN KẾT FILE VÀO TARGET
      // ============================================================
      
      // Tìm Sources Build Phase của Target mới tạo
      const nativeTarget = project.hash.project.objects['PBXNativeTarget'][target.uuid];
      const sourcesPhase = nativeTarget.buildPhases.find(phase => {
          return project.hash.project.objects['PBXSourcesBuildPhase'] && 
                 project.hash.project.objects['PBXSourcesBuildPhase'][phase.value];
      });

      if (sourcesPhase) {
          // Tạo Build File cho Swift
          const swiftBuildFileUuid = project.generateUuid();
          const swiftBuildFile = {
              isa: 'PBXBuildFile',
              fileRef: swiftFileUuid,
          };
          project.hash.project.objects['PBXBuildFile'][swiftBuildFileUuid] = swiftBuildFile;
          
          // Add vào Sources Phase
          project.hash.project.objects['PBXSourcesBuildPhase'][sourcesPhase.value].files.push({ 
              value: swiftBuildFileUuid, 
              comment: 'ShiftWidget.swift in Sources' 
          });
      }

      // ============================================================
      // BƯỚC 5: TẠO ENTITLEMENTS (App Group)
      // ============================================================
      const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>${APP_GROUP_IDENTIFIER}</string></array></dict></plist>`;
      fs.writeFileSync(path.join(widgetDestDir, `${WIDGET_TARGET_NAME}.entitlements`), entitlementsContent.trim());
      
      // Add file ref
      const entitlementsFileUuid = project.generateUuid();
      const entitlementsFileRef = {
        isa: 'PBXFileReference',
        path: `${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`,
        sourceTree: '<group>',
        fileEncoding: 4,
        lastKnownFileType: 'text.plist.xml',
        name: `${WIDGET_TARGET_NAME}.entitlements`
      };
      project.hash.project.objects['PBXFileReference'][entitlementsFileUuid] = entitlementsFileRef;
      
      // Add vào Group Widget
      project.hash.project.objects['PBXGroup'][widgetGroupUuid].children.push({ value: entitlementsFileUuid, comment: 'Entitlements' });

      // ============================================================
      // BƯỚC 6: CẬP NHẬT BUILD SETTINGS
      // ============================================================
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

      // ============================================================
      // BƯỚC 7: EMBED WIDGET (Gắn vào App Chính)
      // ============================================================
      const productFileRef = nativeTarget.productReference;
      
      if (productFileRef) {
          const embedPhaseUuid = project.generateUuid();
          const productBuildFileUuid = project.generateUuid();
          const containerProxyUuid = project.generateUuid();
          const targetDependencyUuid = project.generateUuid();

          let mainAppTargetKey = null;
          const nativeTargets = project.hash.project.objects['PBXNativeTarget'];
          for (const key in nativeTargets) {
              if (key !== target.uuid && nativeTargets[key].productType === '"com.apple.product-type.application"') {
                  mainAppTargetKey = key;
                  break;
              }
          }

          if (mainAppTargetKey) {
              // Build File cho Embed
              const appexBuildFile = {
                  isa: 'PBXBuildFile',
                  fileRef: productFileRef,
                  settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] }
              };
              project.hash.project.objects['PBXBuildFile'] = project.hash.project.objects['PBXBuildFile'] || {};
              project.hash.project.objects['PBXBuildFile'][productBuildFileUuid] = appexBuildFile;

              // Proxy & Dependency
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
              project.hash.project.objects['PBXCopyFilesBuildPhase'] = project.hash.project.objects['PBXCopyFilesBuildPhase'] || {};
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