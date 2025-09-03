import axios, { AxiosResponse } from 'axios';
import { 
  LoginRequest, 
  LoginResponse, 
  User, 
  MovieSession, 
  CreateMovieSessionRequest,
  UpdateMovieSessionRequest,
  Booking,
  CreateBookingRequest,
  CancelBookingRequest,
  Announcement,
  UpdateAnnouncementRequest,
  UserImportRequest,
  UserExportResponse,
  ApiResponse,
  PaginatedResponse,
  SeatPosition
} from '../types';

// 创建axios实例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001',
  timeout: 10000, // 默认超时10秒
  headers: {
    'Content-Type': 'application/json',
  },
});

// 创建专门用于批量导入的axios实例，超时时间更长
const bulkImportApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001',
  timeout: 300000, // 批量导入超时5分钟
  headers: {
    'Content-Type': 'multipart/form-data', // 文件上传
  },
});

// 获取服务器时间
export const getServerTime = async (): Promise<Date> => {
  try {
    const response = await api.get('/system/time');
    if (response.data.success) {
      return new Date(response.data.serverTime);
    }
    throw new Error('获取服务器时间失败');
  } catch (error) {
    console.warn('无法获取服务器时间，使用本地时间:', error);
    return new Date();
  }
};

// 获取系统状态
export const getSystemStatus = async () => {
  try {
    const response = await api.get('/system/status');
    return response.data;
  } catch (error) {
    console.error('获取系统状态失败:', error);
    return null;
  }
};

// 简化的请求去重机制
const pendingRequests = new Map();

// 请求限流机制 - 防止系统过载
const requestCounts = new Map();
const MAX_REQUESTS_PER_MINUTE = 100; // 每分钟最多100个请求
const REQUEST_WINDOW = 60 * 1000; // 1分钟窗口

// 清理过期的请求计数
setInterval(() => {
  const now = Date.now();
  Array.from(requestCounts.entries()).forEach(([key, data]) => {
    if (now - data.timestamp > REQUEST_WINDOW) {
      requestCounts.delete(key);
    }
  });
}, REQUEST_WINDOW);

const generateRequestKey = (config: any) => {
  const { method, url, params, data } = config;
  
  // 处理undefined、null和空对象值，避免生成无效的请求键
  const safeParams = params && Object.keys(params).length > 0 ? JSON.stringify(params) : '';
  const safeData = data && Object.keys(data).length > 0 ? JSON.stringify(data) : '';
  
  // 只包含有意义的参数
  const keyParts = [method?.toUpperCase() || 'GET', url];
  if (safeParams) keyParts.push(safeParams);
  if (safeData) keyParts.push(safeData);
  
  return keyParts.join('_');
};

// 检查请求限流
const checkRateLimit = (requestKey: string) => {
  const now = Date.now();
  const requestData = requestCounts.get(requestKey);
  
  if (!requestData) {
    requestCounts.set(requestKey, { count: 1, timestamp: now });
    return true;
  }
  
  if (now - requestData.timestamp > REQUEST_WINDOW) {
    // 重置计数
    requestCounts.set(requestKey, { count: 1, timestamp: now });
    return true;
  }
  
  if (requestData.count >= MAX_REQUESTS_PER_MINUTE) {
    console.warn('请求频率过高，已限流:', requestKey);
    return false;
  }
  
  requestData.count++;
  return true;
};

// 系统健康状态
let systemHealth = {
  consecutiveErrors: 0,
  lastErrorTime: 0,
  isHealthy: true
};

// 系统健康检查
const checkSystemHealth = () => {
  const now = Date.now();
  
  // 如果连续错误过多，标记系统不健康
  if (systemHealth.consecutiveErrors > 10) {
    systemHealth.isHealthy = false;
    console.error('系统健康状态异常，连续错误过多');
  }
  
  // 如果距离上次错误超过5分钟，重置错误计数
  if (now - systemHealth.lastErrorTime > 5 * 60 * 1000) {
    systemHealth.consecutiveErrors = 0;
    systemHealth.isHealthy = true;
  }
};

// 定期检查系统健康状态
setInterval(checkSystemHealth, 30000); // 每30秒检查一次

// 错误恢复机制
const handleSystemError = (error: any) => {
  const now = Date.now();
  systemHealth.consecutiveErrors++;
  systemHealth.lastErrorTime = now;
  
  // 如果系统不健康，清理所有pending请求
  if (!systemHealth.isHealthy) {
    console.warn('系统不健康，清理所有pending请求');
    pendingRequests.forEach(controller => controller.abort());
    pendingRequests.clear();
  }
  
  // 如果连续错误过多，显示用户友好的提示
  if (systemHealth.consecutiveErrors > 5) {
    console.error('系统连续错误过多，建议刷新页面或联系管理员');
  }
};

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 简化的请求去重 - 只对GET请求进行去重，取消重复的请求
    if (config.method?.toLowerCase() === 'get') {
      const requestKey = generateRequestKey(config);
      
      // 检查请求限流
      if (!checkRateLimit(requestKey)) {
        return Promise.reject(new Error('请求频率过高，请稍后再试'));
      }
      
      // 检查是否已经有相同的请求正在进行
      if (pendingRequests.has(requestKey)) {
        console.log('检测到重复GET请求，取消前一个:', requestKey);
        const controller = pendingRequests.get(requestKey);
        controller.abort();
        pendingRequests.delete(requestKey);
      }
      
      // 创建新的AbortController
      const controller = new AbortController();
      config.signal = controller.signal;
      pendingRequests.set(requestKey, controller);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // 请求成功，清理pendingRequests
    if (response.config.method?.toLowerCase() === 'get') {
      const requestKey = generateRequestKey(response.config);
      pendingRequests.delete(requestKey);
    }
    
    // 请求成功，重置错误计数
    if (systemHealth.consecutiveErrors > 0) {
      systemHealth.consecutiveErrors = Math.max(0, systemHealth.consecutiveErrors - 1);
    }
    
    return response;
  },
  async (error) => {
    // 请求失败，清理pendingRequests
    if (error.config && error.config.method?.toLowerCase() === 'get') {
      const requestKey = generateRequestKey(error.config);
      pendingRequests.delete(requestKey);
    }
    
    // 处理系统错误
    handleSystemError(error);
    
    // 处理不同类型的错误
    if (error.response?.status === 401) {
      // 清除本地存储并跳转到登录页
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 避免无限重定向
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      console.error('权限不足:', error.response.data?.message);
    } else if (error.response?.status === 404) {
      console.error('请求的资源不存在:', error.config?.url);
    } else if (error.response?.status === 429) {
      // 429 Too Many Requests - 智能重试机制
      const retryCount = error.config.retryCount || 0;
      const maxRetries = 1; // 减少重试次数到1次
      
      if (retryCount < maxRetries) {
        console.warn(`API请求过于频繁，第${retryCount + 1}次重试...`);
        error.config.retryCount = retryCount + 1;
        
        // 指数退避策略
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return api.request(error.config);
      } else {
        console.error('API请求过于频繁，已达到最大重试次数');
        // 显示用户友好的错误信息
        if (error.config.url?.includes('/auth/login')) {
          console.error('登录请求过于频繁，请等待几分钟后再试');
        }
        return Promise.reject(error);
      }
    } else if (error.response?.status >= 500) {
      console.error('服务器内部错误:', error.response.data?.message);
    } else if (error.code === 'NETWORK_ERROR') {
      console.error('网络连接错误，请检查网络连接');
    } else if (error.code === 'ECONNABORTED') {
      console.error('请求超时，请检查网络连接');
    }
    
    return Promise.reject(error);
  }
);

// 认证相关API
export const authAPI = {
  login: (data: LoginRequest): Promise<AxiosResponse<ApiResponse<LoginResponse>>> =>
    api.post('/auth/login', data),
  
  getProfile: (): Promise<AxiosResponse<ApiResponse<User>>> =>
    api.get('/auth/profile'),
  
  changePassword: (data: { oldPassword: string; newPassword: string }): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/auth/change-password', data),
};

// 电影场次相关API
export const movieAPI = {
  getSessions: (params?: { page?: number; limit?: number }): Promise<AxiosResponse<ApiResponse<MovieSession[]>>> =>
    api.get('/movies/sessions', { params }),
  
  getSession: (id: number): Promise<AxiosResponse<ApiResponse<MovieSession>>> =>
    api.get(`/movies/sessions/${id}`),
  
  createSession: (data: CreateMovieSessionRequest): Promise<AxiosResponse<ApiResponse<MovieSession>>> =>
    api.post('/movies/sessions', data),
  
  updateSession: (id: number, data: UpdateMovieSessionRequest): Promise<AxiosResponse<ApiResponse<MovieSession>>> =>
    api.put(`/movies/sessions/${id}`, data),
  
  deleteSession: (id: number): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/movies/sessions/${id}`),
  
  validateBooking: (id: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post(`/movies/sessions/${id}/validate-booking`),
};

// 预订相关API
export const bookingAPI = {
  getSeats: (sessionId: number): Promise<AxiosResponse<ApiResponse<{ seats: any[] }>>> =>
    api.get(`/bookings/sessions/${sessionId}/seats`),
  
  createBooking: (data: CreateBookingRequest): Promise<AxiosResponse<ApiResponse<Booking[]>>> =>
    api.post('/bookings', data),
  
  getUserBookings: (): Promise<AxiosResponse<ApiResponse<Booking[]>>> =>
    api.get('/bookings/user'),
  
  cancelBooking: (data: CancelBookingRequest): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/bookings/cancel', data),
  
  cancelSeats: (data: { booking_id: number; seats: SeatPosition[] }): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/bookings/cancel-seats', data),
  
  getSessionBookings: (sessionId: number): Promise<AxiosResponse<ApiResponse<Booking[]>>> =>
    api.get(`/bookings/sessions/${sessionId}`),
};

// 公告相关API
export const announcementAPI = {
  getAnnouncement: (): Promise<AxiosResponse<ApiResponse<Announcement>>> =>
    api.get('/announcements'),
  
  updateAnnouncement: (data: UpdateAnnouncementRequest): Promise<AxiosResponse<ApiResponse<Announcement>>> =>
    api.put('/announcements', data),
};

// 用户管理相关API
export const userAPI = {
  getUsers: (params?: { page?: number; limit?: number }): Promise<AxiosResponse<ApiResponse<User[]>>> =>
    api.get('/users', { params }),
  
  createUser: (data: { account: string; username: string; role?: 'user' | 'admin' }): Promise<AxiosResponse<ApiResponse<User>>> =>
    api.post('/users', data),
  
  deleteUser: (id: number): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/users/${id}`),
  
  importUsers: (data: FormData): Promise<AxiosResponse<ApiResponse<{ success: number; failed: number; errors: string[] }>>> =>
    bulkImportApi.post('/users/import', data),
  
  downloadTemplate: (): Promise<AxiosResponse<Blob>> =>
    api.get('/users/template', {
      responseType: 'blob',
    }),
};

// 候补预约相关API
export const waitlistAPI = {
  joinWaitlist: (data: { session_id: number }): Promise<AxiosResponse<ApiResponse<{ waitlist_count: number; user_in_waitlist: boolean }>>> =>
    api.post('/waitlist/join', data),
  
  leaveWaitlist: (data: { session_id: number }): Promise<AxiosResponse<ApiResponse<{ waitlist_count: number; user_in_waitlist: boolean }>>> =>
    api.delete('/waitlist/leave', { data }),
  
  getSessionWaitlist: (sessionId: number): Promise<AxiosResponse<ApiResponse<{ waitlist_count: number; user_in_waitlist: boolean; waitlist: any[] }>>> =>
    api.get(`/waitlist/sessions/${sessionId}`),
  
  getWaitlistStatus: (sessionId: number): Promise<AxiosResponse<ApiResponse<{ waitlist_count: number; user_in_waitlist: boolean }>>> =>
    api.get(`/waitlist/status/${sessionId}`),
};

export default api;
