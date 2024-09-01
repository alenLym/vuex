import * as api from '../api'

/**
 * 函数 'getAllMessages' 从 API 检索所有消息并将其提交到存储。
 */
export const getAllMessages = ({ commit }) => {
  api.getAllMessages(messages => {
    commit('receiveAll', messages)
  })
}

/**
 * 函数 'sendMessage' 使用 API 发送消息，并将收到的消息提交到
 * 商店。
 * @param payload - 'sendMessage' 函数中的 'payload' 参数通常是一个对象
 * 包含创建消息所需的数据。它可能包括消息等信息
 * 内容、发件人详细信息、时间戳或创建消息所需的任何其他相关数据。
 */
export const sendMessage = ({ commit }, payload) => {
  api.createMessage(payload, message => {
    commit('receiveMessage', message)
  })
}

/**
 * 函数 'switchThread' 获取有效负载并提交名为 'switchThread' 的更改。
 * @param payload - 'switchThread' 函数中的 'payload' 参数是将
 * 在提交时传递给 'switchThread' 突变。它通常包含信息或
 * 在 Vuex store 中执行状态更改所需的说明。
 */
export const switchThread = ({ commit }, payload) => {
  commit('switchThread', payload)
}
