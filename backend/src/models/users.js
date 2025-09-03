const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// 数据文件路径
const DATA_FILE = process.env.DB_PATH || '/app/data/users.json';

// 确保数据目录存在
const ensureDataDir = () => {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 从文件加载用户数据
const loadUsersFromFile = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载用户数据失败:', error);
  }
  
  // 如果文件不存在或读取失败，返回默认用户
  return [
    {
      id: 1,
      account: '123456',
      username: '管理员',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      role: 'admin',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      account: '654321',
      username: '测试用户',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      role: 'user',
      created_at: new Date().toISOString()
    }
  ];
};

// 保存用户数据到文件
const saveUsersToFile = (usersData) => {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2), 'utf8');
    console.log('用户数据已保存到文件');
  } catch (error) {
    console.error('保存用户数据失败:', error);
  }
};

// 共享的用户数据库
let users = loadUsersFromFile();

// 初始化时重新生成密码哈希
const initializeUsers = async () => {
  const adminPassword = '123456';
  const userPassword = '123456';
  
  users[0].password = await bcrypt.hash(adminPassword, 10);
  users[1].password = await bcrypt.hash(userPassword, 10);
  
  // 保存到文件
  saveUsersToFile(users);
  
  console.log('用户密码已初始化');
};

// 启动时初始化密码
initializeUsers();

// 用户操作方法
const userModel = {
  // 获取所有用户
  getAllUsers: () => {
    return users.map(user => ({
      id: user.id,
      account: user.account,
      username: user.username,
      role: user.role,
      created_at: user.created_at
    }));
  },

  // 根据账号查找用户
  findByAccount: (account) => {
    return users.find(user => user.account === account);
  },

  // 根据ID查找用户
  findById: (id) => {
    return users.find(user => user.id === id);
  },

  // 更新用户密码
  updatePassword: async (id, newPassword) => {
    const user = users.find(user => user.id === id);
    if (user) {
      user.password = await bcrypt.hash(newPassword, 10);
      // 保存到文件
      saveUsersToFile(users);
      return true;
    }
    return false;
  },

  // 生成8位随机密码
  generatePassword: () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  },

  // 创建用户
  createUser: async (account, username, role = 'user', password = null) => {
    // 如果没有提供密码，则生成随机密码
    const finalPassword = password || userModel.generatePassword();
    
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      account,
      username,
      password: await bcrypt.hash(finalPassword, 10),
      role,
      created_at: new Date().toISOString(),
      // 存储明文密码用于导出（仅用于初始密码）
      initialPassword: finalPassword
    };

    users.push(newUser);
    
    // 保存到文件
    saveUsersToFile(users);
    
    return newUser;
  },

  // 删除用户
  deleteUser: (id) => {
    const userIndex = users.findIndex(user => user.id === id);
    if (userIndex !== -1) {
      const deletedUser = users.splice(userIndex, 1)[0];
      // 保存到文件
      saveUsersToFile(users);
      return deletedUser;
    }
    return null;
  },

  // 批量导入用户
  importUsers: async (userData) => {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < userData.length; i++) {
      const row = userData[i];
      const rowNumber = i + 2;

      try {
        if (!row.账号 || !row.用户名) {
          results.failed++;
          results.errors.push(`第${rowNumber}行：账号或用户名为空`);
          continue;
        }

        const account = row.账号.toString().trim();
        const username = row.用户名.toString().trim();

        if (!/^\d{6}$/.test(account)) {
          results.failed++;
          results.errors.push(`第${rowNumber}行：账号${account}不是6位数字`);
          continue;
        }

        const existingUser = users.find(user => user.account === account);
        if (existingUser) {
          results.failed++;
          results.errors.push(`第${rowNumber}行：账号${account}已存在`);
          continue;
        }

        await userModel.createUser(account, username, 'user');
        results.success++;

      } catch (error) {
        results.failed++;
        results.errors.push(`第${rowNumber}行：处理失败 - ${error.message}`);
      }
    }

    // 保存到文件
    saveUsersToFile(users);

    return results;
  },

  // 检查账号是否存在
  isAccountExists: (account) => {
    return users.some(user => user.account === account);
  }
};

module.exports = userModel;
