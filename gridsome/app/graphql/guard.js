import fetch from '../fetch'
import config from '~/.temp/config'
import * as components from '~/.temp/routes'
import { NOT_FOUND_NAME } from '~/.temp/constants'
import { getResults, setResults, formatError } from './shared'

const resolved = []

export default router => (to, from, _next) => {
  if (process.isServer) return _next()

  const addRoute = route => {
    if (!resolved.includes(route.path) && !to.meta.dynamic) {
      router.addRoutes([route])
      router.options.routes.push(route)
      resolved.push(route.path)
    }
  }

  const addNotFoundRoute = path => addRoute({
    component: components['not-found'],
    meta: { dataPath: '/404/index.json' },
    path
  })

  const next = path => {
    if (to.matched.length) _next()
    else _next(path)
  }

  if (to.meta && to.meta.__custom) {
    global.__INITIAL_STATE__ = null
    return next()
  }

  if (process.isProduction && global.__INITIAL_STATE__) {
    const { meta, path, variableName } = global.__INITIAL_STATE__

    setResults(to.path, global.__INITIAL_STATE__)

    if (name === NOT_FOUND_NAME) addNotFoundRoute(to.path)
    else addRoute({ meta, path, component: components[variableName] })

    global.__INITIAL_STATE__ = null

    return next(to.path)
  }

  if (process.isProduction && getResults(to.path)) {
    return next()
  }

  fetch(to)
    .then(res => {
      if (res.code === 404) {
        setResults(to.path, { data: null, context: {} })
        addNotFoundRoute(to.path)
      } else {
        setResults(to.path, res)
        addRoute({
          path: res.path,
          meta: res.meta,
          component: components[res.variableName]
        })
      }

      next(to.path)
    })
    .catch(err => {
      if (err.code === 'MODULE_NOT_FOUND' || err.code === 404) {
        console.error(err)
        addNotFoundRoute(to.path)
        next(to.path)
      } else if (err.code === 'INVALID_HASH' && to.path !== window.location.pathname) {
        const fullPathWithPrefix = (config.pathPrefix ?? '') + to.fullPath
        window.location.assign(fullPathWithPrefix)
      } else {
        formatError(err, to)
        next(err)
      }
    })
}
