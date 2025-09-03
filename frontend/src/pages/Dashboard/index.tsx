import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Typography, Card, List, message, Tag, Modal, Form, Input, Space, Tabs, Table, Popconfirm, InputNumber, DatePicker } from 'antd';
import { UserOutlined, LogoutOutlined, CalendarOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMovieContext } from '../../contexts/MovieContext';
import { User, MovieSession, Seat } from '../../types';
import { announcementAPI, bookingAPI } from '../../services/api';
import SeatGrid from '../../components/SeatGrid';
import './index.css';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { sessions, loadSessions, isLoading, deleteSession } = useMovieContext();
  
  // 本地状态
  const [selectedSession, setSelectedSession] = useState<MovieSession | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  const [isSeatModalVisible, setIsSeatModalVisible] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [isBookingModalVisible, setIsBookingModalVisible] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [defaultActiveKey, setDefaultActiveKey] = useState('sessions');
  

  
  // 使用ref来防止重复加载
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // 防止重复加载
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    loadSessions();
    loadAnnouncement();
  }, [loadSessions]);

  // 当sessions加载完成后，检查选中的场次
  useEffect(() => {
    if (selectedSession && !sessions.find(s => s.id === selectedSession.id)) {
      console.log('当前选中的场次已被删除，清理相关状态');
      setSelectedSession(null);
      setSelectedSeats([]);
      setBookings([]);
    }
  }, [sessions, selectedSession]);

  const loadAnnouncement = async () => {
    try {
      const response = await announcementAPI.getAnnouncement();
      if (response.data.success) {
        // 确保获取到公告内容
        const announcementContent = response.data.data?.content;
        if (announcementContent && announcementContent.trim() !== '') {
          setAnnouncement(announcementContent);
        } else {
          setAnnouncement('暂无公告');
        }
      } else {
        setAnnouncement('暂无公告');
      }
    } catch (error) {
      console.error('加载公告失败:', error);
      // 静默处理公告加载失败
      setAnnouncement('暂无公告');
    }
  };



  const handleSessionSelect = (session: MovieSession) => {
    setSelectedSession(session);
  };

  const handleLogout = () => {
    onLogout();
  };

  // 删除电影场次（仅管理员）
  const handleDeleteSession = async (sessionId: number) => {
    try {
      await deleteSession(sessionId);
      
      // 如果删除的是当前选中的场次，清理相关状态
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setSelectedSeats([]);
        setBookings([]);
      }
      
      message.success('电影场次删除成功');
    } catch (error: any) {
      console.error('删除电影场次失败:', error);
      message.error(error.message || '删除失败');
    }
  };

  const handleBookingSubmit = async (seats: Seat[]) => {
    try {
      if (!selectedSession?.id) {
        message.error('请先选择电影场次');
        return;
      }
      
      // 调用后端API创建预订
      const response = await bookingAPI.createBooking({
        session_id: selectedSession.id,
        seats: seats.map(seat => ({
          row: seat.row,
          col: seat.col
        }))
      });
      
      if (response.data.success) {
        // 预订成功，重新加载场次信息以更新座位状态
        await loadSessions();
        // 不在这里显示成功消息，让SeatGrid组件处理
      } else {
        // 业务逻辑失败，抛出异常让SeatGrid组件捕获
        throw new Error(response.data.message || '预订失败');
      }
    } catch (error: any) {
      console.error('预订失败:', error);
      // 重新抛出异常，让SeatGrid组件处理
      throw error;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>🎬 电影预订平台</Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Text style={{ color: 'white' }}>欢迎，{user.username}</Text>
          
          {/* 开发环境测试按钮 */}
          
          <Button type="text" icon={<UserOutlined />} style={{ color: 'white' }} onClick={() => navigate('/profile')}>
            个人中心
          </Button>
          <Button type="text" icon={<LogoutOutlined />} style={{ color: 'white' }} onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </Header>

      <Layout>
        <Sider width={300} style={{ background: '#fff' }}>
          <div style={{ 
            padding: '16px', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <Title level={4} style={{ marginBottom: '16px', flexShrink: 0 }}>🎭 电影场次</Title>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto',
              paddingRight: '8px', // 为滚动条留出空间
              minHeight: 0 // 确保flex子元素能正确收缩
            }}>
              {sessions.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  color: '#999'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
                  <Text type="secondary">暂无电影场次</Text>
                </div>
              ) : (
                sessions.map((session) => (
                  <Card
                    key={session.id}
                    size="small"
                    style={{ 
                      marginBottom: '12px', 
                      cursor: 'pointer',
                      border: selectedSession?.id === session.id ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      position: 'relative',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => handleSessionSelect(session)}
                  >
                    {/* 删除按钮 - 仅管理员可见 */}
                    {user.role === 'admin' && (
                      <Popconfirm
                        title="确定要删除这个电影场次吗？"
                        description="删除后将无法恢复，相关预订记录也会被清理"
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        onCancel={(e) => e?.stopPropagation()}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            zIndex: 10,
                            padding: '4px 8px',
                            minWidth: 'auto',
                            opacity: 0.7,
                            transition: 'opacity 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '0.7';
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          🗑️
                        </Button>
                      </Popconfirm>
                    )}
                    
                    <div style={{ paddingRight: user.role === 'admin' ? '32px' : '0' }}>
                      <Text strong style={{ fontSize: '14px', lineHeight: '1.4' }}>{session.title}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px', lineHeight: '1.3' }}>
                        {new Date(session.startTime || (session.date && session.time ? session.date + ' ' + session.time : new Date().toISOString())).toLocaleString()} ({session.duration}分钟)
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px', lineHeight: '1.3' }}>
                        预约开放: {new Date(session.bookingOpenTime || (session.booking_open_time ? session.booking_open_time : new Date().toISOString())).toLocaleString()}
                      </Text>
                      <br />
                      {session.canBook ? (
                        <Text type="success" style={{ fontSize: '12px' }}>✅ 可以预订</Text>
                      ) : (
                        <Text type="warning" style={{ fontSize: '12px' }}>
                          ⏰ 预约未开放 
                          <span style={{ marginLeft: '8px', fontSize: '11px' }}>
                            (具体开放时间请查看上方时间)
                          </span>
                        </Text>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </Sider>

        <Content style={{ padding: '24px', background: '#f0f2f5' }}>
          {/* 公告栏 - 始终显示在页面顶部 */}
          {announcement && announcement !== '暂无公告' && (
            <div style={{ 
              marginBottom: '24px',
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              border: '1px solid #e8e8e8'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '12px' 
              }}>
                <span style={{ 
                  fontSize: '24px', 
                  marginRight: '12px' 
                }}>📢</span>
                <Title level={3} style={{ 
                  color: 'white', 
                  margin: 0,
                  fontSize: '20px'
                }}>系统公告</Title>
              </div>
              <Text style={{ 
                color: 'white', 
                fontSize: '16px',
                lineHeight: '1.6',
                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                {announcement}
              </Text>
            </div>
          )}

          {selectedSession ? (
            <div>
              <Title level={2}>{selectedSession?.title}</Title>
              <Text type="secondary">
                场次时间: {new Date(selectedSession?.startTime || (selectedSession?.date && selectedSession?.time ? selectedSession.date + ' ' + selectedSession.time : new Date().toISOString())).toLocaleString()} ({selectedSession?.duration}分钟)
              </Text>
              
              <div style={{ marginTop: '24px' }}>
                <SeatGrid
                  sessionId={selectedSession.id?.toString() || ''}
                  maxSeats={4}
                  onBookingSubmit={handleBookingSubmit}
                  movieTitle={selectedSession.title}
                  startTime={selectedSession.startTime || (selectedSession.date && selectedSession.time ? selectedSession.date + ' ' + selectedSession.time : new Date().toISOString())}
                  bookingOpenTime={selectedSession.bookingOpenTime || selectedSession.booking_open_time || new Date().toISOString()}
                  currentUserId={user.id}
                />
              </div>
              
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Button type="default" onClick={() => navigate('/profile', { state: { activeTab: 'bookings' } })}>
                  查看我的预订
                </Button>
              </div>
            </div>
          ) : (
            <div>


              {/* 选择场次提示 */}
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <HomeOutlined style={{ fontSize: '64px', color: '#d9d9d9', marginBottom: '16px' }} />
                <Title level={3} type="secondary">请选择电影场次</Title>
                <Text type="secondary">在左侧选择您要预订的电影场次</Text>
              </div>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
