import { watch } from 'vue'
import { storeKey } from './injectKey'
import { addDevtools } from './plugins/devtool'
import ModuleCollection from './module/module-collection'
import { assert } from './util'
import {
  genericSubscribe,
  getNestedState,
  installModule,
  resetStore,
  resetStoreState,
  unifyObjectStyle
} from './store-util'

export function createStore(options) {
  return new Store(options)
}

export class Store {
  constructor(options = {}) {
    if (__DEV__) {
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      assert(this instanceof Store, `store must be called with the new operator.`)
    }

    const {
      plugins = [],
      strict = false,
      devtools
    } = options

    // 存储内部状态
    this._committing = false
    this._actions = Object.create(null)
    this._actionSubscribers = []
    this._mutations = Object.create(null)
    this._wrappedGetters = Object.create(null)
    this._modules = new ModuleCollection(options)
    this._modulesNamespaceMap = Object.create(null)
    this._subscribers = []
    this._makeLocalGettersCache = Object.create(null)

    // EffectScope 实例。注册新的 getter 时，我们会将它们包装在
    // EffectScope，以便 getter（计算的）不会在
    // 组件卸载。
    this._scope = null

    this._devtools = devtools

    // 将 commit 和 dispatch 绑定到 self
    const store = this
    const { dispatch, commit } = this
    this.dispatch = function boundDispatch(type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit(type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    // 严格模式
    this.strict = strict

    const state = this._modules.root.state

    // init 根模块。
    // 这也递归地注册了所有子模块
    // 并收集 this._wrappedGetters 中的所有模块 getter
    // 注册模块
    installModule(this, state, [], this._modules.root)

    // 初始化 store state，它负责响应性
    // （还将 _wrappedGetters 注册为计算属性）
    // 重置状态
    resetStoreState(this, state)

    // apply plugins
    plugins.forEach(plugin => plugin(this))
  }
  // 注册
  install(app, injectKey) {
    app.provide(injectKey || storeKey, this)
    app.config.globalProperties.$store = this

    const useDevtools = this._devtools !== undefined
      ? this._devtools
      : __DEV__ || __VUE_PROD_DEVTOOLS__

    if (useDevtools) {
      addDevtools(app, this)
    }
  }
  // 获取state
  get state() {
    return this._state.data
  }
  // 修改state
  set state(v) {
    if (__DEV__) {
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }
  // 提交
  commit(_type, _payload, _options) {
    // 检查对象样式的提交
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    const entry = this._mutations[type]
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    this._withCommit(() => {
      entry.forEach(function commitIterator(handler) {
        handler(payload)
      })
    })

    this._subscribers
      .slice() // 浅层复制，以防止在订阅者同步调用 unsubscribe 时迭代器失效
      .forEach(sub => sub(mutation, this.state))

    if (
      __DEV__ &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }
  // 派出
  dispatch(_type, _payload) {
    // 检查对象样式的调度
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    const entry = this._actions[type]
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    try {
      this._actionSubscribers
        .slice() // 浅层复制，以防止在订阅者同步调用 unsubscribe 时迭代器失效
        .filter(sub => sub.before)
        .forEach(sub => sub.before(action, this.state))
    } catch (e) {
      if (__DEV__) {
        console.warn(`[vuex] error in before action subscribers: `)
        console.error(e)
      }
    }

    const result = entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)

    return new Promise((resolve, reject) => {
      result.then(res => {
        try {
          this._actionSubscribers
            .filter(sub => sub.after)
            .forEach(sub => sub.after(action, this.state))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in after action subscribers: `)
            console.error(e)
          }
        }
        resolve(res)
      }, error => {
        try {
          this._actionSubscribers
            .filter(sub => sub.error)
            .forEach(sub => sub.error(action, this.state, error))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in error action subscribers: `)
            console.error(e)
          }
        }
        reject(error)
      })
    })
  }
  // 订阅
  subscribe(fn, options) {
    return genericSubscribe(fn, this._subscribers, options)
  }
  // 订阅action
  subscribeAction(fn, options) {
    const subs = typeof fn === 'function' ? { before: fn } : fn
    return genericSubscribe(subs, this._actionSubscribers, options)
  }
  // 观察
  watch(getter, cb, options) {
    if (__DEV__) {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    return watch(() => getter(this.state, this.getters), cb, Object.assign({}, options))
  }
  // 替换状态
  replaceState(state) {
    this._withCommit(() => {
      this._state.data = state
    })
  }
  // 注册模块
  registerModule(path, rawModule, options = {}) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    this._modules.register(path, rawModule)
    installModule(this, this.state, path, this._modules.get(path), options.preserveState)
    // 重置 store 以更新 getter...
    resetStoreState(this, this.state)
  }
  // 卸载模块
  unregisterModule(path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    this._modules.unregister(path)
    this._withCommit(() => {
      const parentState = getNestedState(this.state, path.slice(0, -1))
      delete parentState[path[path.length - 1]]
    })
    resetStore(this)
  }
  // 判断模块是否存在
  hasModule(path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    return this._modules.isRegistered(path)
  }
  // 热更新
  hotUpdate(newOptions) {
    this._modules.update(newOptions)
    resetStore(this, true)
  }
  // 使用commit
  _withCommit(fn) {
    const committing = this._committing
    this._committing = true
    fn()
    this._committing = committing
  }
}
