import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Typography, Card, List, message, Tag, Modal, Form, Input, Space, Tabs, Table, Popconfirm, InputNumber, DatePicker, Menu } from 'antd';
import { UserOutlined, LogoutOutlined, CalendarOutlined, HomeOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined, TeamOutlined, LockOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMovieContext } from '../../contexts/MovieContext';
import { User, MovieSession, Booking, SeatPosition } from '../../types';
import { movieAPI, announcementAPI, authAPI, waitlistAPI } from '../../services/api';
import UserManagement from './UserManagement';
import dayjs from 'dayjs';
import './index.css';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface AdminProps {
  user: User;
  onLogout: () => void;
}

const Admin: React.FC<AdminProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { deleteSession, sessions, loadSessions } = useMovieContext();
  
  // 本地状态
  const [announcement, setAnnouncement] = useState<string>('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState<MovieSession | null>(null);
  const [isAnnouncementModalVisible, setIsAnnouncementModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentSessionInfo, setCurrentSessionInfo] = useState<MovieSession | null>(null);
  const [currentSessionBookings, setCurrentSessionBookings] = useState<Booking[]>([]);
  const [isBookingDetailsVisible, setIsBookingDetailsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('sessions'); // 新增：当前激活的标签页
  const [updatingAnnouncement, setUpdatingAnnouncement] = useState(false);
  
  // 候补统计相关状态
  const [waitlistOverview, setWaitlistOverview] = useState<any[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  


  
  // 密码修改相关状态
  const [passwordForm] = Form.useForm();
  
  // 使用ref来防止重复加载
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // 防止重复加载
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    loadSessionsFromContext();
    loadAnnouncement();
  }, []);

  // 当sessions加载完成后，再加载预订信息
  useEffect(() => {
    if (sessions.length > 0) {
      loadAllBookings();
      loadWaitlistOverview();
    }
  }, [sessions]);

  // 加载电影场次
  const loadSessionsFromContext = async () => {
    try {
      setLoading(true);
      await loadSessions(); // 使用MovieContext的loadSessions
    } catch (error: any) {
      console.error('加载电影场次失败:', error);
      message.error('加载电影场次失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载所有预订信息
  const loadAllBookings = async () => {
    if (sessions.length === 0) return;
    
    try {
      // 获取所有场次的预订信息
      const allBookings = [];
      for (const session of sessions) {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001'}/bookings/sessions/${session.id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              allBookings.push(...data.data);
            }
          }
        } catch (error) {
          console.error(`获取场次${session.id}预订信息失败:`, error);
        }
      }
      setCurrentSessionBookings(allBookings);
    } catch (error) {
      console.error('加载预订信息失败:', error);
    }
  };

  // 监控waitlistOverview数据变化
  useEffect(() => {
    console.log('waitlistOverview数据变化:', {
      data: waitlistOverview,
      type: typeof waitlistOverview,
      isArray: Array.isArray(waitlistOverview),
      length: Array.isArray(waitlistOverview) ? waitlistOverview.length : 'N/A'
    });
  }, [waitlistOverview]);

  // 加载候补统计信息
  const loadWaitlistOverview = async () => {
    try {
      setWaitlistLoading(true);
      
      // 获取所有场次的waitlist统计
      const waitlistData = [];
      
      // 遍历所有场次，获取每个场次的waitlist信息
      for (const session of sessions) {
        try {
          const response = await waitlistAPI.getSessionWaitlist(session.id);
          if (response.data.success && response.data.data) {
            const { waitlist_count, waitlist } = response.data.data;
            console.log(`场次${session.id}的waitlist数据:`, { waitlist_count, waitlist });
            
            if (waitlist_count > 0) {
              // 即使waitlist数组为空，也要显示统计信息
              const processedUsers = Array.isArray(waitlist) && waitlist.length > 0 
                ? waitlist.map((entry: any) => ({
                    user_account: entry.user_account || entry.account || '未知账号',
                    user_username: entry.user_username || entry.username || '未知用户',
                    created_at: entry.created_at || new Date().toISOString()
                  }))
                : [];
              
              waitlistData.push({
                session_id: session.id,
                count: waitlist_count, // 使用后端返回的count
                users: processedUsers
              });
              
              console.log(`场次${session.id}处理完成:`, { 
                session_id: session.id, 
                count: waitlist_count, 
                users: processedUsers,
                originalWaitlist: waitlist,
                waitlistCount: waitlist_count
              });
            }
          }
        } catch (error) {
          console.error(`获取场次${session.id}的waitlist信息失败:`, error);
        }
      }
      
      setWaitlistOverview(waitlistData);
      console.log('最终Waitlist统计数据:', waitlistData);
      
    } catch (error) {
      console.error('加载候补统计失败:', error);
      setWaitlistOverview([]);
    } finally {
      setWaitlistLoading(false);
    }
  };

  const loadAnnouncement = async () => {
    try {
      const response = await announcementAPI.getAnnouncement();
      if (response.data.success) {
        setAnnouncement(response.data.data?.content || '暂无公告');
      } else {
        setAnnouncement('暂无公告');
      }
    } catch (error: any) {
      console.error('加载公告失败:', error);
      // 静默处理公告加载失败
      setAnnouncement('暂无公告');
    }
  };



  const handleLogout = () => {
    onLogout();
  };





  const showAddModal = () => {
    setIsAddModalVisible(true);
    form.resetFields();
  };

  const showEditModal = (session: MovieSession) => {
    setEditingSession(session);
    form.setFieldsValue({
      title: session.title,
      duration: session.duration,
      startTime: dayjs(session.date + ' ' + session.time),
      bookingOpenTime: dayjs(session.booking_open_time),
      max_seats: session.max_seats
    });
    setIsEditModalVisible(true);
  };

  const showBookingDetails = async (sessionId: number) => {
    try {
      // 获取场次信息
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        setCurrentSessionInfo(session);
      }
      
      // 获取预订详情
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001'}/bookings/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 获取所有用户信息
          const usersResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001'}/users`);
          let users: any[] = [];
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            if (usersData.success) {
              users = usersData.data || [];
            }
          }
          
          // 为每个预订添加用户信息，并按时间排序
          const bookingsWithUserInfo = (data.data || []).map((booking: any) => {
            const user = users.find((u: any) => u.id === booking.user_id);
            return {
              ...booking,
              user_account: user ? user.account : '未知账号',
              user_username: user ? user.username : '未知用户'
            };
          }).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
          setCurrentSessionBookings(bookingsWithUserInfo);
        }
      }
      
      setIsBookingDetailsVisible(true);
    } catch (error) {
      console.error('获取预订详情失败:', error);
      message.error('获取预订详情失败');
    }
  };

  const handleAddSession = async (values: any) => {
    try {
      const response = await movieAPI.createSession({
        title: values.title,
        duration: values.duration,
        date: values.startTime.format('YYYY-MM-DD'),
        time: values.startTime.format('HH:mm:ss'),
        booking_open_time: values.bookingOpenTime.toISOString(),
        max_seats: values.max_seats
      });
      
      if (response.data.success) {
        message.success('电影场次创建成功');
        setIsAddModalVisible(false);
        form.resetFields();
        loadSessionsFromContext();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const handleEditSession = async (values: any) => {
    try {
      if (!editingSession) return;
      
      const response = await movieAPI.updateSession(editingSession.id, {
        id: editingSession.id,
        title: values.title,
        duration: values.duration,
        date: values.startTime.format('YYYY-MM-DD'),
        time: values.startTime.format('HH:mm:ss'),
        booking_open_time: values.bookingOpenTime.toISOString(),
        max_seats: values.max_seats
      });
      
      if (response.data.success) {
        message.success('电影场次更新成功');
        setIsEditModalVisible(false);
        setEditingSession(null);
        form.resetFields();
        loadSessionsFromContext();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    try {
      // 获取该场次的预订信息
      const sessionBookings = currentSessionBookings.filter(booking => 
        booking.session_id === sessionId && booking.status === 'active'
      );
      const totalBookedSeats = sessionBookings.reduce((total, booking) => {
        return total + (booking.seats?.length || 0);
      }, 0);

      // 显示确认对话框
      Modal.confirm({
        title: '确认删除电影场次',
        content: (
          <div>
            <p>您确定要删除这个电影场次吗？</p>
            <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
              删除后将同时清理：
            </p>
            <ul style={{ color: '#ff4d4f', marginLeft: '20px' }}>
              <li>该场次的所有预订记录</li>
              <li>用户账户中的订票信息</li>
              <li>座位预订状态</li>
            </ul>
            {totalBookedSeats > 0 && (
              <p style={{ color: '#faad14', fontWeight: 'bold' }}>
                ⚠️ 当前已有 {totalBookedSeats} 个座位被预订，删除后这些预订将全部失效！
              </p>
            )}
            <p style={{ color: '#666', fontSize: '12px' }}>
              此操作不可恢复，请谨慎操作！
            </p>
          </div>
        ),
        okText: '确认删除',
        cancelText: '取消',
        okType: 'danger',
        onOk: async () => {
          try {
            setLoading(true);
            const response = await movieAPI.deleteSession(sessionId);
            if (response.data.success) {
              message.success('电影场次删除成功，相关预订记录已清理');
              
              // 清理本地数据
              // setSessions(sessions.filter(s => s.id !== sessionId)); // This line was removed as per the new_code
              
              // 清理预订数据
              setCurrentSessionBookings(prev => 
                prev.filter(booking => booking.session_id !== sessionId)
              );
              
              // 重新加载数据
              await loadSessionsFromContext();
              await loadAllBookings();
            } else {
              message.error(response.data.message || '删除失败');
            }
          } catch (error: any) {
            message.error(error.response?.data?.message || '删除失败');
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (error) {
      console.error('删除电影场次错误:', error);
      message.error('删除失败');
    }
  };

  const handleUpdateAnnouncement = async () => {
    // 防止重复提交
    if (updatingAnnouncement) {
      return;
    }

    try {
      setUpdatingAnnouncement(true);
      const response = await announcementAPI.updateAnnouncement({
        content: announcement
      });

      if (response.data.success) {
        message.success('公告更新成功！');
      } else {
        message.error(response.data.message || '公告更新失败');
      }
    } catch (error: any) {
      console.error('更新公告失败:', error);
      message.error(error.response?.data?.message || '公告更新失败');
    } finally {
      setUpdatingAnnouncement(false);
    }
  };

  // 下载投票用户列表
  const downloadVotingUsers = (record: any) => {
    if (!record.users || record.users.length === 0) {
      message.warning('没有可下载的投票用户数据');
      return;
    }

    // 获取场次信息
    const session = sessions.find(s => s.id === record.session_id);
    const sessionTitle = session ? session.title : `场次${record.session_id}`;

    // 创建CSV内容
    const csvData = [
      ['场次', '投票人数', '账号', '用户名', '投票时间']
    ];

    record.users.forEach((user: any) => {
      csvData.push([
        sessionTitle,
        record.count.toString(),
        user.user_account || user.account || '未知账号',
        user.user_username || user.username || '未知用户',
        user.created_at ? new Date(user.created_at).toLocaleString() : '未知时间'
      ]);
    });

    // 转换为CSV字符串
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // 创建下载链接
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `场次投票用户_${sessionTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('投票用户列表下载成功！');
  };

  // 处理删除投票数据
  const handleDeleteWaitlist = async (sessionId: number) => {
    try {
      const response = await fetch(`http://localhost:8001/waitlist/clear-session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        message.success('投票数据清理成功！');
        // 重新加载投票统计
        loadWaitlistOverview();
      } else {
        const errorData = await response.json();
        message.error(errorData.message || '清理失败');
      }
    } catch (error) {
      console.error('清理投票数据错误:', error);
      message.error('清理失败，请检查网络连接');
    }
  };

  // 处理密码修改
  const handleChangePassword = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
    try {
      // 前端验证
      if (values.newPassword !== values.confirmPassword) {
        message.error('新密码与确认密码不一致');
        return;
      }
      
      if (values.oldPassword === values.newPassword) {
        message.error('新密码不能与当前密码相同');
        return;
      }
      
      setChangingPassword(true);
      
      const response = await authAPI.changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      });
      
      if (response.data.success) {
        message.success('密码修改成功！请重新登录');
        passwordForm.resetFields();
        
        // 密码修改成功后，清除登录状态，要求用户重新登录
        setTimeout(() => {
          onLogout();
        }, 1500);
      } else {
        message.error(response.data.message || '密码修改失败');
      }
    } catch (error: any) {
      console.error('密码修改错误:', error);
      
      if (error.response?.status === 400) {
        message.error(error.response.data.message || '当前密码错误');
      } else if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        onLogout();
      } else if (error.response?.status === 500) {
        message.error('服务器错误，请稍后重试');
      } else {
        message.error('密码修改失败，请检查网络连接');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const columns = [
    {
      title: '电影标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '开始时间',
      dataIndex: 'date',
      key: 'date',
      render: (date: string, record: MovieSession) => (
        <span>{new Date(date + ' ' + record.time).toLocaleString()}</span>
      ),
    },
    {
      title: '电影时长',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => <span>{duration}分钟</span>,
    },
    {
      title: '预约开放时间',
      dataIndex: 'booking_open_time',
      key: 'booking_open_time',
      render: (time: string) => <span>{new Date(time).toLocaleString()}</span>,
    },
    {
      title: '最大座位数',
      dataIndex: 'max_seats',
      key: 'max_seats',
    },
    {
      title: '剩余座位数',
      key: 'remaining_seats',
      render: (text: string, record: MovieSession) => {
        // 计算该场次的剩余座位数
        const sessionBookings = currentSessionBookings.filter(booking => 
          booking.session_id === record.id && booking.status === 'active'
        );
        const totalBookedSeats = sessionBookings.reduce((total, booking) => {
          return total + (booking.seats?.length || 0);
        }, 0);
        const remainingSeats = (record.max_seats || 0) - totalBookedSeats;
        
        return (
          <span style={{ 
            color: remainingSeats > 0 ? '#52c41a' : '#ff4d4f',
            fontWeight: 'bold'
          }}>
            {remainingSeats}
          </span>
        );
      },
    },
    {
      title: '预订状态',
      key: 'booking_status',
      render: (text: string, record: MovieSession) => {
        // 计算该场次的预订统计
        const sessionBookings = currentSessionBookings.filter(booking => 
          booking.session_id === record.id && booking.status === 'active'
        );
        const totalBookedSeats = sessionBookings.reduce((total, booking) => {
          return total + (booking.seats?.length || 0);
        }, 0);
        
        return (
          <div>
            <div style={{ marginBottom: '4px' }}>
              <Text type="secondary">已预订: {totalBookedSeats}/{record.max_seats}</Text>
            </div>
            <Button 
              type="link" 
              size="small"
              onClick={() => showBookingDetails(record.id)}
              style={{ padding: 0, height: 'auto' }}
            >
              查看详情
            </Button>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: MovieSession) => (
        <span>
          <Button type="text" icon={<EditOutlined />} onClick={() => showEditModal(record)}>编辑</Button>
          <Popconfirm
            title="确认删除"
            description="您确定要删除这个电影场次吗？"
            onConfirm={() => handleDeleteSession(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  // 导出预订详情为CSV
  const exportBookingsToCSV = () => {
    if (!currentSessionInfo || currentSessionBookings.length === 0) {
      message.warning('没有可导出的预订数据');
      return;
    }

    // CSV头部
    const csvData = [
      ['用户账号', '用户名', '预订状态', '预订时间', '座位信息', '电影标题', '场次时间']
    ];

    // 添加数据行
    currentSessionBookings.forEach((booking: any) => { // 使用any类型来处理扩展属性
      const seatsInfo = booking.seats?.map((seat: any) => `第${seat.row}排${seat.col}号`).join('、') || '';
      const sessionTime = currentSessionInfo ? 
        new Date(currentSessionInfo.date + ' ' + currentSessionInfo.time).toLocaleString() : '';
      
      csvData.push([
        booking.user_account || '未知账号',
        booking.user_username || '未知用户',
        booking.status === 'active' ? '已预订' : '已取消',
        new Date(booking.created_at).toLocaleString(),
        seatsInfo,
        currentSessionInfo?.title || '',
        sessionTime
      ]);
    });

    // 转换为CSV字符串
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // 创建下载链接
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentSessionInfo?.title || '预订详情'}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('预订详情导出成功！');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>🎬 电影预订平台 - 管理后台</Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Text style={{ color: 'white' }}>欢迎，{user.username}</Text>
          <Button type="text" icon={<LogoutOutlined />} style={{ color: 'white' }} onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </Header>

      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeTab]}
            onClick={({ key }) => setActiveTab(key)}
            style={{ height: '100%', borderRight: 0 }}
            items={[
              {
                key: 'sessions',
                icon: <UserOutlined />,
                label: '电影场次管理'
              },
              {
                key: 'users',
                icon: <TeamOutlined />,
                label: '用户管理'
              },
              {
                key: 'announcement',
                icon: <UserOutlined />,
                label: '公告管理'
              },

              {
                key: 'settings',
                icon: <SettingOutlined />,
                label: '个人设置'
              }
            ]}
          />
        </Sider>

        <Content style={{ padding: '24px', background: '#f0f2f5' }}>
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab} 
            size="large"
            items={[
              {
                key: 'sessions',
                label: '电影场次管理',
                children: (
                  <Card>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Title level={4} style={{ margin: 0 }}>电影场次列表</Title>
                      <Button type="primary" icon={<PlusOutlined />} onClick={showAddModal}>
                        添加场次
                      </Button>
                    </div>

                    <Table
                      columns={columns}
                      dataSource={sessions}
                      rowKey="id"
                      loading={loading}
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                      }}
                    />
                  </Card>
                )
              },
              {
                key: 'announcement',
                label: '公告管理',
                children: (
                  <Card title="系统公告">
                    <Form layout="vertical">
                      <Form.Item label="公告内容">
                        <Input.TextArea
                          rows={6}
                          value={announcement}
                          onChange={(e) => setAnnouncement(e.target.value)}
                          placeholder="请输入公告内容"
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" onClick={handleUpdateAnnouncement}>
                          更新公告
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                )
              },

              {
                key: 'users',
                label: '用户管理',
                children: <UserManagement user={user} />
              },
              {
                key: 'waitlist',
                label: '场次投票统计',
                children: (
                  <Card title="场次投票统计">
                    <div style={{ marginBottom: '16px' }}>
                      <Text type="secondary">
                        显示各场次的投票人数和用户信息，帮助判断是否需要加场
                      </Text>
                    </div>
                    
                    {/* 数据验证和调试信息 */}
                    {Array.isArray(waitlistOverview) ? (
                      <Table
                      columns={[
                        {
                          title: '电影标题',
                          key: 'movie_title',
                          render: (text: string, record: any) => {
                            const session = sessions.find(s => s.id === record.session_id);
                            return session ? session.title : '未知场次';
                          },
                        },
                        {
                          title: '投票人数',
                          dataIndex: 'count',
                          key: 'count',
                          render: (count: number, record: any) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Tag color={count > 10 ? 'red' : count > 5 ? 'orange' : 'green'}>
                                {count}人
                              </Tag>
                              {count > 0 && (
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => downloadVotingUsers(record)}
                                  style={{ padding: 0, fontSize: '12px' }}
                                >
                                  📥 下载
                                </Button>
                              )}
                            </div>
                          ),
                        },
                        {
                          title: '建议',
                          key: 'suggestion',
                          render: (text: string, record: any) => {
                            const count = record.count;
                            if (count > 15) {
                              return <Tag color="red">强烈建议加场</Tag>;
                            } else if (count > 8) {
                              return <Tag color="orange">建议加场</Tag>;
                            } else if (count > 3) {
                              return <Tag color="blue">可考虑加场</Tag>;
                            } else {
                              return <Tag color="green">无需加场</Tag>;
                            }
                          },
                        },
                        {
                          title: '操作',
                          key: 'action',
                          render: (text: string, record: any) => {
                            const session = sessions.find(s => s.id === record.session_id);
                            // 如果场次不存在，显示删除按钮
                            if (!session) {
                              return (
                                <Popconfirm
                                  title="删除投票统计"
                                  description="该场次已被删除，确定要清理相关的投票数据吗？"
                                  onConfirm={() => handleDeleteWaitlist(record.session_id)}
                                  okText="确定"
                                  cancelText="取消"
                                >
                                  <Button type="primary" danger size="small">
                                    清理数据
                                  </Button>
                                </Popconfirm>
                              );
                            }
                            return null;
                          },
                        },
                      ]}
                      dataSource={waitlistOverview}
                      rowKey="session_id"
                      loading={waitlistLoading}
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                      }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        <Text type="secondary">数据格式错误，无法显示表格</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          当前数据类型: {typeof waitlistOverview}
                        </Text>
                      </div>
                    )}
                  </Card>
                )
              },
              {
                key: 'settings',
                label: '个人设置',
                children: (
                  <Card title="个人设置" style={{ maxWidth: '500px' }}>
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                        <UserOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Title level={4} style={{ margin: '8px 0' }}>{user.username}</Title>
                        <Tag color="red" style={{ fontSize: '14px' }}>管理员</Tag>
                      </div>
                    </div>
                    
                    <Form
                      form={passwordForm}
                      layout="vertical"
                      onFinish={handleChangePassword}
                    >
                      <Form.Item
                        name="oldPassword"
                        label="当前密码"
                        rules={[
                          { required: true, message: '请输入当前密码！' },
                          { min: 6, message: '密码长度不能少于6位！' }
                        ]}
                      >
                        <Input.Password
                          prefix={<LockOutlined />}
                          placeholder="请输入当前密码"
                          size="large"
                        />
                      </Form.Item>
                      
                      <Form.Item
                        name="newPassword"
                        label="新密码"
                        rules={[
                          { required: true, message: '请输入新密码！' },
                          { min: 6, message: '密码长度不能少于6位！' }
                        ]}
                      >
                        <Input.Password
                          prefix={<LockOutlined />}
                          placeholder="请输入新密码"
                          size="large"
                        />
                      </Form.Item>
                      
                      <Form.Item
                        name="confirmPassword"
                        label="确认新密码"
                        rules={[
                          { required: true, message: '请确认新密码！' },
                          { min: 6, message: '密码长度不能少于6位！' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('newPassword') === value) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error('两次输入的密码不一致！'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password
                          prefix={<LockOutlined />}
                          placeholder="请确认新密码"
                          size="large"
                        />
                      </Form.Item>
                      
                      <Form.Item>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={changingPassword}
                          icon={<LockOutlined />}
                          size="large"
                          block
                        >
                          修改密码
                        </Button>
                      </Form.Item>
                    </Form>
                    
                    <div style={{ marginTop: '24px', padding: '16px', background: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f' }}>
                      <Text type="secondary">
                        💡 提示：密码修改成功后，系统将自动退出登录，请使用新密码重新登录。
                      </Text>
                    </div>
                  </Card>
                )
              }
            ]}
          />
        </Content>
      </Layout>

      {/* 添加电影场次模态框 */}
      <Modal
        title="添加电影场次"
        open={isAddModalVisible}
        onCancel={() => setIsAddModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddSession}
        >
          <Form.Item
            name="title"
            label="电影标题"
            rules={[{ required: true, message: '请输入电影标题' }]}
          >
            <Input placeholder="请输入电影标题" />
          </Form.Item>

          <Form.Item
            name="duration"
            label="电影时长(分钟)"
            rules={[{ required: true, message: '请输入电影时长' }]}
          >
            <InputNumber min={1} max={300} style={{ width: '100%' }} placeholder="请输入电影时长" />
          </Form.Item>

          <Form.Item
            name="startTime"
            label="开始时间"
            rules={[{ required: true, message: '请选择开始时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} placeholder="请选择开始时间" />
          </Form.Item>

          <Form.Item
            name="bookingOpenTime"
            label="预约开放时间"
            rules={[{ required: true, message: '请选择预约开放时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} placeholder="请选择预约开放时间" />
          </Form.Item>

          <Form.Item
            name="max_seats"
            label="最大座位数"
            rules={[{ required: true, message: '请输入最大座位数' }]}
          >
            <InputNumber min={1} max={120} style={{ width: '100%' }} placeholder="请输入最大座位数" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
              创建
            </Button>
            <Button onClick={() => setIsAddModalVisible(false)}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑电影场次模态框 */}
      <Modal
        title="编辑电影场次"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditSession}
        >
          <Form.Item
            name="title"
            label="电影标题"
            rules={[{ required: true, message: '请输入电影标题' }]}
          >
            <Input placeholder="请输入电影标题" />
          </Form.Item>

          <Form.Item
            name="duration"
            label="电影时长(分钟)"
            rules={[{ required: true, message: '请输入电影时长' }]}
          >
            <InputNumber min={1} max={300} style={{ width: '100%' }} placeholder="请输入电影时长" />
          </Form.Item>

          <Form.Item
            name="startTime"
            label="开始时间"
            rules={[{ required: true, message: '请选择开始时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} placeholder="请选择开始时间" />
          </Form.Item>

          <Form.Item
            name="bookingOpenTime"
            label="预约开放时间"
            rules={[{ required: true, message: '请选择预约开放时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} placeholder="请选择预约开放时间" />
          </Form.Item>

          <Form.Item
            name="max_seats"
            label="最大座位数"
            rules={[{ required: true, message: '请输入最大座位数' }]}
          >
            <InputNumber min={1} max={120} style={{ width: '100%' }} placeholder="请输入最大座位数" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
              更新
            </Button>
            <Button onClick={() => setIsEditModalVisible(false)}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 预订详情模态框 */}
      <Modal
        title={`预订详情 - ${currentSessionInfo?.title || '未知电影'}`}
        open={isBookingDetailsVisible}
        onCancel={() => setIsBookingDetailsVisible(false)}
        footer={[
          <Button 
            key="export" 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={() => exportBookingsToCSV()}
            style={{ marginRight: '8px' }}
          >
            导出CSV
          </Button>,
          <Button key="close" onClick={() => setIsBookingDetailsVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {currentSessionInfo && (
          <div style={{ marginBottom: '20px' }}>
            <Card size="small">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <Text strong>电影标题：</Text>
                  <Text>{currentSessionInfo.title}</Text>
                </div>
                <div>
                  <Text strong>开始时间：</Text>
                  <Text>{new Date(currentSessionInfo.date + ' ' + currentSessionInfo.time).toLocaleString()}</Text>
                </div>
                <div>
                  <Text strong>电影时长：</Text>
                  <Text>{currentSessionInfo.duration}分钟</Text>
                </div>
                <div>
                  <Text strong>最大座位数：</Text>
                  <Text>{currentSessionInfo.max_seats}</Text>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div>
          <Title level={4}>预订座位详情</Title>
          {currentSessionBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              暂无预订信息
            </div>
          ) : (
            <div>
              {currentSessionBookings.map((booking: any, index) => ( // 使用any类型来处理扩展属性
                <Card key={index} size="small" style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '8px' }}>
                        <Text strong>用户账号：</Text>
                        <Text>{booking.user_account}</Text>
                        <Text style={{ marginLeft: '16px' }} strong>用户名：</Text>
                        <Text>{booking.user_username}</Text>
                        <Text style={{ marginLeft: '16px' }} strong>状态：</Text>
                        <Text type={booking.status === 'active' ? 'success' : 'warning'}>
                          {booking.status === 'active' ? '已预订' : '已取消'}
                        </Text>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <Text strong>预订时间：</Text>
                        <Text>{new Date(booking.created_at).toLocaleString()}</Text>
                      </div>
                      <div>
                        <Text strong>预订座位：</Text>
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {booking.seats?.map((seat: any, seatIndex: number) => (
                            <Tag key={seatIndex} color="blue">
                              第{seat.row}排{seat.col}号
                            </Tag>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
};

export default Admin;
