import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layout,
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Upload,
  Space,
  Typography,
  Popconfirm,
  Tag,
  Divider
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  UserOutlined
} from '@ant-design/icons';
import { userAPI } from '../../services/api';
import { usePreventDuplicateRequest } from '../../hooks/usePreventDuplicateRequest';
import './UserManagement.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

interface User {
  id: number;
  account: string;
  username: string;
  role: 'user' | 'admin';
  created_at: string;
}

interface UserManagementProps {
  user: any;
}

const UserManagement: React.FC<UserManagementProps> = ({ user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [importForm] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // 筛选和搜索状态
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  
  // 使用ref来防止重复加载
  const hasLoadedRef = useRef(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getUsers();
      if (response.data.success) {
        const userList = response.data.data || [];
        setUsers(userList);
        setFilteredUsers(userList);
        setPagination(prev => ({ ...prev, total: userList.length }));
      }
    } catch (error) {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 筛选和搜索用户
  const filterUsers = useCallback(() => {
    let filtered = [...users];
    
    // 按角色筛选
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    // 按搜索文本筛选
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(user => 
        user.account.toLowerCase().includes(searchLower) ||
        user.username.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredUsers(filtered);
    setPagination(prev => ({ ...prev, current: 1, total: filtered.length }));
  }, [users, roleFilter, searchText]);

  // 当筛选条件变化时重新筛选
  useEffect(() => {
    filterUsers();
  }, [filterUsers]);
  
  // 使用防重复请求Hook
  const loadUsersWithPrevention = usePreventDuplicateRequest(loadUsers, 2000);

  useEffect(() => {
    // 防止重复加载
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    loadUsersWithPrevention();
  }, [loadUsersWithPrevention]);

  const handleAddUser = async (values: any) => {
    try {
      const response = await userAPI.createUser(values);
      if (response.data.success) {
        message.success('用户创建成功');
        setAddModalVisible(false);
        addForm.resetFields();
        loadUsers();
      } else {
        message.error(response.data.message || '用户创建失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '用户创建失败');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const response = await userAPI.deleteUser(userId);
      if (response.data.success) {
        message.success('用户删除成功');
        loadUsers();
      } else {
        message.error(response.data.message || '用户删除失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '用户删除失败');
    }
  };

  // 下载初始密码列表
  const downloadPasswordList = (importedUsers: any[]) => {
    if (!importedUsers || importedUsers.length === 0) {
      message.warning('没有可下载的密码列表');
      return;
    }

    // 创建CSV内容
    const csvData = [
      ['账号', '用户名', '初始密码', '说明']
    ];

    importedUsers.forEach(user => {
      csvData.push([
        user.account,
        user.username,
        user.initialPassword,
        '请及时修改初始密码'
      ]);
    });

    // 转换为CSV字符串
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // 创建下载链接
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `用户初始密码_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('密码列表下载成功！');
  };

  const handleImportUsers = async (values: any) => {
    try {
      if (!selectedFile) {
        message.error('请先选择要上传的文件');
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      console.log('开始上传文件:', selectedFile.name);
      
      // 显示上传开始提示
      message.loading({
        content: '正在上传文件，请稍候...',
        duration: 0,
        key: 'importProgress'
      });
      
      const response = await userAPI.importUsers(formData);
      
      console.log('后端响应:', response);
      
      if (response.data.success) {
        // 关闭加载提示
        message.destroy('importProgress');
        
        // 显示成功消息
        const { success, failed, errors } = response.data.data || {};
        const users = (response.data.data as any)?.importedUsers || [];
        if (failed && failed > 0) {
          // 有失败的情况，显示详细结果
          message.success({
            content: (
              <div>
                <div>✅ 批量导入完成！</div>
                <div>成功: {success || 0} 个用户</div>
                <div>失败: {failed} 个用户</div>
                {(success || 0) > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={() => downloadPasswordList(users)}
                      style={{ padding: 0, color: '#1890ff' }}
                    >
                      📥 下载初始密码列表
                    </Button>
                  </div>
                )}
                {errors && errors.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <details>
                      <summary>查看失败详情</summary>
                      <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '8px' }}>
                        {errors.slice(0, 20).map((error: string, index: number) => (
                          <div key={index} style={{ fontSize: '12px', color: '#ff4d4f', marginBottom: '4px' }}>
                            {error}
                          </div>
                        ))}
                        {errors.length > 20 && (
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            还有 {errors.length - 20} 个错误...
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ),
            duration: 10, // 显示10秒
          });
        } else {
          // 全部成功
          message.success({
            content: (
              <div>
                <div>✅ 批量导入成功！共导入 {success || 0} 个用户</div>
                {(success || 0) > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={() => downloadPasswordList(users)}
                      style={{ padding: 0, color: '#1890ff' }}
                    >
                      📥 下载初始密码列表
                    </Button>
                  </div>
                )}
              </div>
            ),
            duration: 8,
          });
        }
        
        setImportModalVisible(false);
        importForm.resetFields();
        setSelectedFile(null);
        loadUsers();
      } else {
        // 关闭加载提示
        message.destroy('importProgress');
        
        // 显示详细的错误信息
        const errorMsg = response.data.message || '批量导入失败';
        console.log('导入失败详情:', response.data);
        
        if (response.data.data && response.data.data.errors && response.data.data.errors.length > 0) {
          // 显示具体的错误列表
          const errorDetails = response.data.data.errors.join('\n');
          console.log('具体错误:', errorDetails);
          message.error({
            content: (
              <div>
                <div>{errorMsg}</div>
                <details style={{ marginTop: '8px' }}>
                  <summary>查看详细错误</summary>
                  <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '8px' }}>
                    {response.data.data.errors.slice(0, 20).map((error, index) => (
                      <div key={index} style={{ fontSize: '12px', color: '#ff4d4f', marginBottom: '4px' }}>
                        {error}
                      </div>
                    ))}
                    {response.data.data.errors.length > 20 && (
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        还有 {response.data.data.errors.length - 20} 个错误...
                      </div>
                    )}
                  </div>
                </details>
              </div>
            ),
            duration: 10,
          });
        } else {
          message.error(errorMsg);
        }
      }
    } catch (error: any) {
      console.error('导入失败:', error);
      
      // 关闭加载提示
      message.destroy('importProgress');
      
      // 显示详细的错误信息
      if (error.code === 'ECONNABORTED') {
        message.error('⏰ 导入超时，文件可能过大或网络较慢。建议分批导入或检查网络连接。');
      } else if (error.response?.data?.message) {
        message.error(`导入失败: ${error.response.data.message}`);
      } else if (error.response?.data?.data?.errors && error.response.data.data.errors.length > 0) {
        const errorDetails = error.response.data.data.errors.join('\n');
        message.error(`导入失败:\n详细错误:\n${errorDetails}`);
      } else {
        message.error(error.response?.data?.message || '批量导入失败，请检查文件格式和内容');
      }
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      // 创建CSV模板数据（包含密码列）
      const csvData = [
        ['账号', '用户名', '密码'],
        ['123456', '张三', 'Ax7Kp9mN'],
        ['234567', '李四', ''], // 留空则自动生成
        ['345678', '王五', 'myPass123']
      ];
      
      // 转换为CSV字符串
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      
      // 创建下载链接
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', '用户导入模板.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success('模板下载成功');
    } catch (error) {
      console.error('模板下载失败:', error);
      message.error('模板下载失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '账号',
      dataIndex: 'account',
      key: 'account',
      width: 120,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 150,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: User) => (
        <Space size="small">
          <Popconfirm
            title="确定要删除这个用户吗？"
            description="删除后无法恢复，且不能删除管理员账号"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="确定"
            cancelText="取消"
            disabled={record.role === 'admin'}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.role === 'admin'}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>👥 用户管理</Title>
      </Header>

      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Card>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={4} style={{ margin: 0 }}>用户列表</Title>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setAddModalVisible(true)}
                >
                  添加用户
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => setImportModalVisible(true)}
                >
                  批量导入
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={downloadTemplate}
                >
                  下载CSV模板
                </Button>
              </Space>
            </div>

            {/* 用户筛选和搜索 */}
            <div style={{ marginBottom: '16px', padding: '16px', background: '#fafafa', borderRadius: '8px' }}>
              <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <span>角色筛选：</span>
                  <Select
                    value={roleFilter}
                    onChange={setRoleFilter}
                    style={{ width: 120 }}
                  >
                    <Option value="all">全部角色</Option>
                    <Option value="user">普通用户</Option>
                    <Option value="admin">管理员</Option>
                  </Select>
                </Space>
                
                <Space>
                  <span>搜索：</span>
                  <Input.Search
                    placeholder="搜索账号或用户名"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 200 }}
                    allowClear
                  />
                </Space>
                
                <div>
                  <Text type="secondary">
                    共 {filteredUsers.length} 个用户
                    {roleFilter !== 'all' && ` (${roleFilter === 'admin' ? '管理员' : '普通用户'})`}
                    {searchText && ` (包含"${searchText}")`}
                  </Text>
                </div>
              </Space>
            </div>

            <Table
              columns={columns}
              dataSource={filteredUsers}
              rowKey="id"
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
                onChange: (page, pageSize) => {
                  setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 20 }));
                }
              }}
            />
          </Card>
        </div>

        {/* 添加用户模态框 */}
        <Modal
          title="添加用户"
          open={addModalVisible}
          onCancel={() => setAddModalVisible(false)}
          footer={null}
          width={500}
        >
          <Form
            form={addForm}
            layout="vertical"
            onFinish={handleAddUser}
          >
            <Form.Item
              name="account"
              label="账号"
              rules={[
                { required: true, message: '请输入账号' },
                { pattern: /^\d{6}$/, message: '账号必须是6位数字' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入6位数字账号"
                maxLength={6}
              />
            </Form.Item>

            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 2, max: 20, message: '用户名长度在2-20个字符之间' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入中文用户名"
              />
            </Form.Item>

            <Form.Item
              name="role"
              label="角色"
              initialValue="user"
              rules={[
                { required: true, message: '请选择角色' }
              ]}
            >
              <Select placeholder="请选择角色">
                <Option value="user">普通用户</Option>
                <Option value="admin">管理员</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { pattern: /^[a-zA-Z0-9]{8}$/, message: '密码必须是8位字母数字组合' }
              ]}
            >
              <Input.Password
                placeholder="请输入8位字母数字组合密码"
                maxLength={8}
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setAddModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  创建用户
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 批量导入用户模态框 */}
        <Modal
          title="批量导入用户"
          open={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          footer={null}
          width={600}
        >
          <div style={{ marginBottom: '16px', padding: '16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '8px' }}>
            <Title level={5} style={{ margin: 0, color: '#52c41a' }}>📋 导入说明</Title>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>支持文件格式：<strong>CSV、XLS、XLSX</strong></li>
              <li>第一行必须是表头：<strong>账号,用户名,密码</strong></li>
              <li>账号必须是6位数字，用户名建议使用中文</li>
              <li>密码规则：<strong>8位字母数字组合</strong></li>
              <li><strong>密码列留空则自动生成8位随机密码，有值则使用指定密码</strong></li>
              <li>建议先下载模板，编辑后上传</li>
              <li>导入成功后可以下载初始密码列表</li>
            </ul>
          </div>
          
          <Form
            form={importForm}
            layout="vertical"
            onFinish={handleImportUsers}
          >
            <Form.Item
              name="file"
              label="选择文件"
            >
              <Upload
                accept=".csv,.xls,.xlsx"
                maxCount={1}
                beforeUpload={(file) => {
                  // 验证文件类型
                  const isValidType = file.type === 'text/csv' || 
                                    file.type === 'application/vnd.ms-excel' ||
                                    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                                    file.name.toLowerCase().endsWith('.csv') ||
                                    file.name.toLowerCase().endsWith('.xls') ||
                                    file.name.toLowerCase().endsWith('.xlsx');
                  
                  if (!isValidType) {
                    message.error('只支持 CSV、XLS、XLSX 格式的文件');
                    return false;
                  }
                  
                  // 验证文件大小 (5MB)
                  const isLt5M = file.size / 1024 / 1024 < 5;
                  if (!isLt5M) {
                    message.error('文件大小不能超过 5MB');
                    return false;
                  }
                  
                  setSelectedFile(file); // 设置selectedFile状态
                  return false; // 阻止自动上传
                }}
                showUploadList={{
                  showPreviewIcon: false,
                  showRemoveIcon: true,
                }}
                onChange={(info) => {
                  if (info.file.status === 'removed') {
                    // 文件被移除时清空表单
                    importForm.setFieldsValue({ file: undefined });
                    setSelectedFile(null); // 清空selectedFile状态
                  }
                }}
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  支持 CSV、XLS、XLSX 格式，文件大小不超过 5MB
                </div>
              </Upload>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={uploading}>
                  开始导入
                </Button>
                <Button onClick={() => setImportModalVisible(false)}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default UserManagement;
