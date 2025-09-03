import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { LoginRequest } from '../../types';
import './index.css';

const { Title } = Typography;

interface LoginProps {
  onLoginSuccess?: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: LoginRequest) => {
    try {
      console.log('开始登录:', values);
      setLoading(true);
      const response = await authAPI.login(values);
      
      console.log('登录响应:', response);
      
      if (response.data.success) {
        const { token, user } = response.data.data!;
        console.log('登录成功，用户信息:', user);
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        message.success('登录成功！');
        
        // 通知父组件用户已登录
        if (onLoginSuccess) {
          console.log('调用onLoginSuccess回调');
          onLoginSuccess(user);
        }
        
        // 延迟跳转，确保状态更新
        setTimeout(() => {
          console.log('准备跳转，用户角色:', user.role);
          if (user.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/');
          }
        }, 100);
      } else {
        console.error('登录失败:', response.data.message);
        message.error(response.data.message || '登录失败');
      }
    } catch (error: any) {
      console.error('登录错误:', error);
      
      // 根据不同的错误类型提供友好的提示
      if (error.response?.status === 401) {
        message.error('账号或密码错误，请检查后重试');
      } else if (error.response?.status === 400) {
        message.error('输入格式错误，请检查账号和密码格式');
      } else if (error.response?.status === 429) {
        message.error('登录请求过于频繁，请等待几分钟后再试');
      } else if (error.response?.status >= 500) {
        message.error('服务器错误，请稍后重试');
      } else if (error.code === 'NETWORK_ERROR') {
        message.error('网络连接失败，请检查网络后重试');
      } else if (error.code === 'ECONNABORTED') {
        message.error('请求超时，请检查网络后重试');
      } else {
        message.error('登录失败，请检查网络连接');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <Card className="login-card">
          <div className="login-header">
            <Title level={2} className="login-title">
              电影预订平台
            </Title>
            <p className="login-subtitle">请使用您的账号登录</p>
          </div>
          
          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="account"
              rules={[
                { required: true, message: '请输入账号！' },
                { pattern: /^\d{6}$/, message: '账号必须是6位数字！' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入6位数字账号"
                maxLength={6}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码！' },
                { min: 6, message: '密码长度不能少于6位！' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="login-button"
                block
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
