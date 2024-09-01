// Credits: borrowed code from fcomb/redux-logger

import { deepCopy } from '../util'

/**
 * 函数 'createLogger' 是一个实用程序，用于在 Vuex store 中记录 mutation 和 action
 * 可定制的选项。
 * @param [] - 'createLogger' 函数是一个用于记录更改和操作的实用函数
 * 在 Vuex 商店中。以下是该函数中使用的参数的说明：
 * @returns 'createLogger' 函数返回一个函数，该函数接受 'store' 参数并将
 * UP 订阅以根据提供的配置选项记录更改和操作。这
 * 函数返回控制台中更改和操作的配置记录器输出。
 */
export function createLogger ({
  collapsed = true,
  filter = (mutation, stateBefore, stateAfter) => true,
  transformer = state => state,
  mutationTransformer = mut => mut,
  actionFilter = (action, state) => true,
  actionTransformer = act => act,
  logMutations = true,
  logActions = true,
  logger = console
} = {}) {
  return store => {
    let prevState = deepCopy(store.state)

    if (typeof logger === 'undefined') {
      return
    }

    if (logMutations) {
      store.subscribe((mutation, state) => {
        const nextState = deepCopy(state)

        if (filter(mutation, prevState, nextState)) {
          const formattedTime = getFormattedTime()
          const formattedMutation = mutationTransformer(mutation)
          const message = `mutation ${mutation.type}${formattedTime}`

          startMessage(logger, message, collapsed)
          logger.log('%c prev state', 'color: #9E9E9E; font-weight: bold', transformer(prevState))
          logger.log('%c mutation', 'color: #03A9F4; font-weight: bold', formattedMutation)
          logger.log('%c next state', 'color: #4CAF50; font-weight: bold', transformer(nextState))
          endMessage(logger)
        }

        prevState = nextState
      })
    }

    if (logActions) {
      store.subscribeAction((action, state) => {
        if (actionFilter(action, state)) {
          const formattedTime = getFormattedTime()
          const formattedAction = actionTransformer(action)
          const message = `action ${action.type}${formattedTime}`

          startMessage(logger, message, collapsed)
          logger.log('%c action', 'color: #03A9F4; font-weight: bold', formattedAction)
          endMessage(logger)
        }
      })
    }
  }
}

/* 'startMessage' 函数是 'createLogger' 函数中使用的实用函数。它需要
三个参数：'logger'、'message' 和 'collapsed'。*/
function startMessage (logger, message, collapsed) {
  const startMessage = collapsed
    ? logger.groupCollapsed
    : logger.group

  // render
  try {
    startMessage.call(logger, message)
  } catch (e) {
    logger.log(message)
  }
}

/* 'createLogger' 函数中使用 'endMessage' 函数来正确结束日志记录消息
组。它尝试调用 'logger.groupEnd（）' 来关闭记录的消息组。如果
控制台不支持 'logger.groupEnd（）'，它会回退到记录简单的消息
指示日志的结束。此函数可确保日志记录输出的格式正确
并在控制台中关闭。*/
function endMessage (logger) {
  try {
    logger.groupEnd()
  } catch (e) {
    logger.log('—— log end ——')
  }
}

/* 'getFormattedTime（）' 函数是 'createLogger' 函数中使用的一个实用函数，用于
生成格式化的时间戳。它以以下格式创建当前时间的字符串表示
'@ HH：MM：SS.mmm'，其中：
- “HH”表示用 0 填充的小时，以确保长度为 2 个字符。
- “MM”表示用 0 填充的分钟，以确保长度为 2 个字符。
- 'SS' 表示用 0 填充的秒数，以确保长度为 2 个字符。
- 'mmm' 表示用 0 填充的毫秒数，以确保长度为 3 个字符。*/
function getFormattedTime () {
  const time = new Date()
  return ` @ ${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(time.getSeconds(), 2)}.${pad(time.getMilliseconds(), 3)}`
}

/* 'repeat' 函数有两个参数： 'str' 和 'times'。它返回一个重复
输入 'str' 指定数量的 'times'。*/
function repeat (str, times) {
  return (new Array(times + 1)).join(str)
}

/* 'pad' 函数用于用零填充数字，以确保它达到一定长度
由 'maxLength' 指定。以下是它的工作原理：*/
function pad (num, maxLength) {
  return repeat('0', maxLength - num.toString().length) + num
}
