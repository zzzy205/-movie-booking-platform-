// 用户相关类型
export interface User {
  id: number;
  account: string;
  username: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface LoginRequest {
  account: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// 电影场次相关类型
export interface MovieSession {
  id: number;
  title: string;
  date?: string;
  time?: string;
  startTime?: string; // 兼容旧版本
  duration: number;
  booking_open_time?: string;
  bookingOpenTime?: string; // 兼容旧版本
  max_seats?: number;
  maxSeats?: number; // 兼容旧版本
  status?: 'active' | 'cancelled';
  created_at: string;
  canBook?: boolean; // 是否可以预订
  currentTime?: string; // 当前服务器时间
  // 候补预约相关字段
  waitlist_count?: number; // 候补人数
  is_full?: boolean; // 是否已满
  user_in_waitlist?: boolean; // 当前用户是否在候补中
}

export interface CreateMovieSessionRequest {
  title: string;
  date: string;
  time: string;
  duration: number;
  booking_open_time: string;
  max_seats: number;
}

export interface UpdateMovieSessionRequest {
  id: number;
  title?: string;
  date?: string;
  time?: string;
  duration?: number;
  booking_open_time?: string;
  max_seats?: number;
}

// 座位相关类型
export interface Seat {
  row: number;
  col: number;
  sessionId: string;
  status?: 'available' | 'booked' | 'selected';
  user_id?: number;
}

export interface SeatPosition {
  row: number;
  col: number;
}

// 预订相关类型
export interface Booking {
  id: number;
  user_id: number;
  session_id: number;
  seat_row?: number; // 兼容旧版本
  seat_col?: number; // 兼容旧版本
  seats?: SeatPosition[]; // 新增：支持多个座位
  status: 'active' | 'cancelled';
  created_at: string;
  movie_title?: string;
  session_date?: string;
  session_time?: string;
  cancelled_at?: string; // 新增：取消时间
}

export interface CreateBookingRequest {
  session_id: number;
  seats: SeatPosition[];
}

export interface CancelBookingRequest {
  booking_id: number;
}

export interface CancelSeatsRequest {
  booking_id: number;
  seats: SeatPosition[];
}

// 候补预约相关类型
export interface WaitlistEntry {
  id: number;
  user_id: number;
  session_id: number;
  user_account: string;
  user_username: string;
  status: 'waiting' | 'notified' | 'cancelled';
  created_at: string;
  notified_at?: string;
}

export interface JoinWaitlistRequest {
  session_id: number;
}

export interface LeaveWaitlistRequest {
  session_id: number;
}

export interface WaitlistResponse {
  success: boolean;
  message: string;
  data?: {
    waitlist_count: number;
    user_in_waitlist: boolean;
  };
}

export interface CancelBookingResponse {
  booking_id: number;
  cancelled_seats?: SeatPosition[];
  remaining_seats?: SeatPosition[];
  status: 'active' | 'cancelled';
}

// 公告相关类型
export interface Announcement {
  id: number;
  content: string;
  updated_at: string;
}

export interface UpdateAnnouncementRequest {
  content: string;
}

// 用户管理相关类型
export interface UserImportRequest {
  usernames: string[];
  initial_password: string;
}

export interface UserExportResponse {
  users: User[];
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 分页类型
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: 'seat_update' | 'booking_update' | 'announcement_update';
  data: any;
}

// 座位状态更新
export interface SeatUpdateMessage {
  session_id: number;
  seats: Seat[];
}

// 预订更新
export interface BookingUpdateMessage {
  session_id: number;
  booking: Booking;
}
