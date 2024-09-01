import { setupDevtoolsPlugin } from '@vue/devtools-api'
import { makeLocalGetters } from '../store-util'

const LABEL_VUEX_BINDINGS = 'vuex bindings'
const MUTATIONS_LAYER_ID = 'vuex:mutations'
const ACTIONS_LAYER_ID = 'vuex:actions'
const INSPECTOR_ID = 'vuex'

let actionId = 0

/**
 * 函数 'addDevtools' 在 Vue.js 应用程序中为 Vuex 设置了一个 devtools 插件，提供
 * 用于检查和跟踪更改和操作的功能。
 * @param app - 'addDevtools' 函数中的 'app' 参数通常是对
 * Vue.js要添加 Vuex Devtools 的应用程序实例。这允许 Devtools
 * 与 Vue.js 应用程序及其 Vuex store 交互以进行调试和检查。
 * @param store - addDevtools' 函数中的 'store' 参数通常是 Vuex 的一个实例
 * store 在 Vue.js 应用程序中。它用于与状态管理系统交互并跟踪
 * 用于调试和监控目的的 mutations 和 actions。store 包含应用程序的
 * state、mutations、actions 和
 */
export function addDevtools (app, store) {
  setupDevtoolsPlugin(
    {
      id: 'org.vuejs.vuex',
      app,
      label: 'Vuex',
      homepage: 'https://next.vuex.vuejs.org/',
      logo: 'https://vuejs.org/images/icons/favicon-96x96.png',
      packageName: 'vuex',
      componentStateTypes: [LABEL_VUEX_BINDINGS]
    },
    (api) => {
      api.addTimelineLayer({
        id: MUTATIONS_LAYER_ID,
        label: 'Vuex Mutations',
        color: COLOR_LIME_500
      })

      api.addTimelineLayer({
        id: ACTIONS_LAYER_ID,
        label: 'Vuex Actions',
        color: COLOR_LIME_500
      })

      api.addInspector({
        id: INSPECTOR_ID,
        label: 'Vuex',
        icon: 'storage',
        treeFilterPlaceholder: 'Filter stores...'
      })

      api.on.getInspectorTree((payload) => {
        if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
          if (payload.filter) {
            const nodes = []
            flattenStoreForInspectorTree(nodes, store._modules.root, payload.filter, '')
            payload.rootNodes = nodes
          } else {
            payload.rootNodes = [
              formatStoreForInspectorTree(store._modules.root, '')
            ]
          }
        }
      })

      api.on.getInspectorState((payload) => {
        if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
          const modulePath = payload.nodeId
          makeLocalGetters(store, modulePath)
          payload.state = formatStoreForInspectorState(
            getStoreModule(store._modules, modulePath),
            modulePath === 'root' ? store.getters : store._makeLocalGettersCache,
            modulePath
          )
        }
      })

      api.on.editInspectorState((payload) => {
        if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
          const modulePath = payload.nodeId
          let path = payload.path
          if (modulePath !== 'root') {
            path = [...modulePath.split('/').filter(Boolean), ...path]
          }
          store._withCommit(() => {
            payload.set(store._state.data, path, payload.state.value)
          })
        }
      })

      store.subscribe((mutation, state) => {
        const data = {}

        if (mutation.payload) {
          data.payload = mutation.payload
        }

        data.state = state

        api.notifyComponentUpdate()
        api.sendInspectorTree(INSPECTOR_ID)
        api.sendInspectorState(INSPECTOR_ID)

        api.addTimelineEvent({
          layerId: MUTATIONS_LAYER_ID,
          event: {
            time: Date.now(),
            title: mutation.type,
            data
          }
        })
      })

      store.subscribeAction({
        before: (action, state) => {
          const data = {}
          if (action.payload) {
            data.payload = action.payload
          }
          action._id = actionId++
          action._time = Date.now()
          data.state = state

          api.addTimelineEvent({
            layerId: ACTIONS_LAYER_ID,
            event: {
              time: action._time,
              title: action.type,
              groupId: action._id,
              subtitle: 'start',
              data
            }
          })
        },
        after: (action, state) => {
          const data = {}
          const duration = Date.now() - action._time
          data.duration = {
            _custom: {
              type: 'duration',
              display: `${duration}ms`,
              tooltip: 'Action duration',
              value: duration
            }
          }
          if (action.payload) {
            data.payload = action.payload
          }
          data.state = state

          api.addTimelineEvent({
            layerId: ACTIONS_LAYER_ID,
            event: {
              time: Date.now(),
              title: action.type,
              groupId: action._id,
              subtitle: 'end',
              data
            }
          })
        }
      })
    }
  )
}

// 从 Tailwind 调色板中提取
const COLOR_LIME_500 = 0x84cc16
const COLOR_DARK = 0x666666
const COLOR_WHITE = 0xffffff

const TAG_NAMESPACED = {
  label: 'namespaced',
  textColor: COLOR_WHITE,
  backgroundColor: COLOR_DARK
}

/**
 * @param {string} 路径
 */
/**
 * 函数 'extractNameFromPath' 通过拆分并返回给定路径来从给定路径中提取名称
 * 倒数第二个元素。
 * @param path - 'extractNameFromPath' 函数将 'path' 作为输入并返回
 * 如果路径不是 'root'，则为路径的倒数第二段。如果路径为 'root' 或为空，则
 * 返回 'Root'。
 * @returns 函数 'extractNameFromPath' 将 'path' 作为输入并返回倒数第二个
 * 段（如果路径不是 'root'）。如果路径为 'root' 或空，则返回 'Root'。
 */
function extractNameFromPath (path) {
  return path && path !== 'root' ? path.split('/').slice(-2, -1)[0] : 'Root'
}

/**
 * @param {*} 模块
 * @return {import（'@vue/devtools-api'）.CustomInspectorNode}
 */
/**
 * 函数 'formatStoreForInspectorTree' 以递归方式将模块及其子模块格式化为树
 * 结构进行检查。
 * @param模块 - “formatStoreForInspectorTree”函数中的“module”参数表示
 * 模块。它包含有关模块的信息，例如其子模块以及
 * 无论是否具有命名空间。
 * @param path - 'formatStoreForInspectorTree' 函数中的 'path' 参数表示路径
 * 中。它用于确定
 * Inspector 树。该函数从路径中提取名称，以显示在树结构中。如果
 * 路径为
 * @returns 函数 'formatStoreForInspectorTree' 返回具有以下属性的对象：
 * - 'id'：'path' 值（如果存在），否则设置为 'root'。
 * - label：对 path：对 path：调用 extractNameFromPath 函数的结果。
 * - 'tags'：包含 'TAG_NAMESPACED' 值的数组，如果 'module
 */
function formatStoreForInspectorTree (module, path) {
  return {
    id: path || 'root',
    // 所有模块都以 '/' 结尾，我们只想要最后一段
// 购物车/ -> 购物车
// 嵌套/推车/ -> 推车
    label: extractNameFromPath(path),
    tags: module.namespaced ? [TAG_NAMESPACED] : [],
    children: Object.keys(module._children).map((moduleName) =>
      formatStoreForInspectorTree(
        module._children[moduleName],
        path + moduleName + '/'
      )
    )
  }
}

/**
 * @param {import（'@vue/devtools-api'） 中。CustomInspectorNode[]} 结果
 * @param {*} 模块
 * @param {string} 过滤器
 * @param {string} 路径
 */
/* 'flattenStoreForInspectorTree' 函数递归遍历 Vuex store 模块
来扁平化 store 结构，以便在 Vue Devtools inspector 树中显示。*/
function flattenStoreForInspectorTree (result, module, filter, path) {
  if (path.includes(filter)) {
    result.push({
      id: path || 'root',
      label: path.endsWith('/') ? path.slice(0, path.length - 1) : path || 'Root',
      tags: module.namespaced ? [TAG_NAMESPACED] : []
    })
  }
  Object.keys(module._children).forEach(moduleName => {
    flattenStoreForInspectorTree(result, module._children[moduleName], filter, path + moduleName + '/')
  })
}

/**
 * @param {*} 模块
 * @return {import（'@vue/devtools-api'）.CustomInspectorState}
 */
/* 'formatStoreForInspectorState' 函数负责格式化 Vuex store 模块
显示在 Vue Devtools 检查器中。它需要三个参数：
1. 'module'：表示需要格式化的 Vuex store 模块。
2. 'getters'：表示与模块关联的 getter。
3. 'path'：表示模块在 Vuex store 中的路径。*/
function formatStoreForInspectorState (module, getters, path) {
  getters = path === 'root' ? getters : getters[path]
  const gettersKeys = Object.keys(getters)
  const storeState = {
    state: Object.keys(module.state).map((key) => ({
      key,
      editable: true,
      value: module.state[key]
    }))
  }

  if (gettersKeys.length) {
    const tree = transformPathsToObjectTree(getters)
    storeState.getters = Object.keys(tree).map((key) => ({
      key: key.endsWith('/') ? extractNameFromPath(key) : key,
      editable: false,
      value: canThrow(() => tree[key])
    }))
  }

  return storeState
}

/* 'transformPathsToObjectTree' 函数将 'getters' 对象作为输入，它表示
Vuex store 模块中的 getter。然后，它将 getter 的路径转换为对象树
结构。*/
function transformPathsToObjectTree (getters) {
  const result = {}
  Object.keys(getters).forEach(key => {
    const path = key.split('/')
    if (path.length > 1) {
      let target = result
      const leafKey = path.pop()
      path.forEach((p) => {
        if (!target[p]) {
          target[p] = {
            _custom: {
              value: {},
              display: p,
              tooltip: 'Module',
              abstract: true
            }
          }
        }
        target = target[p]._custom.value
      })
      target[leafKey] = canThrow(() => getters[key])
    } else {
      result[key] = canThrow(() => getters[key])
    }
  })
  return result
}

/* 'getStoreModule' 函数用于根据
提供的路径。它需要两个参数：'moduleMap'，它表示
store 和 'path'，这是需要检索的特定模块的路径。*/
function getStoreModule (moduleMap, path) {
  const names = path.split('/').filter((n) => n)
  return names.reduce(
    (module, moduleName, i) => {
      const child = module[moduleName]
      if (!child) {
        throw new Error(`Missing module "${moduleName}" for path "${path}".`)
      }
      return i === names.length - 1 ? child : child._children
    },
    path === 'root' ? moduleMap : moduleMap.root._children
  )
}

/* 'canThrow' 函数是一个实用函数，它以回调函数 'cb' 作为参数。它
尝试执行回调函数并返回其结果。如果在
执行回调函数时，'canThrow' 函数会捕获错误并返回它
扔它。这允许代码在发生错误时继续执行而不会崩溃
在回调函数中。*/
function canThrow (cb) {
  try {
    return cb()
  } catch (e) {
    return e
  }
}
