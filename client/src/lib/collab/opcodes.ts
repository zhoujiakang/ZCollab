/**
 * 外层消息类型。
 * 对照 client/node_modules/y-websocket/src/y-websocket.js:
 *   messageSync = 0, messageAwareness = 1
 * （同文件还定义了 messageAuth = 2、messageQueryAwareness = 3，本阶段未接线。）
 */
export const MessageType = {
  SYNC: 0,
  AWARENESS: 1,
} as const;

/**
 * 同步子类型。
 * 对照 client/node_modules/y-protocols/sync.js:
 *   messageYjsSyncStep1 = 0, messageYjsSyncStep2 = 1, messageYjsUpdate = 2
 * 与后端 com.zcollab.core.protocol.SyncMessageType 的 STEP_1/STEP_2/UPDATE 逐项一致。
 */
export const SyncMessageType = {
  STEP1: 0,
  STEP2: 1,
  UPDATE: 2,
} as const;

/**
 * 关闭连接 code。
 * y-websocket/src/y-websocket.js 约定 4400-4499 为服务端主动拒绝、不应重连的永久错误；
 * 4401/4404/4500 是本项目的具体取值，4500 属于可重试区间。
 */
export const CloseCode = {
  NORMAL_CLOSURE: 1000,
  GOING_AWAY: 1001,
  PERMISSION_DENIED: 4401,
  DOCUMENT_NOT_FOUND: 4404,
  SERVER_ERROR: 4500,
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];
export type SyncMessageType = (typeof SyncMessageType)[keyof typeof SyncMessageType];
export type CloseCode = (typeof CloseCode)[keyof typeof CloseCode];
