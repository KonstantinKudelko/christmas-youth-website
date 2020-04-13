const path = require('path')
const reshadowUtils = require('@reshadow/utils')
const findCacheDir = require('find-cache-dir')

module.exports = {
  experimental: {
    modern: true,
    polyfillsOptimization: true,
  },
  typescript: {
    ignoreDevErrors: true,
  },

  webpack(config, { dev, isServer }) {
    config.resolve.alias['~'] = require('path').resolve(__dirname, 'src')

    /* preact */
    const splitChunks = config.optimization && config.optimization.splitChunks
    if (splitChunks) {
      const cacheGroups = splitChunks.cacheGroups
      const preactModules = /[\\/]node_modules[\\/](preact|preact-render-to-string|preact-context-provider)[\\/]/
      if (cacheGroups.framework) {
        cacheGroups.preact = Object.assign({}, cacheGroups.framework, {
          test: preactModules,
        })
        cacheGroups.commons.name = 'framework'
      } else {
        cacheGroups.preact = {
          name: 'commons',
          chunks: 'all',
          test: preactModules,
        }
      }
    }

    // inject Preact DevTools
    if (dev && !isServer) {
      const entry = config.entry
      config.entry = () =>
        entry().then((entries) => {
          entries['main.js'] = ['preact/debug'].concat(entries['main.js'] || [])
          return entries
        })
    }

    /* reshadow */
    const cacheDirectory = findCacheDir({ name: 'reshadow' }) || os.tmpdir()
    let index = 0
    config.module.rules.push({
      enforce: 'post',
      test: /\.tsx?$/,
      loader: 'reshadow/webpack/loader',
      options: {
        getFilepath: (filepath) => {
          const hash = `${reshadowUtils.getFileHash(filepath)}_${++index}`
          const filename = `${hash}.module.css`

          return path.resolve(cacheDirectory, filename)
        },
      },
    })

    // fix `getLocalIdent` started from number
    config.module.rules
      .find((rule) => rule.oneOf)
      .oneOf.filter(({ sideEffects }) => sideEffects === false)
      .map(({ use }) => use.map((loader) => loader.options.modules))
      .flat()
      .filter(Boolean)
      .forEach((module) => {
        const getLocalIdentOriginal = module.getLocalIdent
        module.getLocalIdent = (...a) => `_${getLocalIdentOriginal(...a)}`
      })

    return config
  },
}
