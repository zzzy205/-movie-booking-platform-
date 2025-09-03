import { useRef, useCallback } from 'react';

/**
 * 防止重复请求的自定义Hook
 * @param requestFn 请求函数
 * @param delay 防抖延迟时间（毫秒）
 * @returns 防重复的请求函数
 */
export function usePreventDuplicateRequest<T extends (...args: any[]) => Promise<any>>(
  requestFn: T,
  delay: number = 1000
): T {
  const isRequestingRef = useRef(false);
  const lastRequestTimeRef = useRef(0);

  const preventDuplicateRequest = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const now = Date.now();
      
      // 如果正在请求中，直接返回
      if (isRequestingRef.current) {
        console.log('请求正在进行中，跳过重复请求');
        throw new Error('Request in progress');
      }
      
      // 如果距离上次请求时间太短，跳过
      if (now - lastRequestTimeRef.current < delay) {
        console.log('请求过于频繁，跳过重复请求');
        throw new Error('Request too frequent');
      }
      
      try {
        isRequestingRef.current = true;
        lastRequestTimeRef.current = now;
        
        const result = await requestFn(...args);
        return result;
      } finally {
        isRequestingRef.current = false;
      }
    },
    [requestFn, delay]
  ) as T;

  return preventDuplicateRequest;
}
