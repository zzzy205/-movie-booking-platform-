import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import { MovieProvider } from './contexts/MovieContext';
import './App.css';

interface User {
  id: number;
  account: string;
  username: string;
  role: 'user' | 'admin';
  created_at: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 检查本地存储的认证信息
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('解析用户数据失败:', error);
        // 清理无效数据
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = (userData: User) => {
    console.log('App.tsx handleLogin 被调用，用户数据:', userData);
    
    // 确保用户数据包含所有必需属性
    const completeUserData: User = {
      ...userData,
      created_at: userData.created_at || new Date().toISOString()
    };
    
    console.log('设置用户状态:', completeUserData);
    setUser(completeUserData);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(completeUserData));
    
    console.log('登录状态更新完成，isAuthenticated:', true);
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const handleLogoutError = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // 受保护的路由组件
  const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'user' | 'admin' }) => {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    
    if (requiredRole && user?.role !== requiredRole) {
      return <Navigate to="/" replace />;
    }
    
    return <>{children}</>;
  };

  return (
    <MovieProvider>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
              <Navigate to="/" replace /> : 
              <Login onLoginSuccess={handleLogin} />
            } 
          />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard user={user!} onLogout={handleLogout} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile user={user!} onLogout={handleLogout} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requiredRole="admin">
                <Admin user={user!} onLogout={handleLogout} />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </MovieProvider>
  );
}

export default App;
