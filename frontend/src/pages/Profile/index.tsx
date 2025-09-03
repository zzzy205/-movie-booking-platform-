import React, { useState, useEffect, useRef } from 'react';
import { Layout, Card, Form, Input, Button, message, Tabs, List, Typography, Space, Tag, Modal } from 'antd';
import { UserOutlined, LockOutlined, CalendarOutlined, HomeOutlined, EyeOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { authAPI, bookingAPI, movieAPI } from '../../services/api';
import { QRCode } from 'antd';
import './index.css';

const { Header, Content } = Layout;
const { TabPane } = Tabs;
const { Title, Text } = Typography;

interface ProfileProps {
  user: any;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [changePasswordForm] = Form.useForm();
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  // 从location.state获取默认激活的标签页
  const defaultActiveKey = location.state?.activeTab || 'profile';
  
  // 使用ref来防止重复加载
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // 防止重复加载
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    loadUserBookings();
  }, []); // 空依赖数组，只在组件挂载时执行一次

  const loadUserBookings = async () => {
    try {
      const response = await bookingAPI.getUserBookings();
      if (response.data.success && response.data.data) {
        // 为每个预订获取电影场次信息
        const enrichedBookings = await Promise.all(
          response.data.data.map(async (booking: any) => {
            try {
              // 获取电影场次信息
              const sessionResponse = await movieAPI.getSession(booking.session_id);
              if (sessionResponse.data.success && sessionResponse.data.data) {
                const session = sessionResponse.data.data;
                return {
                  ...booking,
                  movie_title: session.title,
                  session_date: `${session.date} ${session.time}`,
                  duration: session.duration
                };
              } else {
                return {
                  ...booking,
                  movie_title: `电影场次 ${booking.session_id}`,
                  session_date: '未知时间',
                  duration: '未知'
                };
              }
            } catch (error) {
              console.error('获取场次信息失败:', error);
              return {
                ...booking,
                movie_title: `电影场次 ${booking.session_id}`,
                session_date: '未知时间',
                duration: '未知'
              };
            }
          })
        );
        setBookings(enrichedBookings);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error('加载预订信息失败:', error);
      message.error('加载预订信息失败');
      setBookings([]);
    }
  };

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    try {
      setLoading(true);
      
      // 前端验证
      if (values.oldPassword === values.newPassword) {
        message.error('新密码不能与当前密码相同');
        return;
      }
      
      const response = await authAPI.changePassword(values);
      if (response.data.success) {
        message.success('密码修改成功！请重新登录');
        changePasswordForm.resetFields();
        
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
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  const handleViewTicket = (booking: any) => {
    // 安全检查：只有active状态的预订才能查看票务详情
    if (booking.status !== 'active') {
      message.warning('已取消的预订无法查看票务详情');
      return;
    }
    
    setSelectedTicket(booking);
    setTicketModalVisible(true);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>👤 个人中心</Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Text style={{ color: 'white' }}>欢迎，{user.username}</Text>
          <Button type="text" icon={<HomeOutlined />} style={{ color: 'white' }} onClick={() => navigate('/')}>
            返回首页
          </Button>
          <Button type="text" icon={<UserOutlined />} style={{ color: 'white' }} onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </Header>

      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Tabs defaultActiveKey={defaultActiveKey} size="large">
            <TabPane tab="个人信息" key="profile">
              <Card>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <UserOutlined style={{ fontSize: '64px', color: '#1890ff' }} />
                  <Title level={2} style={{ marginTop: '16px' }}>{user.username}</Title>
                  <Tag color={user.role === 'admin' ? 'red' : 'blue'} style={{ fontSize: '14px', padding: '4px 12px' }}>
                    {user.role === 'admin' ? '管理员' : '普通用户'}
                  </Tag>
                </div>
                
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">注册时间：{formatDateTime(user.created_at)}</Text>
                </div>
              </Card>
            </TabPane>

            <TabPane tab="修改密码" key="password">
              <Card>
                <Form
                  form={changePasswordForm}
                  onFinish={handleChangePassword}
                  layout="vertical"
                  style={{ maxWidth: '400px', margin: '0 auto' }}
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
                    />
                  </Form.Item>

                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={['newPassword']}
                    rules={[
                      { required: true, message: '请确认新密码！' },
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
                      placeholder="请再次输入新密码"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      size="large"
                    >
                      修改密码
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </TabPane>

            <TabPane tab="我的预订" key="bookings">
              <Card>
                <div style={{ marginBottom: '16px' }}>
                  <Title level={4}>📅 预订记录</Title>
                  <Text type="secondary">共 {bookings.length} 条预订记录</Text>
                </div>
                
                {bookings.length > 0 ? (
                  <List
                    dataSource={bookings}
                    renderItem={(booking) => (
                      <List.Item
                        actions={[
                          // 只有当预订状态为active时才显示查看票务详情按钮
                          booking.status === 'active' && (
                            <Button 
                              key="view-ticket"
                              type="primary" 
                              size="small" 
                              icon={<EyeOutlined />}
                              onClick={() => handleViewTicket(booking)}
                            >
                              查看票务详情
                            </Button>
                          )
                        ].filter(Boolean)} // 过滤掉undefined的元素
                      >
                        <List.Item.Meta
                          title={
                            <Space>
                              <Text strong>{booking.movie_title || '未知电影'}</Text>
                              <Tag color={booking.status === 'active' ? 'green' : 'red'}>
                                {booking.status === 'active' ? '有效' : '已取消'}
                              </Tag>
                            </Space>
                          }
                          description={
                            <div>
                              <div>场次时间：{formatDateTime(booking.session_date || '')}</div>
                              <div>预订座位：{booking.seats ? `${booking.seats.length}个座位` : '未知'}</div>
                              <div>座位详情：{booking.seats ? booking.seats.map((seat: any) => `第${seat.row}排${seat.col}号`).join('、') : '未知'}</div>
                              <div>预订时间：{formatDateTime(booking.created_at)}</div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <CalendarOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                    <Text type="secondary">暂无预订记录</Text>
                  </div>
                )}
              </Card>
            </TabPane>
          </Tabs>
        </div>
      </Content>

      {/* 票务详情模态框 */}
      <Modal
        title="🎫 票务详情"
        open={ticketModalVisible}
        onCancel={() => setTicketModalVisible(false)}
        footer={null}
        width={500}
        centered
      >
        {selectedTicket && (
          <div className="ticket-info-modal">
            <Card size="small" style={{ marginBottom: '16px' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <Title level={3} style={{ color: '#1890ff', margin: 0 }}>电影票</Title>
                <Tag color="green" style={{ marginTop: '8px' }}>有效票务</Tag>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <Text strong>电影名称: </Text>
                <Text>{selectedTicket.movie_title || '未知电影'}</Text>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <Text strong>场次时间: </Text>
                <Text>{formatDateTime(selectedTicket.session_date || '')}</Text>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <Text strong>场次ID: </Text>
                <Text>{selectedTicket.session_id}</Text>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <Text strong>预订座位数量: </Text>
                <Text>{selectedTicket.seats ? selectedTicket.seats.length : 0} 个</Text>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <Text strong>预订座位详情: </Text>
                <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                  {selectedTicket.seats ? selectedTicket.seats.map((seat: any, index: number) => (
                    <Text key={index} style={{ display: 'block', marginBottom: '4px' }}>
                      第{seat.row}排{seat.col}号
                    </Text>
                  )) : (
                    <Text>未知座位信息</Text>
                  )}
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <Text strong>预订时间: </Text>
                <Text>{formatDateTime(selectedTicket.created_at)}</Text>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>防伪二维码</Text>
                <QRCode 
                  value={`电影:${selectedTicket.movie_title || '未知电影'}
场次ID:${selectedTicket.session_id}
场次时间:${formatDateTime(selectedTicket.session_date || '')}
预订座位:${selectedTicket.seats ? selectedTicket.seats.map((seat: any) => `第${seat.row}排${seat.col}号`).join('、') : '未知'}
预订时间:${formatDateTime(selectedTicket.created_at)}
总座位数:${selectedTicket.seats ? selectedTicket.seats.length : 0}个`}
                  size={120}
                  color="#1890ff"
                />
              </div>
            </Card>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default Profile;
