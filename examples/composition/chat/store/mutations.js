/**
 * 此模块使用三种方法导出一个对象，用于处理消息和线程。
 * - 'receiveAll' 函数处理一组消息，必要时创建一个新线程，
 * 标记 Latest 消息，将消息添加到 state 中，并将 Current Thread 设置为
 * 一个包含最新消息。
 * @param {Object} state - 包含当前
 * 应用程序状态，例如线程、消息和当前查看的线程。
 * @param {Array} messages - 包含消息对象的数组。每个消息对象
 * 应具有 threadID、threadName、timestamp 等属性，以提供信息
 * 关于消息。
 * setCurrentThread（状态， latestMessage.threadID）
 * 
 * -
 */
export default {
  /**
   * 'receiveAll' 函数处理一组消息，必要时创建新线程，
   * 标记 Latest Message，将 messages 添加到 state 中，并将当前线程设置为
   * 一个包含最新消息。
   * @param state - State 是一个对象，其中包含有关当前应用程序状态的信息，
   * 例如线程、消息和当前正在查看的线程。
   * @param messages - Messages 是包含消息对象的数组。每个 message 对象都应该具有
   * threadID、threadName、timestamp 等属性以及有关
   * 消息。
   */
  receiveAll (state, messages) {
    let latestMessage
    messages.forEach(message => {
      // create new thread if the thread doesn't exist
      if (!state.threads[message.threadID]) {
        createThread(state, message.threadID, message.threadName)
      }
      // mark the latest message
      if (!latestMessage || message.timestamp > latestMessage.timestamp) {
        latestMessage = message
      }
      // add message
      addMessage(state, message)
    })
    // set initial thread to the one with the latest message
    setCurrentThread(state, latestMessage.threadID)
  },

  receiveMessage (state, message) {
    addMessage(state, message)
  },

  switchThread (state, id) {
    setCurrentThread(state, id)
  }
}

/**
 * 函数 'createThread' 创建一个具有 id、name、空 messages 数组和
 * lastMessage 设置为 null。
 * @param state - 'state' 参数是一个包含有关当前状态的信息的对象
 * 的应用程序。它可能包括与线程、消息、用户和其他相关数据相关的数据
 * 信息。
 * @param id - 'createThread' 函数中的 'id' 参数用于唯一标识
 * 线程。它通常是一个字符串或数字，用作
 * 线程。
 * @param名称 - “createThread”函数中的 'name' 参数表示线程的名称
 * 将被创建。它是一个字符串值，将分配给
 * thread 对象。
 */
function createThread (state, id, name) {
  state.threads = {
    ...state.threads,
    [id]: {
      id,
      name,
      messages: [],
      lastMessage: null
    }
  }
}

/* 'addMessage' 函数负责向应用程序状态添加新消息。这是
该函数的作用细分：*/
/**
 * 使用新消息更新状态并修改相应的线程。
 * @param {object} state - 包含消息和线程的当前状态对象。
 * @param {object} message - 要添加的新消息对象。
 * @returns 无
 */
function addMessage (state, message) {
  // add a `isRead` field before adding the message
  message.isRead = message.threadID === state.currentThreadID
  // add it to the thread it belongs to
  const thread = state.threads[message.threadID]
  if (!thread.messages.some(id => id === message.id)) {
    thread.messages.push(message.id)
    thread.lastMessage = message
  }
  // add it to the messages map
  state.messages = {
    ...state.messages,
    [message.id]: message
  }
}

/**
 * 函数 setCurrentThread 在 state 对象中设置当前线程 ID，并将最后一个线程 ID 标记为
 * 消息设置为已读。
 * @param state - 'state' 参数通常是一个对象，用于保存
 * 应用程序或应用程序中的特定模块。它可能包含各种属性和
 * 表示应用程序在给定时间点的数据和配置的值。在
 * context 中，则
 * @param id - 'setCurrentThread' 函数中的 'id' 参数用于指定
 * 要在 state 中设置的当前线程。此 ID 用于识别和访问
 * state 对象中的特定线程。
 */
function setCurrentThread (state, id) {
  state.currentThreadID = id
  if (!state.threads[id]) {
    debugger
  }
  // mark thread as read
  state.threads[id].lastMessage.isRead = true
}
