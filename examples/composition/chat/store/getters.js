export const threads = state => state.threads

/**
 * 函数 'currentThread' 根据
 * currentThreadID 的 ID 中。
 * @returns 'currentThread' 函数根据
 * 'currentThreadID' 如果存在，否则返回一个空对象。
 */
export const currentThread = state => {
  return state.currentThreadID
    ? state.threads[state.currentThreadID]
    : {}
}

/**
 * 此 JavaScript 函数计算线程列表中未读消息的数量。
 * @returns 函数 'unreadCount' 返回 'threads' 中未读消息的计数
 * 对象。它遍历 'threads' 对象中的每个线程，如果
 * 未读取线程中的最后一条消息。
 */
/**
 * 此函数从 state 返回当前消息。
 */
export const currentMessages = state => {
  const thread = currentThread(state)
  return thread.messages
    ? thread.messages.map(id => state.messages[id])
    : []
}

/**
 * 根据最后一条消息的读取状态计算未读线程数。
 * @param {Object} threads - 包含线程信息的对象。
 * @returns {number} 未读线程数。
 */
export const unreadCount = ({ threads }) => {
  return Object.keys(threads).reduce((count, id) => {
    return threads[id].lastMessage.isRead ? count : count + 1
  }, 0)
}

/**
 * 函数 'sortedMessages' 根据消息的时间戳按升序对消息进行排序。
 * @param state - 'state' 参数通常是指 Vuex store 在
 * Vue.js应用程序。它包含由 Vuex 管理的数据，可以访问和
 * 使用 mutations 和 actions 进行修改。
 * @param getter - getter 是 Vuex 中的函数，允许你在响应式
 * 方式。它们用于根据 store state 计算派生 state。在 Vuex 的上下文中，getter
 * 通常用于从 store 状态中检索和计算值。
 * @returns 'sortedMessages' 函数返回一个新的消息数组，这些消息根据
 * 它们的时间戳按升序排列。
 */
export const sortedMessages = (state, getters) => {
  const messages = getters.currentMessages
  return messages.slice().sort((a, b) => a.timestamp - b.timestamp)
}
