// 预订数据管理模块
const fs = require('fs');
const path = require('path');

// 数据文件路径
const BOOKINGS_FILE = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) + '/bookings.json' : '/app/data/bookings.json';

// 确保数据目录存在
const ensureDataDir = () => {
  const dir = path.dirname(BOOKINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 从文件加载预订数据
const loadBookingsFromFile = () => {
  try {
    if (fs.existsSync(BOOKINGS_FILE)) {
      const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载预订数据失败:', error);
  }
  
  // 如果文件不存在或读取失败，返回空对象
  return {};
};

// 保存预订数据到文件
const saveBookingsToFile = (bookingsData) => {
  try {
    ensureDataDir();
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookingsData, null, 2), 'utf8');
    console.log('预订数据已保存到文件');
  } catch (error) {
    console.error('保存预订数据失败:', error);
  }
};

let userBookings = loadBookingsFromFile(); // 按用户ID分组存储
let seatLocks = new Map(); // 座位锁机制，防止并发预订

// 座位锁管理
const acquireSeatLock = (sessionId, seatKey, userId, timeout = 5000) => {
  const lockKey = `${sessionId}-${seatKey}`;
  const now = Date.now();
  
  // 检查锁是否被占用
  if (seatLocks.has(lockKey)) {
    const lock = seatLocks.get(lockKey);
    if (now - lock.timestamp < lock.timeout) {
      return false; // 锁被占用
    }
  }
  
  // 获取锁
  seatLocks.set(lockKey, {
    userId,
    timestamp: now,
    timeout
  });
  
  return true;
};

const releaseSeatLock = (sessionId, seatKey) => {
  const lockKey = `${sessionId}-${seatKey}`;
  seatLocks.delete(lockKey);
};

// 原子性座位预订
const atomicReserveSeats = (sessionId, seats, userId) => {
  const sessionIdInt = parseInt(sessionId);
  
  try {
    // 1. 尝试获取所有座位的锁
    const seatKeys = seats.map(seat => `${seat.row}-${seat.col}`);
    const acquiredLocks = [];
    
    for (const seatKey of seatKeys) {
      if (!acquireSeatLock(sessionIdInt, seatKey, userId, 10000)) {
        // 如果无法获取锁，释放已获取的锁
        acquiredLocks.forEach(lock => releaseSeatLock(sessionIdInt, lock));
        return { success: false, message: '座位已被其他用户预订，请重新选择' };
      }
      acquiredLocks.push(seatKey);
    }
    
    // 2. 再次检查座位可用性（双重检查）
    const allExistingBookings = Object.values(userBookings).flat();
    const existingBookings = allExistingBookings.filter(booking => 
      booking.session_id === sessionIdInt && 
      booking.status === 'active'
    );
    
    const conflictingSeats = [];
    existingBookings.forEach(booking => {
      if (booking.seats && Array.isArray(booking.seats)) {
        booking.seats.forEach(bookedSeat => {
          seats.forEach(newSeat => {
            if (bookedSeat.row === newSeat.row && bookedSeat.col === newSeat.col) {
              conflictingSeats.push(`第${newSeat.row}排${newSeat.col}号`);
            }
          });
        });
      }
    });
    
    if (conflictingSeats.length > 0) {
      // 释放所有锁
      acquiredLocks.forEach(lock => releaseSeatLock(sessionIdInt, lock));
      return { success: false, message: `以下座位已被预订：${conflictingSeats.join('、')}` };
    }
    
    // 3. 创建预订记录
    const newBooking = {
      id: userBookings[userId] ? (userBookings[userId].length > 0 ? Math.max(...userBookings[userId].map(b => b.id)) + 1 : 1) : 1,
      user_id: userId,
      session_id: sessionIdInt,
      seats: seats.map(seat => ({
        row: seat.row,
        col: seat.col
      })),
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    // 4. 保存预订
    if (!userBookings[userId]) {
      userBookings[userId] = [];
    }
    userBookings[userId].push(newBooking);
    
    // 保存到文件
    saveBookingsToFile(userBookings);
    
    // 5. 释放所有锁
    acquiredLocks.forEach(lock => releaseSeatLock(sessionIdInt, lock));
    
    return { success: true, data: newBooking };
    
  } catch (error) {
    console.error('原子性预订失败:', error);
    // 确保释放所有锁
    const seatKeys = seats.map(seat => `${seat.row}-${seat.col}`);
    seatKeys.forEach(seatKey => releaseSeatLock(sessionIdInt, seatKey));
    return { success: false, message: '预订失败，请重试' };
  }
};

// 定期清理过期的锁（防止内存泄漏）
setInterval(() => {
  const now = Date.now();
  for (const [lockKey, lock] of seatLocks.entries()) {
    if (now - lock.timestamp > lock.timeout) {
      seatLocks.delete(lockKey);
    }
  }
}, 30000); // 每30秒清理一次

// 清理指定场次的所有预订
const clearSessionBookings = (sessionId) => {
  let totalCleared = 0;
  
  // 1. 清理用户预订
  Object.keys(userBookings).forEach(userId => {
    if (userBookings[userId]) {
      // 过滤掉该场次的预订
      const beforeCount = userBookings[userId].length;
      userBookings[userId] = userBookings[userId].filter(booking => 
        booking.session_id !== parseInt(sessionId)
      );
      const afterCount = userBookings[userId].length;
      totalCleared += (beforeCount - afterCount);
    }
  });
  
  // 2. 清理座位锁（重要！）
  const sessionIdStr = sessionId.toString();
  for (const [lockKey, lock] of seatLocks.entries()) {
    if (lockKey.startsWith(`${sessionIdStr}-`)) {
      seatLocks.delete(lockKey);
      console.log(`清理座位锁: ${lockKey}`);
    }
  }
  
  // 3. 保存到文件
  saveBookingsToFile(userBookings);
  
  console.log(`场次${sessionId}清理完成: 预订记录${totalCleared}条, 座位锁已清理`);
  return totalCleared;
};

// 获取用户预订
const getUserBookings = (userId) => {
  if (!userBookings[userId]) {
    userBookings[userId] = [];
  }
  return userBookings[userId];
};

// 添加用户预订
const addUserBooking = (userId, booking) => {
  if (!userBookings[userId]) {
    userBookings[userId] = [];
  }
  userBookings[userId].push(booking);
  
  // 保存到文件
  saveBookingsToFile(userBookings);
};

// 获取场次预订信息
const getSessionBookings = (sessionId) => {
  const allBookings = [];
  Object.values(userBookings).forEach(userBookingList => {
    userBookingList.forEach(booking => {
      if (booking.session_id === parseInt(sessionId)) {
        allBookings.push(booking);
      }
    });
  });
  return allBookings;
};

// 获取场次座位状态
const getSessionSeats = (sessionId) => {
  const allBookedSeats = [];
  Object.values(userBookings).forEach(userBookingList => {
    userBookingList.forEach(booking => {
      if (booking.session_id === parseInt(sessionId) && booking.status === 'active') {
        if (booking.seats && Array.isArray(booking.seats)) {
          booking.seats.forEach(seat => {
            allBookedSeats.push({
              row: seat.row,
              col: seat.col,
              user_id: booking.user_id,
              status: 'booked'
            });
          });
        }
      }
    });
  });
  return allBookedSeats;
};

module.exports = {
  userBookings,
  clearSessionBookings,
  getUserBookings,
  addUserBooking,
  getSessionBookings,
  getSessionSeats,
  atomicReserveSeats
};
