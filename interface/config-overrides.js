const CompressionPlugin = require("compression-webpack-plugin");

module.exports = function override(config, env) {
  const deviceBuild = process.env.SMARTPOD_BUILD_TARGET !== "demo";
  if (env === "production" && deviceBuild) {
    // Keep asset paths short for SPIFFS.
    config.output.filename = 'js/[id].[chunkhash:4].js';
    config.output.chunkFilename = 'js/[id].[chunkhash:4].js';

    // These generated files are not used by the on-device application. Match
    // by constructor name so this override does not import CRA's transitive
    // build dependencies directly.
    config.plugins = config.plugins.filter(plugin =>
      !['WebpackManifestPlugin', 'GenerateSW'].includes(plugin.constructor.name)
    );

    const miniCssExtractPlugin = config.plugins.find(
      plugin => plugin.constructor.name === 'MiniCssExtractPlugin'
    );
    miniCssExtractPlugin.options.filename = "css/[id].[contenthash:4].css";
    miniCssExtractPlugin.options.chunkFilename = "css/[id].[contenthash:4].c.css";

    // ESPAsyncWebServer serves the pre-compressed JavaScript assets.
    config.plugins.push(new CompressionPlugin({
      filename: "[path][base].gz",
      algorithm: "gzip",
      test: /\.(js)$/,
      deleteOriginalAssets: true
    }));
  }
  return config;
}
