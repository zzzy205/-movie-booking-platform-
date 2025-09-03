import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Modal, Typography, Space, message, Card, Popconfirm } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMovieContext } from '../../contexts/MovieContext';
import { Seat, Booking, SeatPosition } from '../../types';
import { bookingAPI, waitlistAPI } from '../../services/api';
import './index.css';

const { Text } = Typography;

interface SeatGridProps {
  sessionId: string;
  maxSeats: number;
  onBookingSubmit: (seats: Seat[]) => Promise<void>;
  movieTitle: string;
  startTime: string;
  bookingOpenTime: string;
  currentUserId: number;
}

const SeatGrid: React.FC<SeatGridProps> = ({ 
  sessionId, 
  maxSeats, 
  onBookingSubmit, 
  movieTitle, 
  startTime, 
  bookingOpenTime,
  currentUserId 
}) => {
  const navigate = useNavigate();
  const { seatStatus, userBookings, loadSeatStatus, loadUserBookings } = useMovieContext();
  

  
  // 本地状态
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [seatStatusLoaded, setSeatStatusLoaded] = useState(false);
  const [lastLoadTime, setLastLoadTime] = useState(0);
  
  // 场次投票相关状态
  const [waitlistCount, setWaitlistCount] = useState<number>(0);
  const [userInWaitlist, setUserInWaitlist] = useState<boolean>(false);
  const [waitlistLoading, setWaitlistLoading] = useState<boolean>(false);

  // 使用ref来存储最新的状态值，避免闭包问题
  const seatStatusRef = useRef(seatStatus);
  const userBookingsRef = useRef(userBookings);
  
  // 更新ref值
  useEffect(() => {
    seatStatusRef.current = seatStatus;
  }, [seatStatus]);
  
  useEffect(() => {
    userBookingsRef.current = userBookings;
  }, [userBookings]);

  // 当sessionId变化时，清理旧的座位状态缓存
  useEffect(() => {
    if (sessionId !== currentSessionId) {
      console.log(`场次ID变化，清理座位状态缓存: ${currentSessionId} -> ${sessionId}`);
      
      // 完全清理所有相关状态
      setCurrentSessionId(sessionId);
      setSelectedSeats([]);
      setSeatStatusLoaded(false);
      setLastLoadTime(0);
      
      // 强制重新加载座位状态
      setTimeout(() => {
        if (sessionId && sessionId === currentSessionId) {
          console.log('强制重新加载座位状态');
          loadSeatStatus(parseInt(sessionId));
        }
      }, 100);
    }
  }, [sessionId, currentSessionId, loadSeatStatus]);

  // 组件卸载时清理缓存
  useEffect(() => {
    return () => {
      console.log('SeatGrid组件卸载，清理所有缓存');
      setSeatStatusLoaded(false);
      setSelectedSeats([]);
    };
  }, []);

  // 检查电影是否已经开场
  const isMovieStarted = useCallback(() => {
    if (!startTime) return false;
    
    const now = new Date();
    const movieStartTime = new Date(startTime);
    
    // 如果当前时间已经超过电影开始时间，则认为电影已开场
    return now >= movieStartTime;
  }, [startTime]);

  // 防抖函数：避免频繁API调用
  const debounceLoad = useCallback((func: () => Promise<void>, delay: number = 1000) => {
    const now = Date.now();
    if (now - lastLoadTime < delay) {
      console.log('API调用被防抖阻止');
      return;
    }
    setLastLoadTime(now);
    func();
  }, [lastLoadTime]);

  // 加载座位状态
  const loadSeatStatusFromContext = useCallback(async () => {
    if (!sessionId || sessionId !== currentSessionId) {
      console.log('场次ID不匹配，跳过座位状态加载');
      return;
    }
    
    try {
      setLoading(true);
      console.log(`开始加载场次${sessionId}的座位状态`);
      
      await loadSeatStatus(parseInt(sessionId));
      setSeatStatusLoaded(true);
      console.log(`场次${sessionId}座位状态加载完成`);
      
      // 调试：检查加载后的座位状态 - 使用ref避免闭包问题
      setTimeout(() => {
        const currentSeatStatus = seatStatusRef.current;
        console.log('座位状态加载后检查:', {
          currentSeatStatus,
          seatStatusKeys: Object.keys(currentSeatStatus).length,
          seatStatusValues: Object.values(currentSeatStatus)
        });
      }, 100);
      
    } catch (error) {
      console.error('加载座位状态失败:', error);
      setSeatStatusLoaded(true);
    } finally {
      if (sessionId === currentSessionId) {
        setLoading(false);
      }
    }
  }, [sessionId, currentSessionId, loadSeatStatus]);

  // 加载用户预订信息
  const loadUserBookingsFromContext = useCallback(async () => {
    if (!sessionId || !currentUserId || sessionId !== currentSessionId) {
      console.log('条件不满足，跳过用户预订加载');
      return;
    }
    
    try {
      console.log(`开始加载场次${sessionId}的用户预订`);
      await loadUserBookings(currentUserId);
      console.log(`场次${sessionId}用户预订加载完成`);
      
      // 调试：检查加载后的用户预订 - 使用ref避免闭包问题
      setTimeout(() => {
        const currentUserBookings = userBookingsRef.current;
        console.log('用户预订加载后检查:', {
          currentUserBookings,
          userBookingsKeys: Object.keys(currentUserBookings).length,
          currentUserId,
          currentUserBookingsData: currentUserBookings[currentUserId]
        });
      }, 100);
    } catch (error) {
      console.error('加载用户预订失败:', error);
    }
  }, [sessionId, currentUserId, currentSessionId, loadUserBookings]);

  // 加载场次投票信息
  const loadWaitlistInfo = useCallback(async () => {
    if (!sessionId || sessionId !== currentSessionId) {
      return;
    }
    
    try {
      setWaitlistLoading(true);
      const response = await waitlistAPI.getWaitlistStatus(parseInt(sessionId));
      if (response.data.success && response.data.data) {
        setWaitlistCount(response.data.data.waitlist_count);
        setUserInWaitlist(response.data.data.user_in_waitlist);
      }
    } catch (error) {
      console.error('加载投票信息失败:', error);
    } finally {
      setWaitlistLoading(false);
    }
  }, [sessionId, currentSessionId]);

  // 投票支持场次
  const handleJoinWaitlist = async () => {
    try {
      setWaitlistLoading(true);
      const response = await waitlistAPI.joinWaitlist({ session_id: parseInt(sessionId) });
      if (response.data.success && response.data.data) {
        message.success('投票成功！感谢您的支持');
        setUserInWaitlist(true);
        setWaitlistCount(response.data.data.waitlist_count);
      } else {
        message.error(response.data.message || '投票失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '投票失败');
    } finally {
      setWaitlistLoading(false);
    }
  };

  // 取消投票
  const handleLeaveWaitlist = async () => {
    try {
      setWaitlistLoading(true);
      const response = await waitlistAPI.leaveWaitlist({ session_id: parseInt(sessionId) });
      if (response.data.success && response.data.data) {
        message.success('已取消投票');
        setUserInWaitlist(false);
        setWaitlistCount(response.data.data.waitlist_count);
      } else {
        message.error(response.data.message || '取消投票失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '取消投票失败');
    } finally {
      setWaitlistLoading(false);
    }
  };

  // 加载座位状态和用户预订
  useEffect(() => {
    if (sessionId && !seatStatusLoaded && sessionId === currentSessionId) {
      debounceLoad(loadSeatStatusFromContext, 500);
    }
  }, [sessionId, seatStatusLoaded, currentSessionId, debounceLoad, loadSeatStatusFromContext]);

  // 加载场次投票信息
  useEffect(() => {
    if (sessionId && sessionId === currentSessionId) {
      loadWaitlistInfo();
    }
  }, [sessionId, currentSessionId, loadWaitlistInfo]);

  // 只在有用户ID时加载用户预订
  useEffect(() => {
    if (sessionId && currentUserId && sessionId === currentSessionId) {
      debounceLoad(loadUserBookingsFromContext, 1000);
    }
  }, [sessionId, currentUserId, currentSessionId, debounceLoad, loadUserBookingsFromContext]);

  // 预订成功后重新加载座位状态
  const refreshSeatStatus = useCallback(async () => {
    if (sessionId && sessionId === currentSessionId) {
      console.log(`刷新场次${sessionId}的座位状态`);
      
      // 并行加载座位状态和用户预订，提高性能
      await Promise.all([
        loadSeatStatus(parseInt(sessionId)),
        loadUserBookings(currentUserId)
      ]);
      
      // 标记状态已加载
      setSeatStatusLoaded(true);
    }
  }, [sessionId, currentSessionId, loadSeatStatus, loadUserBookings, currentUserId]);

  const handleSeatClick = (row: number, col: number) => {
    // 检查电影是否已经开场
    if (isMovieStarted()) {
      message.warning('电影已经开始，无法进行座位选择操作');
      return;
    }
    
    // 确保只在当前场次中操作
    if (sessionId !== currentSessionId) {
      console.log('场次不匹配，忽略座位点击');
      return;
    }
    
    const seatKey = `${sessionId}-${row}-${col}`;
    const seat: Seat = { row, col, sessionId };
    
    if (seatStatus[seatKey]?.booked) {
      message.warning('该座位已被预订');
      return;
    }

    const isSelected = selectedSeats.some(s => s.row === row && s.col === col);
    
    if (isSelected) {
      // 取消选择
      setSelectedSeats(selectedSeats.filter(s => !(s.row === row && s.col === col)));
    } else {
      // 检查用户是否还能预订更多座位
      if (!canBookMoreSeats()) {
        message.warning(`您在该场次已预订了${getCurrentSessionBookedSeatsCount()}个座位，已达到每场电影最多${maxSeats}个座位的限制`);
        return;
      }
      
      // 检查选择数量是否超过剩余可预订数量
      const remainingSeats = getRemainingSeatsCount();
      if (selectedSeats.length >= remainingSeats) {
        message.warning(`您在该场次还能预订${remainingSeats}个座位，当前已选择${selectedSeats.length}个`);
        return;
      }
      
      // 选择座位
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  // 取消预订
  const handleCancelBooking = async (bookingId: number, seats: SeatPosition[]) => {
    // 检查电影是否已经开场
    if (isMovieStarted()) {
      message.warning('电影已经开始，无法取消预订');
      return;
    }
    
    try {
      setLoading(true);
      console.log(`[SeatGrid] 开始取消预订:`, { bookingId, seats, sessionId });
      
      const response = await bookingAPI.cancelSeats({
        booking_id: bookingId,
        seats: seats
      });
      
      if (response.data.success) {
        console.log(`[SeatGrid] 取消成功，响应数据:`, response.data);
        message.success('座位取消成功！');
        
        // 立即清理本地状态，避免显示已取消的预订
        setSelectedSeats([]);
        
        // 强制刷新座位状态和用户预订，确保显示最新状态
        console.log(`[SeatGrid] 开始刷新数据...`);
        
        // 先刷新座位状态
        await loadSeatStatus(parseInt(sessionId));
        console.log(`[SeatGrid] 座位状态刷新完成`);
        
        // 再刷新用户预订，确保获取最新数据
        await loadUserBookings(currentUserId);
        console.log(`[SeatGrid] 用户预订刷新完成`);
        
        // 标记座位状态已加载，避免重复加载
        setSeatStatusLoaded(true);
        
        // 强制重新渲染，确保UI更新
        setTimeout(() => {
          console.log(`[SeatGrid] 强制重新渲染，当前用户预订:`, userBookings[currentUserId]);
          setSelectedSeats([]);
          
          // 再次检查数据是否正确刷新
          console.log(`[SeatGrid] 取消后的最终检查:`, {
            userBookings: userBookings[currentUserId],
            validBookings: userBookings[currentUserId]?.filter(b => 
              b.status === 'active' && 
              b.seats && 
              Array.isArray(b.seats) &&
              b.seats.length > 0 &&
              b.session_id === parseInt(sessionId)
            ),
            message: '如果全部取消，预订记录应该完全消失'
          });
        }, 100);
      } else {
        console.log(`[SeatGrid] 取消失败:`, response.data);
        message.error(response.data.message || '取消失败');
      }
    } catch (error: any) {
      console.error(`[SeatGrid] 取消预订异常:`, error);
      message.error(error.response?.data?.message || '取消失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBooking = () => {
    if (selectedSeats.length === 0) {
      message.warning('请至少选择一个座位');
      return;
    }

    // 检查电影是否已经开场
    if (isMovieStarted()) {
      message.warning('电影已经开始，无法进行预订操作');
      return;
    }

    // 🚨 安全提醒：预约时间验证由服务器端进行，防止客户端时间篡改
    // 客户端不进行时间验证，直接提交到服务器验证

    // 检查总座位数量是否超过限制
    const currentBookedCount = getCurrentSessionBookedSeatsCount();
    const totalSeatsAfterBooking = currentBookedCount + selectedSeats.length;
    
    if (totalSeatsAfterBooking > maxSeats) {
      message.error(`预订失败！您在该场次已预订${currentBookedCount}个座位，本次选择${selectedSeats.length}个，总计${totalSeatsAfterBooking}个，超过每场电影最多${maxSeats}个座位的限制`);
      return;
    }

    setIsModalVisible(true);
  };

  const handleSubmitBooking = async () => {
    if (isSubmitting) {
      message.warning('正在处理中，请勿重复提交');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setLoading(true);
      
      // 调用预订API
      await onBookingSubmit(selectedSeats);
      
      // 如果没有抛出异常，说明预订成功
      // 预订成功后的处理
      setSelectedSeats([]);
      setIsModalVisible(false);
      await refreshSeatStatus();
      
      // 显示成功消息并引导用户到个人中心
      message.success({
        content: (
          <div>
            <div>🎉 预订成功！共预订 {selectedSeats.length} 个座位</div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              💡 请到个人中心查看详细的票务信息和二维码
            </div>
          </div>
        ),
        duration: 5, // 显示5秒，给用户足够时间阅读
      });
      
    } catch (error: any) {
      console.error('预订失败:', error);
      
      // 根据错误类型显示不同的提示
      if (error.response?.data?.message) {
        message.error(`预订失败：${error.response.data.message}`);
      } else if (error.message && error.message.includes('座位已被预订')) {
        message.error('预订失败：部分座位已被其他用户预订，请重新选择座位');
      } else {
        message.error('预订失败，请重试');
      }
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  // 渲染座位
  const renderSeat = (row: number, col: number) => {
    // 确保只在当前场次中渲染
    if (sessionId !== currentSessionId) {
      return null;
    }
    
    // 修复：使用与MovieContext一致的键值格式
    const seatKey = `${sessionId}-${row}-${col}`;
    const seatInfo = seatStatus[seatKey];
    
    let seatClass = 'seat';
    let isDisabled = false;
    let disabledReason = '';
    
    if (seatInfo?.booked) {
      // 检查是否是当前用户的预订
      const isOwnBooking = seatInfo.userId === currentUserId;
      if (isOwnBooking) {
        seatClass += ' own-booking'; // 绿色：我的预订
        isDisabled = true;
      } else {
        seatClass += ' booked'; // 红色：他人预订
        isDisabled = true;
      }
    } else {
      const isSelected = selectedSeats.some(s => s.row === row && s.col === col);
      if (isSelected) {
        seatClass += ' selected'; // 蓝色：已选择
      } else {
        // 检查是否因为预订限制而禁用
        if (!canBookMoreSeats()) {
          seatClass += ' disabled'; // 灰色：因限制禁用
          isDisabled = true;
          disabledReason = `已达到每场电影最多${maxSeats}个座位的限制`;
        } else {
          seatClass += ' available'; // 白色：可选
        }
      }
    }
    
    // 如果电影已经开始，所有未预订的座位都应该被禁用
    if (isMovieStarted() && !seatInfo?.booked) {
      isDisabled = true;
      disabledReason = '电影已经开始，无法选择座位';
    }

    return (
      <Button
        key={`${row}-${col}`}
        className={seatClass}
        disabled={isDisabled}
        title={disabledReason || (seatInfo?.booked ? '座位已被预订' : '点击选择座位')}
        onClick={() => !isDisabled && handleSeatClick(row, col)}
      >
        {col}
      </Button>
    );
  };

  // 渲染用户预订信息
  const renderUserBookings = () => {
    // 确保只在有实际预订且座位数量大于0时显示
    if (!userBookings[currentUserId] || userBookings[currentUserId].length === 0) return null;
    
    // 过滤掉已取消的预订、没有座位的预订，以及状态不是active的预订
    const validBookings = userBookings[currentUserId].filter(booking => {
      // 严格过滤条件：只显示有效的、有座位的、当前场次的预订
      const isValid = booking.status === 'active' && 
        booking.seats && 
        Array.isArray(booking.seats) &&
        booking.seats.length > 0 &&
        booking.session_id === parseInt(sessionId);
      
      // 详细调试每个预订的过滤结果
      if (!isValid) {
        console.log(`[SeatGrid] 预订${booking.id}被过滤掉:`, {
          status: booking.status,
          hasSeats: !!booking.seats,
          isArray: Array.isArray(booking.seats),
          seatsLength: booking.seats?.length || 0,
          sessionId: booking.session_id,
          currentSessionId: sessionId,
          sessionIdMatch: booking.session_id === parseInt(sessionId),
          reason: !booking.status || booking.status !== 'active' ? '状态不是active' :
                  !booking.seats ? '没有座位信息' :
                  !Array.isArray(booking.seats) ? '座位不是数组' :
                  booking.seats.length === 0 ? '座位数量为0' :
                  booking.session_id !== parseInt(sessionId) ? '不是当前场次' : '未知原因'
        });
      }
      
      return isValid;
    });
    
    // 调试日志：显示过滤前后的预订数量
    console.log(`[SeatGrid] 用户${currentUserId}的预订过滤:`, {
      total: userBookings[currentUserId]?.length || 0,
      valid: validBookings.length,
      sessionId: sessionId,
      bookings: userBookings[currentUserId]?.map(b => ({
        id: b.id,
        status: b.status,
        seatsCount: b.seats?.length || 0,
        sessionId: b.session_id,
        isValid: b.status === 'active' && 
          b.seats && 
          Array.isArray(b.seats) &&
          b.seats.length > 0 &&
          b.session_id === parseInt(sessionId)
      }))
    });
    
    if (validBookings.length === 0) return null;

    return (
      <div className="user-bookings" style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '8px',
          padding: '8px 12px',
          background: '#f0f9ff',
          borderRadius: '6px',
          border: '1px solid #91d5ff'
        }}>
          <Text strong style={{ fontSize: '14px' }}>我的预订</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            共{validBookings.length}个预订
          </Text>
        </div>
        
        {validBookings.map((booking: Booking) => (
          <div key={booking.id} style={{ 
            padding: '8px 12px', 
            marginBottom: '6px', 
            background: '#fafafa', 
            borderRadius: '6px',
            border: '1px solid #e8e8e8'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              {/* 按钮放在前面 */}
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {/* 部分取消按钮 */}
                {booking.seats && booking.seats.length > 1 && (
                  <Button 
                    type="text" 
                    size="small"
                    style={{ padding: '2px 6px', height: '24px', fontSize: '12px' }}
                    disabled={isMovieStarted()}
                    onClick={() => showPartialCancelModal(booking)}
                    title={isMovieStarted() ? '电影已经开始，无法取消预订' : '部分取消预订'}
                  >
                    部分取消
                  </Button>
                )}
                
                {/* 全部取消按钮 */}
                <Popconfirm
                  title={isMovieStarted() ? "电影已经开始，无法取消预订" : "确定要取消所有座位吗？"}
                  onConfirm={() => handleCancelBooking(booking.id, booking.seats || [])}
                  okText="确定"
                  cancelText="取消"
                  disabled={isMovieStarted()}
                >
                  <Button 
                    type="text" 
                    danger 
                    size="small"
                    style={{ padding: '2px 6px', height: '24px', fontSize: '12px' }}
                    disabled={isMovieStarted()}
                    title={isMovieStarted() ? '电影已经开始，无法取消预订' : '取消所有预订'}
                  >
                    全部取消
                  </Button>
                </Popconfirm>
              </div>
              
              {/* 座位信息放在后面 */}
              <Text style={{ fontSize: '13px', flex: 1 }}>
                座位: {booking.seats?.map((seat: any) => 
                  `${seat.row}排${seat.col}号`
                ).join(', ')}
              </Text>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 显示部分取消模态框
  const [partialCancelModal, setPartialCancelModal] = useState<{
    visible: boolean;
    booking: Booking | null;
    selectedSeats: SeatPosition[];
  }>({
    visible: false,
    booking: null,
    selectedSeats: []
  });

  const showPartialCancelModal = (booking: Booking) => {
    // 检查电影是否已经开场
    if (isMovieStarted()) {
      message.warning('电影已经开始，无法取消预订');
      return;
    }
    
    setPartialCancelModal({
      visible: true,
      booking,
      selectedSeats: []
    });
  };

  const handlePartialCancel = async () => {
    // 检查电影是否已经开场
    if (isMovieStarted()) {
      message.warning('电影已经开始，无法取消预订');
      setPartialCancelModal({ visible: false, booking: null, selectedSeats: [] });
      return;
    }
    
    if (!partialCancelModal.booking || partialCancelModal.selectedSeats.length === 0) {
      message.warning('请选择要取消的座位');
      return;
    }

    try {
      setLoading(true);
      const response = await bookingAPI.cancelSeats({
        booking_id: partialCancelModal.booking.id,
        seats: partialCancelModal.selectedSeats
      });
      
      if (response.data.success) {
        message.success(`成功取消${partialCancelModal.selectedSeats.length}个座位！`);
        
        // 立即清理模态框状态
        setPartialCancelModal({ visible: false, booking: null, selectedSeats: [] });
        
        // 清理本地选择状态
        setSelectedSeats([]);
        
        // 强制刷新座位状态和用户预订
        await Promise.all([
          loadSeatStatus(parseInt(sessionId)),
          loadUserBookings(currentUserId)
        ]);
        
        // 标记座位状态已加载，避免重复加载
        setSeatStatusLoaded(true);
        
        // 强制重新渲染，确保UI立即更新
        setSelectedSeats([]);
      } else {
        message.error(response.data.message || '取消失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '取消失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePartialCancelSeatSelect = (seat: SeatPosition) => {
    const isSelected = partialCancelModal.selectedSeats.some(s => 
      s.row === seat.row && s.col === seat.col
    );
    
    if (isSelected) {
      setPartialCancelModal(prev => ({
        ...prev,
        selectedSeats: prev.selectedSeats.filter(s => 
          !(s.row === seat.row && s.col === seat.col)
        )
      }));
    } else {
      setPartialCancelModal(prev => ({
        ...prev,
        selectedSeats: [...prev.selectedSeats, seat]
      }));
    }
  };

  const renderRowLabel = (row: number) => (
    <div className="row-label">
      第{row}排
    </div>
  );

  // 计算用户在当前场次已预订的座位总数
  const getCurrentSessionBookedSeatsCount = useCallback(() => {
    if (!sessionId || !userBookings[currentUserId]) {
      return 0;
    }
    
    let totalBookedSeats = 0;
    userBookings[currentUserId].forEach((booking: Booking) => {
      if (booking.session_id === parseInt(sessionId) && booking.status === 'active') {
        if (booking.seats && Array.isArray(booking.seats)) {
          totalBookedSeats += booking.seats.length;
        }
      }
    });
    
    return totalBookedSeats;
  }, [sessionId, userBookings, currentUserId]);

  // 检查用户是否还能预订更多座位
  const canBookMoreSeats = useCallback(() => {
    const currentBookedCount = getCurrentSessionBookedSeatsCount();
    const remainingSeats = maxSeats - currentBookedCount;
    return remainingSeats > 0;
  }, [getCurrentSessionBookedSeatsCount, maxSeats]);

  // 获取用户还能预订的座位数量
  const getRemainingSeatsCount = useCallback(() => {
    const currentBookedCount = getCurrentSessionBookedSeatsCount();
    return Math.max(0, maxSeats - currentBookedCount);
  }, [getCurrentSessionBookedSeatsCount, maxSeats]);

  // 渲染预订状态信息
  const renderBookingStatusInfo = () => {
    const currentBookedCount = getCurrentSessionBookedSeatsCount();
    const remainingSeats = getRemainingSeatsCount();
    
    return (
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px 16px', 
        background: '#f6f8fa', 
        borderRadius: '8px',
        border: '1px solid #e1e4e8'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong>预订状态: </Text>
            <Text>您在该场次已预订 <Text type="success" strong>{currentBookedCount}</Text> 个座位</Text>
          </div>
          <div>
            <Text>还可预订: </Text>
            <Text type={remainingSeats > 0 ? 'success' : 'danger'} strong>{remainingSeats}</Text>
            <Text> 个座位</Text>
          </div>
        </div>
        
        {/* 显示电影开始时间 */}
        <div style={{ marginTop: '8px', fontSize: '12px' }}>
          <Text type="secondary">
            电影开始时间: {startTime ? new Date(startTime).toLocaleString('zh-CN') : '未知'}
            {isMovieStarted() && (
              <Text type="warning" style={{ marginLeft: '8px' }}>
                (已开始)
              </Text>
            )}
          </Text>
        </div>
        {remainingSeats === 0 && (
          <div style={{ marginTop: '8px' }}>
            <Text type="warning">⚠️ 您已达到每场电影最多{maxSeats}个座位的限制，无法继续预订</Text>
          </div>
        )}
        
        {/* 添加个人中心引导提示 */}
        {currentBookedCount > 0 && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px 12px', 
            background: '#e6f7ff', 
            borderRadius: '6px',
            border: '1px solid #91d5ff'
          }}>
            <Text>
              📋 查看详细票务信息、二维码和座位详情，请前往 
              <Text strong style={{ color: '#1890ff', cursor: 'pointer' }} 
                    onClick={() => navigate('/profile')}>
                个人中心
              </Text>
            </Text>
            <div style={{ 
              marginTop: '8px', 
              padding: '8px 12px', 
              background: '#fff2f0', 
              borderRadius: '6px',
              border: '1px solid #ffccc7'
            }}>
              <Text style={{ 
                color: '#cf1322', 
                fontSize: '13px', 
                fontWeight: 'bold' 
              }}>
                ⚠️ 重要提醒：请将票务详情用手机拍照留存，凭票务信息入场自觉对号入座
              </Text>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="seat-grid-container">
      <div className="screen">
        银幕
      </div>
      
      {renderBookingStatusInfo()}
      
      {/* 电影开场状态提示 */}
      {isMovieStarted() && (
        <div style={{ 
          marginBottom: '16px', 
          padding: '12px 16px', 
          background: '#fff2e8', 
          borderRadius: '8px',
          border: '1px solid #ffbb96'
        }}>
          <Text type="warning" strong>
            ⚠️ 电影已经开始，无法进行预订和取消操作
          </Text>
        </div>
      )}
      
      {renderUserBookings()}
      
      <div className="seat-grid">
        <div className="seats-rows">
          {Array.from({ length: 10 }, (_, row) => (
            <div key={`row-${row + 1}`} className="seat-row">
              <div className="row-label">第{['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][row]}排</div>
              <div className="seats-container">
                {Array.from({ length: 12 }, (_, index) => renderSeat(row + 1, index + 1))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="legend-seat available"></div>
          <Text>可选</Text>
        </div>
        <div className="legend-item">
          <div className="legend-seat selected"></div>
          <Text>已选</Text>
        </div>
        <div className="legend-item">
          <div className="legend-seat booked"></div>
          <Text>已订</Text>
        </div>
        <div className="legend-item">
          <div className="legend-seat own-booking"></div>
          <Text>我的</Text>
        </div>
      </div>

      <div className="selection-info">
        <Text>已选择 {selectedSeats.length}/{maxSeats} 个座位</Text>
        {selectedSeats.length > 0 && (
          <Space style={{ marginTop: '8px' }}>
            <Text>座位: {selectedSeats.map(s => `第${s.row}排${s.col}号`).join(', ')}</Text>
            <Button type="primary" onClick={handleConfirmBooking}>
              确认预订
            </Button>
          </Space>
        )}
      </div>

      {/* 场次投票功能 */}
      <div className="waitlist-section" style={{ 
        marginTop: '24px', 
        padding: '16px', 
        background: '#f8f9fa', 
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <Text strong>场次投票</Text>
          <Text type="secondary">当前投票人数: {waitlistCount}</Text>
        </div>
        
        {/* 投票功能：座位已满时显示，座位未满时引导预订 */}
        {(() => {
          const hasBookedSeats = userBookings[currentUserId]?.some(booking => 
            booking.session_id === parseInt(sessionId) && 
            booking.status === 'active'
          );
          
          // 检查座位是否已满 - 使用更可靠的数据源
          const totalSeats = maxSeats || 0;
          
          // 方法1：从座位状态计算（修正后的逻辑）
          const bookedSeatsFromStatus = Object.values(seatStatus).filter(status => 
            status && typeof status === 'object' && status.booked === true
          ).length;
          
          // 方法2：从用户预订数据计算（更准确）
          const allBookings = Object.values(userBookings).flat();
          const sessionBookings = allBookings.filter(booking => 
            booking.session_id === parseInt(sessionId) && 
            booking.status === 'active'
          );
          const bookedSeatsFromBookings = sessionBookings.reduce((total, booking) => {
            const seatCount = booking.seats?.length || 0;
            console.log('预订详情:', { booking, seatCount });
            return total + seatCount;
          }, 0);
          
          // 使用更大的数值作为已预订座位数
          const bookedSeatsCount = Math.max(bookedSeatsFromStatus, bookedSeatsFromBookings);
          const isFull = bookedSeatsCount >= totalSeats;
          
          // 调试信息
          console.log('座位状态检查:', {
            sessionId,
            totalSeats,
            bookedSeatsFromStatus,
            bookedSeatsFromBookings,
            bookedSeatsCount,
            isFull,
            seatStatusKeys: Object.keys(seatStatus).length,
            userBookingsKeys: Object.keys(userBookings).length,
            seatStatus: seatStatus,
            userBookings: userBookings,
            currentUserId
          });
          
          // 用户已预订座位
          if (hasBookedSeats) {
            return (
              <div style={{ 
                padding: '12px', 
                background: '#e6f7ff', 
                borderRadius: '6px',
                border: '1px solid #91d5ff'
              }}>
                <Text style={{ color: '#1890ff' }}>
                  ✅ 您已预订该场次座位，无需投票
                </Text>
                {/* 调试信息 */}
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#1890ff', fontStyle: 'italic' }}>
                  📊 调试: 状态({bookedSeatsFromStatus}) + 预订({bookedSeatsFromBookings}) = {bookedSeatsCount}
                </div>
              </div>
            );
          }
          
          // 用户已投票
          if (userInWaitlist) {
            return (
              <div style={{ 
                padding: '12px', 
                background: '#f6ffed', 
                borderRadius: '6px',
                border: '1px solid #b7eb8f'
              }}>
                <Text type="success">
                  📋 您已投票支持该场次
                </Text>
                <Button 
                  type="default" 
                  size="small" 
                  style={{ marginLeft: '12px' }}
                  onClick={handleLeaveWaitlist}
                  loading={waitlistLoading}
                >
                  取消投票
                </Button>
                {/* 调试信息 */}
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#52c41a', fontStyle: 'italic' }}>
                  📊 调试: 状态({bookedSeatsFromStatus}) + 预订({bookedSeatsFromBookings}) = {bookedSeatsCount}
                </div>
              </div>
            );
          }
          
          // 座位已满：引导用户投票
          if (isFull) {
            return (
              <div style={{ 
                padding: '12px', 
                background: '#fff7e6', 
                borderRadius: '6px',
                border: '1px solid #ffd591'
              }}>
                <Text type="warning">
                  💡 场次座位已满，您可以投票支持加场
                </Text>
                <Button 
                  type="primary" 
                  size="small" 
                  style={{ marginLeft: '12px' }}
                  onClick={handleJoinWaitlist}
                  loading={waitlistLoading}
                >
                  场次投票
                </Button>
                {/* 调试信息 */}
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#fa8c16', fontStyle: 'italic' }}>
                  📊 调试: 状态({bookedSeatsFromStatus}) + 预订({bookedSeatsFromBookings}) = {bookedSeatsCount}
                </div>
                <div style={{ marginTop: '4px', fontSize: '10px', color: '#ccc', fontStyle: 'italic' }}>
                  🔍 详细: seatStatus({Object.keys(seatStatus).length}个), userBookings({Object.keys(userBookings).length}个用户)
                </div>
                <div style={{ marginTop: '4px', fontSize: '10px', color: '#ccc', fontStyle: 'italic' }}>
                  📋 预订数据: 总预订({allBookings.length}个), 场次预订({sessionBookings.length}个), 座位数({bookedSeatsFromBookings}个)
                </div>
              </div>
            );
          }
          
          // 座位未满：引导用户预订
          return (
            <div style={{ 
              padding: '12px', 
              background: '#f0f0f0', 
              borderRadius: '6px',
              border: '1px solid #d9d9d9'
            }}>
              <Text style={{ color: '#666' }}>
                🎬 场次座位未满，您可以选择座位预订
              </Text>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                当前已预订: {bookedSeatsCount}/{totalSeats} 个座位
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#1890ff' }}>
                💡 请在上方选择您想要的座位进行预订
              </div>
              {/* 调试信息 */}
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#999', fontStyle: 'italic' }}>
                📊 调试: 状态({bookedSeatsFromStatus}) + 预订({bookedSeatsFromBookings}) = {bookedSeatsCount}
              </div>
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#ccc', fontStyle: 'italic' }}>
                🔍 详细: seatStatus({Object.keys(seatStatus).length}个), userBookings({Object.keys(userBookings).length}个用户)
              </div>
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#ccc', fontStyle: 'italic' }}>
                📋 预订数据: 总预订({allBookings.length}个), 场次预订({sessionBookings.length}个), 座位数({bookedSeatsFromBookings}个)
              </div>
            </div>
          );
        })()}
      </div>

      {/* Removed ticketInfo and ticketModalVisible */}

      <Modal
        title="确认预订"
        open={isModalVisible}
        onOk={handleSubmitBooking}
        onCancel={() => setIsModalVisible(false)}
        okText="确认预订"
        cancelText="取消"
      >
        <div>
          <h4>预订信息</h4>
          <ul>
            {selectedSeats.map((seat, index) => (
              <li key={index}>第{seat.row}排{seat.col}号</li>
            ))}
          </ul>
          <Text>确认预订这些座位吗？</Text>
          
          {/* 添加引导提示 */}
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            background: '#fff7e6', 
            borderRadius: '6px',
            border: '1px solid #ffd591'
          }}>
            <Text style={{ color: '#d46b08' }}>
              💡 预订成功后，请到个人中心查看详细的票务信息、二维码和座位详情
            </Text>
          </div>
        </div>
      </Modal>

      {/* 部分取消预订模态框 */}
      <Modal
        title="部分取消预订"
        open={partialCancelModal.visible}
        onOk={handlePartialCancel}
        onCancel={() => setPartialCancelModal({ ...partialCancelModal, visible: false })}
        okText="确认取消"
        cancelText="取消"
        width={400}
      >
        <div>
          <div style={{ marginBottom: '12px' }}>
            <Text>请选择要取消的座位：</Text>
          </div>
          <div style={{ 
            padding: '8px', 
            background: '#f8f9fa', 
            borderRadius: '6px',
            border: '1px solid #e9ecef',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {partialCancelModal.booking?.seats?.map((seat: SeatPosition, index: number) => (
              <div key={index} style={{ 
                marginBottom: '4px', 
                display: 'flex', 
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: '4px',
                background: partialCancelModal.selectedSeats.some(s => s.row === seat.row && s.col === seat.col) 
                  ? '#e6f7ff' 
                  : 'transparent'
              }}>
                <input
                  type="checkbox"
                  checked={partialCancelModal.selectedSeats.some(s => s.row === seat.row && s.col === seat.col)}
                  onChange={() => handlePartialCancelSeatSelect(seat)}
                  style={{ marginRight: '8px' }}
                />
                <Text style={{ fontSize: '13px' }}>{seat.row}排{seat.col}号</Text>
              </div>
            ))}
          </div>
          {partialCancelModal.selectedSeats.length > 0 && (
            <div style={{ 
              marginTop: '12px', 
              padding: '8px 12px', 
              background: '#fff2e8', 
              borderRadius: '6px',
              border: '1px solid #ffd591'
            }}>
              <Text type="warning" style={{ fontSize: '12px' }}>
                已选择 {partialCancelModal.selectedSeats.length} 个座位
              </Text>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SeatGrid;
