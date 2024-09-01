import { reactive, computed, watch, effectScope } from 'vue'
import { forEachValue, isObject, isPromise, assert, partial } from './util'

export function genericSubscribe(fn, subs, options) {
  if (subs.indexOf(fn) < 0) {
    options && options.prepend
      ? subs.unshift(fn)
      : subs.push(fn)
  }
  return () => {
    const i = subs.indexOf(fn)
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}

export function resetStore(store, hot) {
  store._actions = Object.create(null)
  store._mutations = Object.create(null)
  store._wrappedGetters = Object.create(null)
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // 初始化所有模块
  installModule(store, state, [], store._modules.root, true)
  // 重置状态
  resetStoreState(store, state, hot)
}

export function resetStoreState(store, state, hot) {
  const oldState = store._state
  const oldScope = store._scope

  // 绑定 store 公共 getter
  store.getters = {}
  // 重置本地 getter 缓存
  store._makeLocalGettersCache = Object.create(null)
  const wrappedGetters = store._wrappedGetters
  const computedObj = {}
  const computedCache = {}

  // 创建新的 effect 范围并在其中创建 Computed Object 以避免
  // getters（计算的）在组件卸载时被销毁。
  const scope = effectScope(true)

  scope.run(() => {
    forEachValue(wrappedGetters, (fn, key) => {
      // 使用 computed 来利用其延迟缓存机制
      // 直接内联函数的使用将导致闭包保留 oldState。
      // 使用 partial 返回在 Closure 环境中仅保留参数的函数。
      computedObj[key] = partial(fn, store)
      computedCache[key] = computed(() => computedObj[key]())
      Object.defineProperty(store.getters, key, {
        get: () => computedCache[key].value,
        enumerable: true // 对于本地 getter
      })
    })
  })

  store._state = reactive({
    data: state
  })

  // 将新创建的 effect 作用域注册到 store 中，以便我们可以
  // 在将来再次运行此方法时释放 effect。
  store._scope = scope

  // 为 New State 启用 Strict 模式
  if (store.strict) {
    enableStrictMode(store)
  }

  if (oldState) {
    if (hot) {
      // 在所有订阅的 watcher 中 dispatch 更改
      // 强制 getter 重新计算以进行热重载。
      store._withCommit(() => {
        oldState.data = null
      })
    }
  }

  // dispose previously registered effect scope（如果有）。
  if (oldScope) {
    oldScope.stop()
  }
}

export function installModule(store, rootState, path, module, hot) {
  const isRoot = !path.length
  const namespace = store._modules.getNamespace(path)

  // 在命名空间映射中注册
  if (module.namespaced) {
    if (store._modulesNamespaceMap[namespace] && __DEV__) {
      console.error(`[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`)
    }
    store._modulesNamespaceMap[namespace] = module
  }

  // 设置状态
  if (!isRoot && !hot) {
    const parentState = getNestedState(rootState, path.slice(0, -1))
    const moduleName = path[path.length - 1]
    store._withCommit(() => {
      if (__DEV__) {
        if (moduleName in parentState) {
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join('.')}"`
          )
        }
      }
      parentState[moduleName] = module.state
    })
  }

  const local = module.context = makeLocalContext(store, namespace, path)

  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key
    registerMutation(store, namespacedType, mutation, local)
  })

  module.forEachAction((action, key) => {
    const type = action.root ? key : namespace + key
    const handler = action.handler || action
    registerAction(store, type, handler, local)
  })

  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key
    registerGetter(store, namespacedType, getter, local)
  })

  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
  })
}

/**
 * 进行本地化的 dispatch、commit、getter 和 state
 * 如果没有命名空间，则只使用 root 的
 */
function makeLocalContext(store, namespace, path) {
  const noNamespace = namespace === ''

  const local = {
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) {
        type = namespace + type
        if (__DEV__ && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }

      return store.dispatch(type, payload)
    },

    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) {
        type = namespace + type
        if (__DEV__ && !store._mutations[type]) {
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }

      store.commit(type, payload, options)
    }
  }

  // getter 和 state 对象必须延迟获取
  // 因为它们将被 state update 更改
  Object.defineProperties(local, {
    getters: {
      get: noNamespace
        ? () => store.getters
        : () => makeLocalGetters(store, namespace)
    },
    state: {
      get: () => getNestedState(store.state, path)
    }
  })

  return local
}

export function makeLocalGetters(store, namespace) {
  if (!store._makeLocalGettersCache[namespace]) {
    const gettersProxy = {}
    const splitPos = namespace.length
    Object.keys(store.getters).forEach(type => {
      // 如果目标 getter 不匹配此命名空间，则跳过
      if (type.slice(0, splitPos) !== namespace) return

      // 提取本地 getter 类型
      const localType = type.slice(splitPos)

      // 向 getters 代理添加一个端口。
      // 定义为 getter 属性，因为
      // 我们不想在这个时候评估 getter。
      Object.defineProperty(gettersProxy, localType, {
        get: () => store.getters[type],
        enumerable: true
      })
    })
    store._makeLocalGettersCache[namespace] = gettersProxy
  }

  return store._makeLocalGettersCache[namespace]
}

function registerMutation(store, type, handler, local) {
  const entry = store._mutations[type] || (store._mutations[type] = [])
  entry.push(function wrappedMutationHandler(payload) {
    handler.call(store, local.state, payload)
  })
}

function registerAction(store, type, handler, local) {
  const entry = store._actions[type] || (store._actions[type] = [])
  entry.push(function wrappedActionHandler(payload) {
    let res = handler.call(store, {
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state
    }, payload)
    if (!isPromise(res)) {
      res = Promise.resolve(res)
    }
    if (store._devtoolHook) {
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      return res
    }
  })
}

function registerGetter(store, type, rawGetter, local) {
  if (store._wrappedGetters[type]) {
    if (__DEV__) {
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  store._wrappedGetters[type] = function wrappedGetter(store) {
    return rawGetter(
      local.state, // 本地状态
      local.getters, // 本地 getter
      store.state, // 根状态
      store.getters // 根 getter
    )
  }
}

function enableStrictMode(store) {
  watch(() => store._state.data, () => {
    if (__DEV__) {
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, flush: 'sync' })
}

export function getNestedState(state, path) {
  return path.reduce((state, key) => state[key], state)
}

export function unifyObjectStyle(type, payload, options) {
  if (isObject(type) && type.type) {
    options = payload
    payload = type
    type = type.type
  }

  if (__DEV__) {
    assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`)
  }

  return { type, payload, options }
}
