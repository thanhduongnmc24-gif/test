const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function (config) {
  return withEntitlementsPlist(config, (config) => {
    // Tìm và xóa quyền Push Notification (aps-environment)
    delete config.modResults['aps-environment'];
    return config;
  });
};