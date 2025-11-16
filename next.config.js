const webpack = require('webpack')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for Electron packaging
  output: process.env.ELECTRON_BUILD === 'true' ? 'standalone' : undefined,

  webpack: (config) => {
    // Use IgnorePlugin to prevent webpack from trying to resolve optional dependencies
    // This allows them to be required at runtime if installed, without build errors
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@ai-sdk\/(google|mistral|anthropic)$/,
      })
    )
    return config
  },
}

module.exports = nextConfig


