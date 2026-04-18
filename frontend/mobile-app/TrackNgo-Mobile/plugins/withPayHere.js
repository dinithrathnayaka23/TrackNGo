const { withProjectBuildGradle, withAndroidManifest } = require("expo/config-plugins");

/** Add JitPack maven repo to the root build.gradle */
function withJitPack(config) {
  return withProjectBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;

    if (!contents.includes("jitpack.io")) {
      // Insert jitpack into allprojects → repositories
      cfg.modResults.contents = contents.replace(
        /allprojects\s*\{[\s\S]*?repositories\s*\{/,
        (match) => `${match}\n        maven { url 'https://jitpack.io' }`
      );
    }
    return cfg;
  });
}

/** Add tools:replace="android:allowBackup" to the <application> tag */
function withAllowBackupReplace(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application?.[0];
    if (app) {
      app.$["tools:replace"] = "android:allowBackup";

      // Ensure xmlns:tools is declared on the <manifest> tag
      if (!manifest.manifest.$["xmlns:tools"]) {
        manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
      }
    }
    return cfg;
  });
}

module.exports = function withPayHere(config) {
  config = withJitPack(config);
  config = withAllowBackupReplace(config);
  return config;
};
