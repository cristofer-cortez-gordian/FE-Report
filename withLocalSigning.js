const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withLocalSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('keystore.properties')) {
      return config;
    }

    const snippet = `
        release {
            if (file("../../keystore.properties").exists()) {
                def props = new Properties()
                props.load(new FileInputStream(file("../../keystore.properties")))
                storeFile file("../../" + props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            } else if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

    // Reemplaza el bloque release original generado por expo
    config.modResults.contents = config.modResults.contents.replace(
      /release\s*\{\s*if\s*\(project\.hasProperty\('MYAPP_RELEASE_STORE_FILE'\)\)\s*\{[\s\S]*?\}\s*(?:else\s*\{[\s\S]*?\}\s*)?\}/,
      snippet
    );

    return config;
  });
};
