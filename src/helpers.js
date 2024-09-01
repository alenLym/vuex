import { isObject } from './util'

/**
 * 减少用 Vue.js 编写的代码以获取状态。
 * @param {String} [namespace] - 模块的命名空间
 * @param {Object|数组} 状态 # 对象的 item 可以是一个函数，它接受 param 的 state 和 getter，你可以在其中为 state 和 getter 做一些事情。
 * @param {Object}
 */
export const mapState = normalizeNamespace((namespace, states) => {
  const res = {}
  if (__DEV__ && !isValidMap(states)) {
    console.error('[vuex] mapState: mapper parameter must be either an Array or an Object')
  }
  normalizeMap(states).forEach(({ key, val }) => {
    res[key] = function mappedState () {
      let state = this.$store.state
      let getters = this.$store.getters
      if (namespace) {
        const module = getModuleByNamespace(this.$store, 'mapState', namespace)
        if (!module) {
          return
        }
        state = module.context.state
        getters = module.context.getters
      }
      return typeof val === 'function'
        ? val.call(this, state, getters)
        : state[val]
    }
    // 标记 Vuex Getter for DevTools
    res[key].vuex = true
  })
  return res
})

/**
 * 减少用 Vue.js 编写的代码以提交 mutation
 * @param {String} [namespace] - 模块的命名空间
 * @param {Object|Array} mutations # 对象的 item 可以是一个接受 'commit' 函数作为第一个参数的函数，它可以接受另一个参数。你可以提交 mutation 并在这个函数中做任何其他事情。特别是，你需要从 map 函数中传递 anthor params。
 * @return {Object}
 */
export const mapMutations = normalizeNamespace((namespace, mutations) => {
  const res = {}
  if (__DEV__ && !isValidMap(mutations)) {
    console.error('[vuex] mapMutations: mapper parameter must be either an Array or an Object')
  }
  normalizeMap(mutations).forEach(({ key, val }) => {
    res[key] = function mappedMutation (...args) {
      // Get the commit method from store
      let commit = this.$store.commit
      if (namespace) {
        const module = getModuleByNamespace(this.$store, 'mapMutations', namespace)
        if (!module) {
          return
        }
        commit = module.context.commit
      }
      return typeof val === 'function'
        ? val.apply(this, [commit].concat(args))
        : commit.apply(this.$store, [val].concat(args))
    }
  })
  return res
})

/**
 * 减少用 Vue.js 编写的代码以获取 getter
 * @param {String} [namespace] - 模块的命名空间
 * @param {Object|Array} getter
 * @return {Object}
 */
export const mapGetters = normalizeNamespace((namespace, getters) => {
  const res = {}
  if (__DEV__ && !isValidMap(getters)) {
    console.error('[vuex] mapGetters: mapper parameter must be either an Array or an Object')
  }
  normalizeMap(getters).forEach(({ key, val }) => {
    // 命名空间已被 normalizeNamespace 更改
    val = namespace + val
    res[key] = function mappedGetter () {
      if (namespace && !getModuleByNamespace(this.$store, 'mapGetters', namespace)) {
        return
      }
      if (__DEV__ && !(val in this.$store.getters)) {
        console.error(`[vuex] unknown getter: ${val}`)
        return
      }
      return this.$store.getters[val]
    }
    // 标记 Vuex Getter for DevTools
    res[key].vuex = true
  })
  return res
})

/**
 * Reduce 用 Vue.js 编写的代码，用于 dispatch action
 * @param {String} [namespace] - 模块的命名空间
 * @param {Object|Array} actions # 对象的 item 可以是一个接受 'dispatch' 函数作为第一个参数的函数，它可以接受其他参数。你可以在这个函数中 dispatch action 和做任何其他事情。特别是，你需要从 map 函数中传递 anthor params。
 * @return {Object}
 */
export const mapActions = normalizeNamespace((namespace, actions) => {
  const res = {}
  if (__DEV__ && !isValidMap(actions)) {
    console.error('[vuex] mapActions: mapper parameter must be either an Array or an Object')
  }
  normalizeMap(actions).forEach(({ key, val }) => {
    res[key] = function mappedAction (...args) {
      // 从 store 获取 dispatch 函数
      let dispatch = this.$store.dispatch
      if (namespace) {
        const module = getModuleByNamespace(this.$store, 'mapActions', namespace)
        if (!module) {
          return
        }
        dispatch = module.context.dispatch
      }
      return typeof val === 'function'
        ? val.apply(this, [dispatch].concat(args))
        : dispatch.apply(this.$store, [val].concat(args))
    }
  })
  return res
})

/**
 * 在特殊作用域中重新绑定 mapXXX 函数的 namespace param，并通过 simple object 返回
 * @param {String} 命名空间
 * @return {Object}
 */
export const createNamespacedHelpers = (namespace) => ({
  mapState: mapState.bind(null, namespace),
  mapGetters: mapGetters.bind(null, namespace),
  mapMutations: mapMutations.bind(null, namespace),
  mapActions: mapActions.bind(null, namespace)
})

/**
 * 规格化地图
 * normalizeMap（[1， 2， 3]） => [ { key： 1， val： 1 }， { key： 2， val： 2 }， { key： 3， val： 3 } ]
 * normalizeMap（{a： 1， b： 2， c： 3}） => [ { key： 'a'， val： 1 }， { key： 'b'， val： 2 }， { key： 'c'， val： 3 } ]
 * @param {array|Object} 映射
 * @return {Object}
 */
function normalizeMap (map) {
  if (!isValidMap(map)) {
    return []
  }
  return Array.isArray(map)
    ? map.map(key => ({ key, val: key }))
    : Object.keys(map).map(key => ({ key, val: map[key] }))
}

/**
 * 验证给定的 map 是否有效
 * @param {*} 地图
 * @return {布尔}
 */
function isValidMap (map) {
  return Array.isArray(map) || isObject(map)
}

/**
 * 返回一个函数 expect two param contains namespace 和 map。它将规范化命名空间，然后 Param 的函数将处理新的命名空间和 Map。
 * @param {Function} fn
 * @return {功能}
 */
function normalizeNamespace (fn) {
  return (namespace, map) => {
    if (typeof namespace !== 'string') {
      map = namespace
      namespace = ''
    } else if (namespace.charAt(namespace.length - 1) !== '/') {
      namespace += '/'
    }
    return fn(namespace, map)
  }
}

/**
 * 从 store by namespace 中搜索特殊模块。如果 module 不存在，则打印错误消息。
 * @param {Object} 存储
 * @param {String} 帮助程序
 * @param {String} 命名空间
 * @return {Object}
 */
function getModuleByNamespace (store, helper, namespace) {
  const module = store._modulesNamespaceMap[namespace]
  if (__DEV__ && !module) {
    console.error(`[vuex] module namespace not found in ${helper}(): ${namespace}`)
  }
  return module
}
