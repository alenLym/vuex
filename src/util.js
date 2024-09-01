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

export function isObject(obj) {
  return obj !== null && typeof obj === 'object'
}

export function isPromise(val) {
  return val && typeof val.then === 'function'
}

export function assert(condition, msg) {
  if (!condition) throw new Error(`[vuex] ${msg}`)
}

export function partial(fn, arg) {
  return function () {
    return fn(arg)
  }
}
