// 候补预约数据模型
const fs = require('fs');
const path = require('path');

// 数据文件路径
const WAITLIST_FILE = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) + '/waitlist.json' : '/app/data/waitlist.json';

// 确保数据目录存在
const ensureDataDir = () => {
  const dir = path.dirname(WAITLIST_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 从文件加载等待列表数据
const loadWaitlistFromFile = () => {
  try {
    if (fs.existsSync(WAITLIST_FILE)) {
      const data = fs.readFileSync(WAITLIST_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return {
        entries: parsed.entries || [],
        nextId: parsed.nextId || 1
      };
    }
  } catch (error) {
    console.error('加载等待列表数据失败:', error);
  }
  
  // 如果文件不存在或读取失败，返回默认值
  return {
    entries: [],
    nextId: 1
  };
};

// 保存等待列表数据到文件
const saveWaitlistToFile = (entries, nextId) => {
  try {
    ensureDataDir();
    const data = {
      entries,
      nextId
    };
    fs.writeFileSync(WAITLIST_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('等待列表数据已保存到文件');
  } catch (error) {
    console.error('保存等待列表数据失败:', error);
  }
};

// 加载数据
const loadedData = loadWaitlistFromFile();
let waitlistEntries = loadedData.entries;
let nextWaitlistId = loadedData.nextId;

// 加入候补
const joinWaitlist = (sessionId, userId, userAccount, userUsername) => {
  // 检查用户是否已经在该场次的候补中
  const existingEntry = waitlistEntries.find(entry => 
    entry.session_id === parseInt(sessionId) && 
    entry.user_id === userId && 
    entry.status === 'waiting'
  );
  
  if (existingEntry) {
    return { success: false, message: '您已经在该场次的候补名单中' };
  }
  
  // 创建新的候补记录
  const newEntry = {
    id: nextWaitlistId++,
    user_id: userId,
    session_id: parseInt(sessionId),
    user_account: userAccount,
    user_username: userUsername,
    status: 'waiting',
    created_at: new Date().toISOString()
  };
  
  waitlistEntries.push(newEntry);
  
  // 保存到文件
  saveWaitlistToFile(waitlistEntries, nextWaitlistId);
  
  return { 
    success: true, 
    message: '已加入候补名单',
    data: newEntry
  };
};

// 离开候补
const leaveWaitlist = (sessionId, userId) => {
  const entryIndex = waitlistEntries.findIndex(entry => 
    entry.session_id === parseInt(sessionId) && 
    entry.user_id === userId && 
    entry.status === 'waiting'
  );
  
  if (entryIndex === -1) {
    return { success: false, message: '您不在该场次的候补名单中' };
  }
  
  // 更新状态为已取消
  waitlistEntries[entryIndex].status = 'cancelled';
  waitlistEntries[entryIndex].cancelled_at = new Date().toISOString();
  
  // 保存到文件
  saveWaitlistToFile(waitlistEntries, nextWaitlistId);
  
  return { 
    success: true, 
    message: '已离开候补名单'
  };
};

// 获取场次候补列表
const getSessionWaitlist = (sessionId) => {
  return waitlistEntries.filter(entry => 
    entry.session_id === parseInt(sessionId) && 
    entry.status === 'waiting'
  );
};

// 获取场次候补人数
const getSessionWaitlistCount = (sessionId) => {
  return waitlistEntries.filter(entry => 
    entry.session_id === parseInt(sessionId) && 
    entry.status === 'waiting'
  ).length;
};

// 检查用户是否在候补中
const isUserInWaitlist = (sessionId, userId) => {
  return waitlistEntries.some(entry => 
    entry.session_id === parseInt(sessionId) && 
    entry.user_id === userId && 
    entry.status === 'waiting'
  );
};

// 获取所有候补统计信息
const getWaitlistOverview = () => {
  const overview = {};
  
  // 按场次分组统计
  waitlistEntries.forEach(entry => {
    if (entry.status === 'waiting') {
      if (!overview[entry.session_id]) {
        overview[entry.session_id] = {
          session_id: entry.session_id,
          count: 0,
          users: []
        };
      }
      overview[entry.session_id].count++;
      overview[entry.session_id].users.push({
        user_id: entry.user_id,
        user_account: entry.user_account,
        user_username: entry.user_username,
        created_at: entry.created_at
      });
    }
  });
  
  return Object.values(overview);
};

// 清理过期的候补记录（超过7天的已取消记录）
const cleanupExpiredWaitlist = () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  waitlistEntries = waitlistEntries.filter(entry => {
    if (entry.status === 'cancelled' && entry.cancelled_at) {
      return new Date(entry.cancelled_at) > sevenDaysAgo;
    }
    return true;
  });
};

// 清理指定场次的所有投票数据
const clearSessionWaitlist = (sessionId) => {
  const beforeCount = waitlistEntries.length;
  waitlistEntries = waitlistEntries.filter(entry => entry.session_id !== parseInt(sessionId));
  const afterCount = waitlistEntries.length;
  
  // 保存到文件
  saveWaitlistToFile(waitlistEntries, nextWaitlistId);
  
  return beforeCount - afterCount;
};

// 定时清理过期记录
setInterval(cleanupExpiredWaitlist, 24 * 60 * 60 * 1000); // 每24小时清理一次

module.exports = {
  joinWaitlist,
  leaveWaitlist,
  getSessionWaitlist,
  getSessionWaitlistCount,
  isUserInWaitlist,
  getWaitlistOverview,
  clearSessionWaitlist,
  waitlistEntries
};
