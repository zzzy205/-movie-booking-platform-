/**
 * 开发环境警告抑制工具
 * 这些警告不影响功能，只是开发环境的提示
 */

// 抑制React严格模式的findDOMNode警告
export const suppressFindDOMNodeWarning = () => {
  if (process.env.NODE_ENV === 'development') {
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      // 过滤掉findDOMNode相关的警告
      if (args[0]?.includes?.('findDOMNode is deprecated')) {
        return;
      }
      // 过滤掉Menu children相关的警告
      if (args[0]?.includes?.('Menu') && args[0]?.includes?.('children')) {
        return;
      }
      originalConsoleWarn.apply(console, args);
    };
  }
};

// 抑制WebSocket连接错误（React开发服务器）
export const suppressWebSocketErrors = () => {
  if (process.env.NODE_ENV === 'development') {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // 过滤掉React开发服务器的WebSocket连接错误
      if (args[0]?.includes?.('WebSocket connection to') && 
          args[0]?.includes?.('ws://localhost:3000/ws')) {
        return;
      }
      originalConsoleError.apply(console, args);
    };
  }
};

// 抑制其他开发环境警告
export const suppressDevelopmentWarnings = () => {
  if (process.env.NODE_ENV === 'development') {
    // 抑制React严格模式的重复渲染警告
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      // 过滤掉React严格模式的警告
      if (args[0]?.includes?.('StrictMode') || 
          args[0]?.includes?.('findDOMNode') ||
          args[0]?.includes?.('Menu children')) {
        return;
      }
      originalConsoleWarn.apply(console, args);
    };
  }
};

// 初始化所有警告抑制
export const initWarningSuppression = () => {
  suppressFindDOMNodeWarning();
  suppressWebSocketErrors();
  suppressDevelopmentWarnings();
  
  console.log('🚀 开发环境警告抑制已启用');
  console.log('📝 这些警告不影响应用功能，只是开发环境的提示');
};
