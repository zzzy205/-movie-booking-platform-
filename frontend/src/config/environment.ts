// 导入警告抑制工具
import { initWarningSuppression } from '../utils/suppressWarnings';

// 环境配置
export const config = {
  // API配置
  api: {
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001',
    timeout: 10000,
  },
  
  // WebSocket配置
  websocket: {
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:8001',
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
  },
  
  // 应用配置
  app: {
    name: '电影预订平台',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  }
};

// 在开发环境下初始化警告抑制
if (process.env.NODE_ENV === 'development') {
  initWarningSuppression();
}
