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

/**
 * 此函数将模块安装到 Vuex store 中，并提供可选的热模块替换支持。
 * @param store - 'store' 参数指的是模块所在的 Vuex store 实例
 * 安装。Vuex 是用于 Vue.js 应用程序的状态管理模式和库。商店持有
 * 应用程序的状态，并提供更新和访问状态的方法。
 * @param rootState - 'rootState' 参数通常指的是 Vuex 的根状态对象
 * 商店。此对象包含整个 store 的顶级 state 属性。它可供
 * 所有模块，都可用于访问或修改全局 state 属性。
 * @param path - 'installModule' 函数中的 'path' 参数表示
 * 模块应该安装在 Vuex 商店中。此路径用于指定
 * store 的 state 树，模块的 state、actions、mutations 和 getter 将在其中注册。
 * @param module - 'module' 参数是指你想要安装到 Vuex 中的模块
 * 商店。此模块可以包含自己的 state、mutations、actions 和 getter，允许您
 * 将你的 Vuex store 组织成更小的、可重用的模块。
 * @param hot - “hot”参数是一个标志，指示是否启用了热模块替换
 * 在应用程序中。热模块替换允许在不重新加载整个页面的情况下更新模块
 * 在开发过程中，使开发过程更快、更高效。
 */
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


/* 'makeLocalContext' 函数为 Vuex store 模块创建一个本地上下文对象，其中包含
指定的 namespace 和 path。这个本地上下文对象包含诸如 'dispatch' 和
'commit' 的 API 来执行操作和更改，从而允许 dispatch 操作和变更，并且
在模块的上下文中提交。*/
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

/**
 * 函数 'makeLocalGetters' 为 Vuex store 模块创建本地 getter，并指定
 * 命名空间。
 * @param store - 'store' 参数是指 Vue.js 应用程序中的 Vuex store 对象。Vuex 的
 * 是 Vue.js 应用程序的状态管理模式和库。它提供了一个集中的存储
 * 对于应用程序中的所有组件，从而更轻松地管理和访问状态。
 * @param 命名空间 - “namespace”参数是表示模块命名空间的字符串
 * 在你想要为其创建本地 getter 的 Vuex store 中。此命名空间用于访问
 * Store 中特定模块的状态和 getter。
 */
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

/* 'registerMutation' 函数正在向 Vuex store 注册一个 mutation 处理程序。需要四个
参数：
1. 'store'： Vuex 的 store 对象。
2. 'type'：更改的类型。
3. 'handler'：提交 mutation 时将调用的函数。
4. 'local'：一个包含变更所在模块的本地上下文信息的对象
注册。*/
function registerMutation(store, type, handler, local) {
  const entry = store._mutations[type] || (store._mutations[type] = [])
  entry.push(function wrappedMutationHandler(payload) {
    handler.call(store, local.state, payload)
  })
}

/* 'registerAction' 函数正在向 Vuex store 注册一个动作处理程序。需要四个
参数：
1. 'store'： Vuex 的 store 对象。
2. 'type'：操作的类型。
3. 'handler'：dispatch action 时将调用的函数。
4. 'local'：一个包含动作所在模块的本地上下文信息的对象
位于。*/
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

/* 'registerGetter' 函数正在将 getter 函数注册到 Vuex store 中。需要四个
参数：
1. 'store'： Vuex 的 store 对象。
2. 'type'：getter 的类型。
3. 'rawGetter'：访问 getter 时将调用的原始 getter 函数。
4. 'local'：一个对象，其中包含 getter 所在的模块的本地上下文信息
注册。*/
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

/* 'enableStrictMode（store）' 函数为 Vuex store 启用严格模式。在 Vuex 中，严格的
mode 是一个功能，有助于在 mutation 之外捕获 Vuex store state 的 mutation
处理器。*/
function enableStrictMode(store) {
  watch(() => store._state.data, () => {
    if (__DEV__) {
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, flush: 'sync' })
}

/**
 * 此函数根据给定路径检索嵌套状态值。
 * @param state - State 是应用程序的当前状态，通常是一个包含
 * 各种嵌套属性和值。它表示应用程序在
 * 给定的时间点。
 * @param path - 'path' 参数是一个字符串，表示状态的嵌套结构
 * 对象。它指定了访问 state 中特定嵌套值所需的键序列
 * 对象。例如，如果你有一个这样的 state 对象：
 */
export function getNestedState(state, path) {
  return path.reduce((state, key) => state[key], state)
}

/**
 * 此函数旨在通过应用指定的类型、有效负载和
 * 选项。
 * @param类型 - Type 是一个字符串，表示正在执行的操作的类型。可能是
 * 类似于 'ADD_ITEM'、'DELETE_ITEM'、'UPDATE_ITEM' 等。
 * @param payload - 有效负载是在函数中发送或接收的数据或信息。
 * 它可以是任何类型的数据，例如对象、数组、字符串、数字等。在
 * 'unifyObjectStyle' 函数，则 payload 参数可能包含需要
 * @param选项 - Options 是一个对象，其中包含
 * 功能。它可以包含各种属性，这些属性根据
 * 用户的要求。
 */
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
