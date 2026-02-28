const Settings = require('../models/Settings');
const User = require('../models/User');

async function resolveAIKeysForUser(userId) {
  const settings = await Settings.getSettings();

  const globalKeys = [
    ...(settings.aiConfig?.googleApiKeys || [])
      .filter(k => k?.isActive && k?.key)
      .map(k => k.key.trim()),
    ...(settings.aiConfig?.googleApiKey ? [settings.aiConfig.googleApiKey.trim()] : [])
  ];

  let userKeys = [];
  if (userId) {
    const user = await User.findById(userId).select('aiApiKeys');
    userKeys = (user?.aiApiKeys || [])
      .filter(k => k?.isActive && k?.key)
      .map(k => k.key.trim());
  }

  const developerKey = process.env.GOOGLE_AI_API_KEY ? process.env.GOOGLE_AI_API_KEY.trim() : null;

  const combinedKeys = [...userKeys, ...globalKeys, ...(developerKey ? [developerKey] : [])]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);

  // Log key resolution for debugging
  const keyPreview = combinedKeys.map((k, i) => `[Key ${i + 1}] ...${k.slice(-10)}`).join(', ');
  console.log(`[KeyResolver] Resolved keys: user=${userKeys.length}, global=${globalKeys.length}, env=${developerKey ? 1 : 0}, total=${combinedKeys.length}`);
  if (combinedKeys.length > 0) {
    console.log(`[KeyResolver] Key preview: ${keyPreview}`);
  }

  return {
    keys: combinedKeys,
    aiEnabled: settings.aiConfig?.enabled !== false,
    hasUserKeys: userKeys.length > 0,
    hasGlobalKeys: globalKeys.length > 0,
    hasDeveloperKey: !!developerKey
  };
}

module.exports = {
  resolveAIKeysForUser
};
