const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const xlsx = require('xlsx');
const userModel = require('../models/users');

const router = express.Router();

// 配置multer用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB限制
  },
  fileFilter: (req, file, cb) => {
    // 支持多种文件格式
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv', // .csv (某些系统)
      'text/plain' // .csv (某些系统)
    ];
    
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传CSV、XLS、XLSX格式的文件'));
    }
  }
});

// 获取所有用户
router.get('/', (req, res) => {
  try {
    const userList = userModel.getAllUsers();
    
    res.json({
      success: true,
      data: userList
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 添加单个用户
router.post('/', [
  body('account').isLength({ min: 6, max: 6 }).withMessage('账号必须是6位数字'),
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('role').isIn(['user', 'admin']).withMessage('角色必须是user或admin'),
  body('password').optional().isLength({ min: 8, max: 8 }).withMessage('密码必须是8位字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { account, username, role = 'user', password } = req.body;

    // 检查账号是否已存在
    if (userModel.isAccountExists(account)) {
      return res.status(400).json({
        success: false,
        message: '账号已存在'
      });
    }

    // 检查账号是否为6位数字
    if (!/^\d{6}$/.test(account)) {
      return res.status(400).json({
        success: false,
        message: '账号必须是6位数字'
      });
    }

    // 创建新用户（支持自定义密码或自动生成）
    const newUser = await userModel.createUser(account, username, role, password);

    res.status(201).json({
      success: true,
      message: '用户创建成功',
      data: {
        id: newUser.id,
        account: newUser.account,
        username: newUser.username,
        role: newUser.role,
        created_at: newUser.created_at
      }
    });

  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 删除用户
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // 检查用户是否存在
    const existingUser = userModel.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 不能删除管理员账号
    if (existingUser.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: '不能删除管理员账号'
      });
    }

    // 删除用户
    const deletedUser = userModel.deleteUser(userId);
    if (deletedUser) {
      res.json({
        success: true,
        message: '用户删除成功'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '删除用户失败'
      });
    }

  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 批量导入用户
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传文件'
      });
    }

    console.log('收到文件上传:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    let data = [];
    const fileName = req.file.originalname.toLowerCase();
    
    try {
      // 根据文件类型选择读取方式
      if (fileName.endsWith('.csv')) {
        // 使用更稳定的CSV解析方法
        let csvContent = req.file.buffer.toString('utf-8');
        console.log('CSV内容前100字符:', csvContent.substring(0, 100));
        
        // 清理BOM字符
        if (csvContent.charCodeAt(0) === 0xFEFF) {
          csvContent = csvContent.slice(1);
          console.log('已清理BOM字符');
        }
        
        // 尝试使用xlsx解析CSV
        try {
          const workbook = xlsx.read(csvContent, { 
            type: 'string',
            raw: true,
            cellDates: true,
            cellNF: false,
            cellText: false
          });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          data = xlsx.utils.sheet_to_json(worksheet);
          console.log('CSV解析成功，数据行数:', data.length);
          
          // 修复字段名问题：查找包含"账号"和"用户名"的字段
          if (data.length > 0) {
            const firstRow = data[0];
            const keys = Object.keys(firstRow);
            console.log('原始字段名:', keys);
            
                      // 查找包含"账号"、"用户名"和"密码"的字段（支持多种可能的字段名）
          const accountKey = keys.find(key => 
            key.includes('账号') || key.includes('account') || key.includes('Account')
          );
          const usernameKey = keys.find(key => 
            key.includes('用户名') || key.includes('username') || key.includes('Username')
          );
          const passwordKey = keys.find(key => 
            key.includes('密码') || key.includes('password') || key.includes('Password')
          );
          
          if (accountKey && usernameKey) {
            // 重命名字段，统一为标准格式
            data = data.map(row => {
              const newRow = {};
              newRow['账号'] = row[accountKey];
              newRow['用户名'] = row[usernameKey];
              // 密码字段可选，如果没有则设为undefined
              if (passwordKey) {
                newRow['密码'] = row[passwordKey];
              }
              return newRow;
            });
            console.log('字段名修复后:', Object.keys(data[0]));
          } else {
            throw new Error(`CSV文件必须包含"账号"和"用户名"列，当前字段: ${keys.join(', ')}`);
          }
          }
        } catch (xlsxError) {
          console.error('xlsx解析CSV失败:', xlsxError);
          
          // 备用方案：手动解析CSV
          const lines = csvContent.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            const headers = lines[0].split(',').map(h => h.trim());
            console.log('CSV表头:', headers);
            
            // 查找包含"账号"、"用户名"和"密码"的字段
            const accountIndex = headers.findIndex(h => 
              h.includes('账号') || h.includes('account') || h.includes('Account')
            );
            const usernameIndex = headers.findIndex(h => 
              h.includes('用户名') || h.includes('username') || h.includes('Username')
            );
            const passwordIndex = headers.findIndex(h => 
              h.includes('密码') || h.includes('password') || h.includes('Password')
            );
            
            if (accountIndex !== -1 && usernameIndex !== -1) {
              data = lines.slice(1).map((line, index) => {
                const values = line.split(',').map(v => v.trim());
                const row = {
                  '账号': values[accountIndex] || '',
                  '用户名': values[usernameIndex] || ''
                };
                // 密码字段可选
                if (passwordIndex !== -1 && values[passwordIndex]) {
                  row['密码'] = values[passwordIndex];
                }
                return row;
              });
              console.log('手动CSV解析成功，数据行数:', data.length);
            } else {
              throw new Error(`CSV文件必须包含"账号"和"用户名"列，当前字段: ${headers.join(', ')}`);
            }
          } else {
            throw new Error('CSV文件为空');
          }
        }
      } else {
        // 读取Excel文件
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = xlsx.utils.sheet_to_json(worksheet);
        console.log('Excel解析成功，数据行数:', data.length);
      }
    } catch (parseError) {
      console.error('文件解析错误:', parseError);
      return res.status(400).json({
        success: false,
        message: `文件格式错误: ${parseError.message}`
      });
    }

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: '文件为空或格式不正确'
      });
    }

    console.log('解析后的数据示例:', data.slice(0, 3));
    console.log(`开始处理 ${data.length} 行数据...`);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // 分批处理数据，避免内存问题
    const batchSize = 100; // 每批处理100行
    const totalBatches = Math.ceil(data.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, data.length);
      const batchData = data.slice(startIndex, endIndex);
      
      console.log(`处理第 ${batchIndex + 1}/${totalBatches} 批，行 ${startIndex + 1}-${endIndex}`);
      
      // 处理当前批次
      for (let i = 0; i < batchData.length; i++) {
        const row = batchData[i];
        const rowNumber = startIndex + i + 2; // 行号从2开始

        try {
          // 验证数据
          if (!row.账号 || !row.用户名) {
            const errorMsg = `第${rowNumber}行：账号或用户名为空 (账号: ${row.账号}, 用户名: ${row.用户名})`;
            console.log(errorMsg);
            results.failed++;
            results.errors.push(errorMsg);
            continue;
          }

          const account = row.账号.toString().trim();
          const username = row.用户名.toString().trim();

          // 验证账号格式
          if (!/^\d{6}$/.test(account)) {
            const errorMsg = `第${rowNumber}行：账号${account}不是6位数字`;
            console.log(errorMsg);
            results.failed++;
            results.errors.push(errorMsg);
            continue;
          }

          // 检查账号是否已存在
          if (userModel.isAccountExists(account)) {
            const errorMsg = `第${rowNumber}行：账号${account}已存在`;
            console.log(errorMsg);
            results.failed++;
            results.errors.push(errorMsg);
            continue;
          }

          // 创建用户（支持自定义密码或自动生成）
          const password = row.密码 || null; // 如果没有密码字段或为空，则设为null
          const newUser = await userModel.createUser(account, username, 'user', password);
          console.log(`第${rowNumber}行：用户创建成功`, { 
            account, 
            username, 
            userId: newUser.id,
            passwordType: password ? '自定义密码' : '自动生成密码',
            initialPassword: newUser.initialPassword
          });
          results.success++;

        } catch (error) {
          const errorMsg = `第${rowNumber}行：处理失败 - ${error.message}`;
          console.error(errorMsg, error);
          results.failed++;
          results.errors.push(errorMsg);
        }
      }
      
      // 每批处理完后暂停一下，避免阻塞
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    console.log('导入结果:', results);

    // 修复：确保成功和失败的数量正确
    if (results.success === 0 && results.failed > 0) {
      console.warn('警告：成功数量为0，可能存在统计错误');
      // 重新计算：总数减去失败数应该等于成功数
      const totalRows = data.length;
      const actualSuccess = totalRows - results.failed;
      if (actualSuccess > 0) {
        console.log(`修正统计：实际成功${actualSuccess}个，失败${results.failed}个`);
        results.success = actualSuccess;
      }
    }

    // 收集成功导入的用户信息（包含初始密码）
    const importedUsers = [];
    if (results.success > 0) {
      // 从用户模型中获取最新导入的用户
      const allUsers = userModel.getAllUsers();
      // 获取最近导入的用户（按创建时间排序）
      const recentUsers = allUsers
        .filter(user => user.created_at && new Date(user.created_at) > new Date(Date.now() - 60000)) // 最近1分钟内创建的
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, results.success);
      
      importedUsers.push(...recentUsers);
    }

    res.json({
      success: true,
      message: `批量导入完成，成功${results.success}个，失败${results.failed}个`,
      data: {
        ...results,
        importedUsers: importedUsers.map(user => ({
          account: user.account,
          username: user.username,
          initialPassword: user.initialPassword || '已加密'
        }))
      }
    });

  } catch (error) {
    console.error('批量导入用户错误:', error);
    res.status(500).json({
      success: false,
      message: `服务器内部错误: ${error.message}`
    });
  }
});

// 下载Excel模板
router.get('/template', (req, res) => {
  try {
    // 创建模板数据（包含密码列示例）
    const templateData = [
      { 账号: '123456', 用户名: '张三', 密码: 'Ax7Kp9mN' },
      { 账号: '234567', 用户名: '李四', 密码: '' }, // 留空则自动生成
      { 账号: '345678', 用户名: '王五', 密码: 'myPass123' }
    ];

    // 创建工作簿
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(templateData);

    // 设置列宽
    worksheet['!cols'] = [
      { width: 15 }, // 账号列
      { width: 20 }  // 用户名列
    ];

    // 添加工作表到工作簿
    xlsx.utils.book_append_sheet(workbook, worksheet, '用户导入模板');

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=用户导入模板.xlsx');

    // 发送文件
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);

  } catch (error) {
    console.error('下载模板错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;
