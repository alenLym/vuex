import Module from './module'
import { assert, forEachValue } from '../util'

export default class ModuleCollection {
  constructor(rawRootModule) {
    // Register root module （Vuex.Store 选项）
    this.register([], rawRootModule, false)
  }

  /**
   * get 函数采用一个路径数组，并从
   * root 模块。
   * @param path - 'path' 参数是表示子模块序列的键数组
   * 遍历以到达所需的模块。
   * @returns 'get' 函数返回位于指定路径的子模块。它使用
   * 'reduce' 方法迭代 path 数组中的每个键，并在该
   * key 中。最终结果是位于路径末尾的子模块。
   */
  get(path) {
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }

  /**
   * 根据给定的路径获取命名空间
   * 此方法用于通过路径逐步获取最终的命名空间字符串
   * 它从根模块开始，沿着给定的路径逐步访问每个子模块，
   * 并根据每个子模块是否具有独立命名空间添加相应的命名空间前缀
   * 
   * @param {Array} path - 路径数组，表示模块的层级关系
   * @returns {String} - 返回最终的命名空间字符串
   */
  getNamespace(path) {
    // 初始化模块为根模块
    let module = this.root
    // 使用reduce函数遍历路径数组，累加生成最终的命名空间字符串
    return path.reduce((namespace, key) => {
      // 根据当前路径键值获取对应的子模块
      module = module.getChild(key)
      // 根据子模块是否具有独立命名空间，决定是否添加当前键值作为命名空间前缀
      // 并累加到已有的命名空间字符串中
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  update(rawRootModule) {
    update([], this.root, rawRootModule)
  }

  /**
   * 注册一个新的模块到存储。
   * 
   * @param {Array} path - 模块的路径数组，用于标识模块的位置。
   * @param {Object} rawModule - 原始的模块对象，包含模块的定义。
   * @param {boolean} [runtime=true] - 是否在运行时注册模块，默认为true。
   */
  register(path, rawModule, runtime = true) {
    // 在开发模式下，校验模块的合法性。
    if (__DEV__) {
      assertRawModule(path, rawModule)
    }

    // 创建一个新的模块实例。
    const newModule = new Module(rawModule, runtime)
    // 如果路径为空，说明这是根模块。
    if (path.length === 0) {
      this.root = newModule
    } else {
      // 否则，找到该模块的父模块，并将新模块添加为父模块的子模块。
      const parent = this.get(path.slice(0, -1))
      parent.addChild(path[path.length - 1], newModule)
    }

    // 如果模块包含子模块，则递归注册子模块。
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }

  /**
   * 取消注册给定路径的Vuex模块
   * 
   * @param {Array} path - 模块路径，用于定位到特定的模块
   * 
   * 此函数的目的是在Vuex store中取消注册一个特定的模块它首先通过路径找到父模块，
   * 然后检查是否有所需的子模块存在如果子模块不存在，它会在开发模式下给出警告
   * 如果子模块存在并且有runtime（表示模块已注册），则会从父模块中移除该子模块
   */
  unregister(path) {
    // 根据给定的路径找到父模块
    const parent = this.get(path.slice(0, -1))
    // 获取路径的最后一部分，即子模块的键名
    const key = path[path.length - 1]
    // 通过键名获取父模块下的子模块
    const child = parent.getChild(key)

    // 如果找不到子模块
    if (!child) {
      // 在开发模式下给出警告
      if (__DEV__) {
        console.warn(
          `[vuex] trying to unregister module '${key}', which is ` +
          `not registered`
        )
      }
      // 终止操作
      return
    }

    // 如果子模块没有runtime属性，表示模块未注册，直接返回
    if (!child.runtime) {
      return
    }

    // 从父模块中移除子模块
    parent.removeChild(key)
  }
  /**
   * 检查给定路径上的节点是否已注册
   * 
   * 此方法通过分析路径来查找特定节点是否作为子节点被注册它首先从路径中提取父节点的路径，
   * 然后检查最后一个路径段（即节点的键）是否作为父节点的子节点存在
   * 
   * @param {string} path - 表示节点路径的字符串，以'/'分隔各个层级最后一个路径段是要检查的节点键
   * @returns {boolean} 如果节点已注册返回true，否则返回false
   */
  isRegistered(path) {
    // 通过切片操作获取除最后一个路径段外的所有路径段来获取父节点
    const parent = this.get(path.slice(0, -1))
    // 获取最后一个路径段，即我们要检查的节点的键
    const key = path[path.length - 1]

    // 如果父节点存在，则检查指定键的节点是否为其子节点
    if (parent) {
      return parent.hasChild(key)
    }

    // 如果父节点不存在，意味着节点没有注册
    return false
  }
}

/**
 * 更新 Vuex 模块及其嵌套模块的功能函数
 * 主要用于热更新模块时，通过递归方式更新目标模块和其所有子模块
 * 
 * @param {Array} path - 模块的路径数组，用于递归时标识当前模块的位置
 * @param {Object} targetModule - 目标模块对象，需要被更新的模块
 * @param {Object} newModule - 新模块对象，用于替换目标模块的新定义
 */
function update(path, targetModule, newModule) {
  // 开发模式下的额外检查
  if (__DEV__) {
    assertRawModule(path, newModule)
  }

  // 更新目标模块
  targetModule.update(newModule)

  // 更新嵌套模块
  if (newModule.modules) {
    for (const key in newModule.modules) {
      // 如果子模块不存在于目标模块中，则输出警告信息
      if (!targetModule.getChild(key)) {
        if (__DEV__) {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
            'manual reload is needed'
          )
        }
        return
      }
      // 递归更新子模块
      update(
        path.concat(key),
        targetModule.getChild(key),
        newModule.modules[key]
      )
    }
  }
}

const functionAssert = {
  assert: value => typeof value === 'function',
  expected: 'function'
}

const objectAssert = {
  assert: value => typeof value === 'function' ||
    (typeof value === 'object' && typeof value.handler === 'function'),
  expected: 'function or object with "handler" function'
}

const assertTypes = {
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert
}
/**
 * 对原始模块进行断言检查
 * 
 * 此函数遍历一个对象，该对象包含需要断言检查的模块属性键值对对于每个属性，它进一步遍历该属性下的所有值，并根据预定义的断言类型进行检查如果值不符合预期的类型，将抛出一个错误，包含详细的断言信息
 * 
 * @param {string} path - 模块的路径，用于在断言失败时提供上下文信息
 * @param {Object} rawModule - 原始模块对象，其中包含需要断言检查的属性和值
 */
function assertRawModule(path, rawModule) {
  // 遍历预定义的断言类型对象，对每个属性进行断言检查
  Object.keys(assertTypes).forEach(key => {
    // 如果原始模块中不存在该属性，则跳过检查
    if (!rawModule[key]) return

    // 获取当前属性的断言选项
    const assertOptions = assertTypes[key]

    // 遍历当前属性下的所有值，对每个值进行断言检查
    forEachValue(rawModule[key], (value, type) => {
      // 执行断言，如果断言失败，抛出包含详细断言信息的错误
      assert(
        assertOptions.assert(value),
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      )
    })
  })
}

/**
 * 构造断言错误信息
 * 
 * 该函数用于生成一个易于理解的错误消息，用于报告对象属性断言失败的情况
 * 它会指明哪个属性（在哪个路径下）的类型或值没有符合预期的情况
 * 
 * @param {Array} path - 属性所在的对象路径数组，用于指明属性在对象结构中的位置
 * @param {string} key - 属性的键名，直接指明当前断言的属性
 * @param {string} type - 断言的类型，可以是'type'或'value'，用于指明断言失败的原因是类型不匹配还是值不匹配
 * @param {any} value - 实际的值，即在断言时发现的属性的值
 * @param {string|function} expected - 预期的值或类型描述，用于在错误消息中指明期望的结果
 * @returns {string} - 返回构建的错误消息字符串，描述了断言失败的详细情况
 */
function makeAssertionMessage(path, key, type, value, expected) {
  // 构建基础错误消息，指明哪个属性应该是什么样的（类型或值），但实际却是另一种情况
  let buf = `${key} should be ${expected} but "${key}.${type}"`;

  // 如果路径数组不为空，即属性位于对象结构的深层，则在错误消息中添加路径信息
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`;
  }

  // 完善错误消息，添加实际的值的字符串表示形式
  buf += ` is ${JSON.stringify(value)}.`;

  // 返回最终构建的错误消息
  return buf;
}