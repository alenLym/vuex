/**
 * Various utility functions for working with objects and functions.
 */
/**
 * 获取第一个通过测试的项目
 * by second 参数函数
 *
 * @param {Array} 列表
 * @param {函数} f
 * @return {*}
 */
export function find(list, f) {
  return list.filter(f)[0]
}

/**
 * 考虑到圆形结构，深拷贝给定的对象。
 * 此函数缓存所有嵌套对象及其副本。
 * 如果检测到循环结构，则使用 cached copy 以避免无限循环。
 *
 * @param {*} 对象
 * @param {Array<Object>} 缓存
 * @return {*}
 */
export function deepCopy(obj, cache = []) {
  // 如果 obj 是不可变值，则只返回
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // 如果 OBJ 被命中，则为圆形结构
  const hit = find(cache, c => c.original === obj)
  if (hit) {
    return hit.copy
  }

  const copy = Array.isArray(obj) ? [] : {}
  // 首先将副本放入缓存中
  // 因为我们想要在递归 deepCopy 中引用它
  cache.push({
    original: obj,
    copy
  })

  Object.keys(obj).forEach(key => {
    copy[key] = deepCopy(obj[key], cache)
  })

  return copy
}

/**
 * forEach for 对象
 */
export function forEachValue(obj, fn) {
  Object.keys(obj).forEach(key => fn(obj[key], key))
}

/**
 * 检查给定值是否为对象。
 * @param {any} obj - 用于检查它是否为对象的值。
 * @returns {boolean} 如果值是对象，则返回 true，否则返回 false。
 */
export function isObject(obj) {
  return obj !== null && typeof obj === 'object'
}

export function isPromise(val) {
  return val && typeof val.then === 'function'
}

/**
 * 函数 'forEachValue' 迭代对象的值并应用指定的函数
 * 添加到每个值。
 * @param obj - 包含键值对的对象。
 * @param fn - “forEachValue”函数中的“fn”参数是一个回调函数，它将是
 * 为 'obj' 对象中的每个值调用。它需要两个参数：当前属性的值
 * 被迭代和该属性的 key。
 */
export function assert(condition, msg) {
  if (!condition) throw new Error(`[vuex] ${msg}`)
}

/**
 * partial 函数接受一个函数和一个参数，并返回一个调用
 * original 函数。
 * @param fn - “partial”函数中的 'fn' 参数引用所需的函数
 * 以创建部分应用程序。
 * @param arg - 'partial' 函数中的 'arg' 参数是部分的参数
 * 应用于函数 'fn'。这意味着，当您调用部分应用的函数时，它将
 * 已经将 'arg' 作为其参数之一，您只需提供剩余的
 * 参数。
 */
export function partial(fn, arg) {
  return function () {
    return fn(arg)
  }
}
