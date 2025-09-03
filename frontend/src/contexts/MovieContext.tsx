import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import { movieAPI, bookingAPI } from '../services/api';
import { MovieSession, Seat, Booking } from '../types';

interface MovieContextType {
  // 状态
  sessions: MovieSession[];
  seatStatus: Record<string, any>;
  userBookings: Record<string, Booking[]>;
  
  // 操作
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: number) => Promise<void>;
  createSession: (sessionData: any) => Promise<void>;
  loadSeatStatus: (sessionId: number) => Promise<void>;
  loadUserBookings: (userId: number) => Promise<void>;
  clearSessionData: (sessionId: number) => void;
  
  // 状态检查
  isLoading: boolean;
}

const MovieContext = createContext<MovieContextType | undefined>(undefined);

export const useMovieContext = () => {
  const context = useContext(MovieContext);
  if (!context) {
    throw new Error('useMovieContext must be used within a MovieProvider');
  }
  return context;
};

interface MovieProviderProps {
  children: React.ReactNode;
}

export const MovieProvider: React.FC<MovieProviderProps> = ({ children }) => {
  const [sessions, setSessions] = useState<MovieSession[]>([]);
  const [seatStatus, setSeatStatus] = useState<Record<string, any>>({});
  const [userBookings, setUserBookings] = useState<Record<string, Booking[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  // 加载电影场次
  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await movieAPI.getSessions();
      if (response.data.success) {
        setSessions(response.data.data || []);
      } else {
        console.warn('加载电影场次返回失败:', response.data.message);
        setSessions([]);
      }
    } catch (error: any) {
      console.error('加载电影场次失败:', error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 删除电影场次（核心功能）
  const deleteSession = useCallback(async (sessionId: number) => {
    try {
      setIsLoading(true);
      
      // 1. 调用后端API删除
      const response = await movieAPI.deleteSession(sessionId);
      if (response.data.success) {
        message.success('电影场次删除成功，相关预订记录已清理');
        
        // 2. 完全清理前端所有相关状态
        clearSessionData(sessionId);
        
        // 3. 重新加载场次列表
        await loadSessions();
      } else {
        message.error(response.data.message || '删除失败');
      }
    } catch (error: any) {
      console.error('删除电影场次失败:', error);
      message.error('删除失败');
    } finally {
      setIsLoading(false);
    }
  }, [loadSessions]);

  // 清理指定场次的所有数据
  const clearSessionData = useCallback((sessionId: number) => {
    console.log(`清理场次${sessionId}的所有数据`);
    
    // 清理座位状态
    setSeatStatus(prev => {
      const newStatus: Record<string, any> = {};
      Object.keys(prev).forEach(key => {
        if (!key.startsWith(`${sessionId}-`)) {
          newStatus[key] = prev[key];
        }
      });
      console.log(`座位状态清理完成，从${Object.keys(prev).length}个减少到${Object.keys(newStatus).length}个`);
      return newStatus;
    });
    
    // 清理用户预订
    setUserBookings(prev => {
      const newBookings: Record<string, Booking[]> = {};
      Object.keys(prev).forEach(userId => {
        const userBookings = prev[userId] || [];
        const filteredBookings = userBookings.filter(b => b.session_id !== sessionId);
        if (filteredBookings.length > 0) {
          newBookings[userId] = filteredBookings;
        }
      });
      console.log(`用户预订清理完成，从${Object.keys(prev).length}个用户减少到${Object.keys(newBookings).length}个用户`);
      return newBookings;
    });
  }, []);

  // 创建电影场次
  const createSession = useCallback(async (sessionData: any) => {
    try {
      setIsLoading(true);
      const response = await movieAPI.createSession(sessionData);
      if (response.data.success) {
        message.success('电影场次创建成功');
        await loadSessions();
      } else {
        message.error(response.data.message || '创建失败');
      }
    } catch (error: any) {
      console.error('创建电影场次失败:', error);
      message.error('创建失败');
    } finally {
      setIsLoading(false);
    }
  }, [loadSessions]);

  // 加载座位状态
  const loadSeatStatus = useCallback(async (sessionId: number) => {
    try {
      console.log(`开始加载场次${sessionId}的座位状态`);
      const response = await bookingAPI.getSeats(sessionId);
      console.log(`座位状态API响应:`, response.data);
      
      if (response.data.success && response.data.data) {
        const newSeatStatus: Record<string, any> = {};
        if (response.data.data.seats && Array.isArray(response.data.data.seats)) {
          response.data.data.seats.forEach((seat: any) => {
            if (seat && typeof seat.row === 'number' && typeof seat.col === 'number') {
              const seatKey = `${sessionId}-${seat.row}-${seat.col}`;
              newSeatStatus[seatKey] = {
                booked: true,
                userId: seat.user_id,
                sessionId: sessionId
              };
            }
          });
        }
        
        console.log(`场次${sessionId}座位状态数据:`, {
          totalSeats: response.data.data.seats?.length || 0,
          newSeatStatus,
          newSeatStatusKeys: Object.keys(newSeatStatus).length
        });
        
        setSeatStatus(prev => {
          const updated = { ...prev, ...newSeatStatus };
          console.log(`座位状态更新:`, {
            prevKeys: Object.keys(prev).length,
            newKeys: Object.keys(newSeatStatus).length,
            updatedKeys: Object.keys(updated).length
          });
          return updated;
        });
      } else {
        console.warn(`场次${sessionId}座位状态加载失败:`, response.data.message);
      }
    } catch (error) {
      console.error('加载座位状态失败:', error);
    }
  }, []);

  // 加载用户预订
  const loadUserBookings = useCallback(async (userId: number) => {
    try {
      console.log(`开始加载用户${userId}的预订信息`);
      const response = await bookingAPI.getUserBookings();
      console.log(`用户预订API响应:`, response.data);
      
      if (response.data.success) {
        const userBookingsList = response.data.data || [];
        console.log(`用户${userId}预订数据:`, {
          totalBookings: userBookingsList.length,
          bookings: userBookingsList
        });
        
        setUserBookings(prev => {
          const updated = {
            ...prev,
            [userId]: userBookingsList
          };
          console.log(`用户预订状态更新:`, {
            prevUsers: Object.keys(prev).length,
            currentUserBookings: userBookingsList.length,
            updatedUsers: Object.keys(updated).length
          });
          return updated;
        });
      } else {
        console.warn(`用户${userId}预订加载失败:`, response.data.message);
      }
    } catch (error) {
      console.error('加载用户预订失败:', error);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const value: MovieContextType = {
    sessions,
    seatStatus,
    userBookings,
    loadSessions,
    deleteSession,
    createSession,
    loadSeatStatus,
    loadUserBookings,
    clearSessionData,
    isLoading
  };

  return (
    <MovieContext.Provider value={value}>
      {children}
    </MovieContext.Provider>
  );
};
