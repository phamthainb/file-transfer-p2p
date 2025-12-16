/**
 * Signaling Server cho ứng dụng chia sẻ file P2P
 * 
 * Nhiệm vụ:
 * 1. Quản lý peers online (cấp ID, lưu danh sách)
 * 2. Relay SDP Offer/Answer giữa các peers
 * 3. Relay ICE Candidates
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files từ thư mục public
app.use(express.static(path.join(__dirname, '../public')));

// Lưu trữ thông tin các peers đang online
const peers = new Map(); // Map<socketId, { id, name, status, ip, avatar }>

// Danh sách 100 loài động vật với emoji
const ANIMALS = [
  { emoji: '🐶', name: 'Chó' },
  { emoji: '🐱', name: 'Mèo' },
  { emoji: '🐭', name: 'Chuột' },
  { emoji: '🐹', name: 'Hamster' },
  { emoji: '🐰', name: 'Thỏ' },
  { emoji: '🦊', name: 'Cáo' },
  { emoji: '🐻', name: 'Gấu' },
  { emoji: '🐼', name: 'Gấu trúc' },
  { emoji: '🐨', name: 'Koala' },
  { emoji: '🐯', name: 'Hổ' },
  { emoji: '🦁', name: 'Sư tử' },
  { emoji: '🐮', name: 'Bò' },
  { emoji: '🐷', name: 'Heo' },
  { emoji: '🐸', name: 'Ếch' },
  { emoji: '🐵', name: 'Khỉ' },
  { emoji: '🐔', name: 'Gà' },
  { emoji: '🐧', name: 'Chim cánh cụt' },
  { emoji: '🐦', name: 'Chim' },
  { emoji: '🐤', name: 'Gà con' },
  { emoji: '🦆', name: 'Vịt' },
  { emoji: '🦅', name: 'Đại bàng' },
  { emoji: '🦉', name: 'Cú mèo' },
  { emoji: '🦇', name: 'Dơi' },
  { emoji: '🐺', name: 'Sói' },
  { emoji: '🐗', name: 'Heo rừng' },
  { emoji: '🐴', name: 'Ngựa' },
  { emoji: '🦄', name: 'Kỳ lân' },
  { emoji: '🐝', name: 'Ong' },
  { emoji: '🐛', name: 'Sâu' },
  { emoji: '🦋', name: 'Bướm' },
  { emoji: '🐌', name: 'Ốc sên' },
  { emoji: '🐞', name: 'Bọ rùa' },
  { emoji: '🐜', name: 'Kiến' },
  { emoji: '🦗', name: 'Dế' },
  { emoji: '🐢', name: 'Rùa' },
  { emoji: '🐍', name: 'Rắn' },
  { emoji: '🦎', name: 'Thằn lằn' },
  { emoji: '🐊', name: 'Cá sấu' },
  { emoji: '🦖', name: 'Khủng long' },
  { emoji: '🐳', name: 'Cá voi' },
  { emoji: '🐬', name: 'Cá heo' },
  { emoji: '🦭', name: 'Hải cẩu' },
  { emoji: '🐟', name: 'Cá' },
  { emoji: '🐠', name: 'Cá nhiệt đới' },
  { emoji: '🐡', name: 'Cá nóc' },
  { emoji: '🦈', name: 'Cá mập' },
  { emoji: '🐙', name: 'Bạch tuộc' },
  { emoji: '🦀', name: 'Cua' },
  { emoji: '🦞', name: 'Tôm hùm' },
  { emoji: '🦐', name: 'Tôm' },
  { emoji: '🦑', name: 'Mực' },
  { emoji: '🐘', name: 'Voi' },
  { emoji: '🦏', name: 'Tê giác' },
  { emoji: '🦛', name: 'Hà mã' },
  { emoji: '🐪', name: 'Lạc đà' },
  { emoji: '🦒', name: 'Hươu cao cổ' },
  { emoji: '🦘', name: 'Kangaroo' },
  { emoji: '🦧', name: 'Đười ươi' },
  { emoji: '🦥', name: 'Con lười' },
  { emoji: '🦦', name: 'Rái cá' },
  { emoji: '🦨', name: 'Chồn hôi' },
  { emoji: '🦝', name: 'Gấu mèo' },
  { emoji: '🦃', name: 'Gà tây' },
  { emoji: '🦚', name: 'Công' },
  { emoji: '🦩', name: 'Hồng hạc' },
  { emoji: '🦜', name: 'Vẹt' },
  { emoji: '🦢', name: 'Thiên nga' },
  { emoji: '🐂', name: 'Trâu' },
  { emoji: '🐃', name: 'Trâu nước' },
  { emoji: '🐄', name: 'Bò sữa' },
  { emoji: '🐏', name: 'Cừu đực' },
  { emoji: '🐑', name: 'Cừu' },
  { emoji: '🐐', name: 'Dê' },
  { emoji: '🐫', name: 'Lạc đà 2 bướu' },
  { emoji: '🦙', name: 'Llama' },
  { emoji: '🦣', name: 'Ma mút' },
  { emoji: '🐈', name: 'Mèo nhà' },
  { emoji: '🐕', name: 'Chó nhà' },
  { emoji: '🦮', name: 'Chó dẫn đường' },
  { emoji: '🐩', name: 'Chó Poodle' },
  { emoji: '🐀', name: 'Chuột cống' },
  { emoji: '🐁', name: 'Chuột nhắt' },
  { emoji: '🐿️', name: 'Sóc' },
  { emoji: '🦔', name: 'Nhím' },
  { emoji: '🐉', name: 'Rồng' },
  { emoji: '🐲', name: 'Rồng châu Á' },
  { emoji: '🦕', name: 'Khủng long cổ dài' },
  { emoji: '🦤', name: 'Chim Dodo' },
  { emoji: '🪿', name: 'Ngỗng' },
  { emoji: '🐓', name: 'Gà trống' },
  { emoji: '🦌', name: 'Hươu' },
  { emoji: '🐾', name: 'Thú cưng' },
  { emoji: '🦫', name: 'Hải ly' },
  { emoji: '🪶', name: 'Chim lông vũ' },
  { emoji: '🦠', name: 'Vi khuẩn' },
  { emoji: '🐚', name: 'Sò biển' },
  { emoji: '🪼', name: 'Sứa' },
  { emoji: '🪸', name: 'San hô' },
  { emoji: '🦂', name: 'Bọ cạp' }
];

// Lấy random avatar
function getRandomAnimal() {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

// Lấy IP thực từ request
function getClientIP(socket) {
  const headers = socket.handshake.headers;
  // Kiểm tra các header phổ biến cho proxy/load balancer
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  // Fallback to socket address
  return socket.handshake.address.replace('::ffff:', '').replace('::1', '127.0.0.1');
}

// Phân tích User-Agent để xác định thiết bị
function parseUserAgent(ua) {
  if (!ua) return { device: 'Unknown', icon: '💻' };
  
  const uaLower = ua.toLowerCase();
  
  // iPhone models
  if (uaLower.includes('iphone')) {
    if (ua.includes('iPhone14,2') || ua.includes('iPhone 13 Pro')) return { device: 'iPhone 13 Pro', icon: '📱' };
    if (ua.includes('iPhone14,3') || ua.includes('iPhone 13 Pro Max')) return { device: 'iPhone 13 Pro Max', icon: '📱' };
    if (ua.includes('iPhone15') || uaLower.includes('iphone 14')) return { device: 'iPhone 14', icon: '📱' };
    if (ua.includes('iPhone16') || uaLower.includes('iphone 15')) return { device: 'iPhone 15', icon: '📱' };
    return { device: 'iPhone', icon: '📱' };
  }
  
  // iPad
  if (uaLower.includes('ipad')) {
    if (uaLower.includes('ipad pro')) return { device: 'iPad Pro', icon: '📱' };
    return { device: 'iPad', icon: '📱' };
  }
  
  // Android devices
  if (uaLower.includes('android')) {
    // Samsung
    if (uaLower.includes('samsung') || uaLower.includes('sm-')) {
      if (uaLower.includes('sm-s9') || uaLower.includes('galaxy s23')) return { device: 'Samsung Galaxy S23', icon: '📱' };
      if (uaLower.includes('sm-s8') || uaLower.includes('galaxy s22')) return { device: 'Samsung Galaxy S22', icon: '📱' };
      if (uaLower.includes('galaxy')) return { device: 'Samsung Galaxy', icon: '📱' };
      return { device: 'Samsung', icon: '📱' };
    }
    // Xiaomi
    if (uaLower.includes('xiaomi') || uaLower.includes('redmi') || uaLower.includes('poco')) {
      if (uaLower.includes('redmi')) return { device: 'Xiaomi Redmi', icon: '📱' };
      if (uaLower.includes('poco')) return { device: 'Xiaomi POCO', icon: '📱' };
      return { device: 'Xiaomi', icon: '📱' };
    }
    // OPPO
    if (uaLower.includes('oppo')) return { device: 'OPPO', icon: '📱' };
    // Vivo
    if (uaLower.includes('vivo')) return { device: 'Vivo', icon: '📱' };
    // Huawei
    if (uaLower.includes('huawei')) return { device: 'Huawei', icon: '📱' };
    // OnePlus
    if (uaLower.includes('oneplus')) return { device: 'OnePlus', icon: '📱' };
    // Google Pixel
    if (uaLower.includes('pixel')) return { device: 'Google Pixel', icon: '📱' };
    
    // Generic Android với tablet check
    if (uaLower.includes('tablet') || (uaLower.includes('android') && !uaLower.includes('mobile'))) {
      return { device: 'Android Tablet', icon: '📱' };
    }
    return { device: 'Android', icon: '📱' };
  }
  
  // macOS
  if (uaLower.includes('macintosh') || uaLower.includes('mac os')) {
    if (uaLower.includes('mac os x 10_15') || uaLower.includes('macos 10.15')) return { device: 'MacBook (Catalina)', icon: '💻' };
    if (uaLower.includes('mac os x 11') || uaLower.includes('macos 11')) return { device: 'MacBook (Big Sur)', icon: '💻' };
    if (uaLower.includes('mac os x 12') || uaLower.includes('macos 12')) return { device: 'MacBook (Monterey)', icon: '💻' };
    if (uaLower.includes('mac os x 13') || uaLower.includes('macos 13')) return { device: 'MacBook (Ventura)', icon: '💻' };
    if (uaLower.includes('mac os x 14') || uaLower.includes('macos 14')) return { device: 'MacBook (Sonoma)', icon: '💻' };
    return { device: 'Mac', icon: '💻' };
  }
  
  // Windows
  if (uaLower.includes('windows')) {
    if (uaLower.includes('windows nt 10.0')) {
      if (uaLower.includes('win64') || uaLower.includes('wow64')) return { device: 'Windows 10/11 PC', icon: '🖥️' };
      return { device: 'Windows 10/11', icon: '🖥️' };
    }
    if (uaLower.includes('windows nt 6.3')) return { device: 'Windows 8.1', icon: '🖥️' };
    if (uaLower.includes('windows nt 6.1')) return { device: 'Windows 7', icon: '🖥️' };
    return { device: 'Windows PC', icon: '🖥️' };
  }
  
  // Linux
  if (uaLower.includes('linux')) {
    if (uaLower.includes('ubuntu')) return { device: 'Ubuntu Linux', icon: '🐧' };
    if (uaLower.includes('fedora')) return { device: 'Fedora Linux', icon: '🐧' };
    return { device: 'Linux', icon: '🐧' };
  }
  
  // Chrome OS
  if (uaLower.includes('cros')) return { device: 'Chromebook', icon: '💻' };
  
  return { device: 'Unknown Device', icon: '💻' };
}

// Tạo ID ngắn gọn cho peer
function generatePeerId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}


io.on('connection', (socket) => {
  const peerId = generatePeerId();
  const clientIP = getClientIP(socket);
  const avatar = getRandomAnimal();
  const userAgent = socket.handshake.headers['user-agent'] || '';
  const deviceInfo = parseUserAgent(userAgent);
  
  console.log(`[${new Date().toLocaleTimeString()}] Peer kết nối: ${avatar.emoji} ${avatar.name} ${peerId} | ${deviceInfo.icon} ${deviceInfo.device} (IP: ${clientIP})`);
  
  // Lưu thông tin peer
  peers.set(socket.id, {
    id: peerId,
    name: `${avatar.name} ${peerId}`,
    status: 'online',
    ip: clientIP,
    avatar: avatar.emoji,
    device: deviceInfo.device,
    deviceIcon: deviceInfo.icon
  });
  
  // Gửi ID, IP, avatar và device cho peer vừa kết nối
  socket.emit('your-id', { 
    peerId, 
    ip: clientIP, 
    avatar: avatar.emoji, 
    animalName: avatar.name,
    device: deviceInfo.device,
    deviceIcon: deviceInfo.icon
  });


  
  // Thông báo danh sách peers cho tất cả
  broadcastPeerList();
  
  // ===== XỬ LÝ ĐỔI TÊN =====
  
  socket.on('change-name', (newName) => {
    const peer = peers.get(socket.id);
    if (peer && newName && newName.trim()) {
      peer.name = newName.trim().substring(0, 30); // Giới hạn 30 ký tự
      console.log(`[${new Date().toLocaleTimeString()}] ${peerId} đổi tên thành: ${peer.name}`);
      broadcastPeerList();
      socket.emit('name-changed', peer.name);
    }
  });
  
  // ===== XỬ LÝ SIGNALING =====
  
  // Peer muốn kết nối với peer khác
  socket.on('connect-to-peer', (targetPeerId) => {
    const targetSocket = findSocketByPeerId(targetPeerId);
    if (targetSocket) {
      console.log(`[${new Date().toLocaleTimeString()}] ${peerId} muốn kết nối với ${targetPeerId}`);
      // Thông báo cho peer đích
      targetSocket.emit('connection-request', {
        fromPeerId: peerId,
        fromSocketId: socket.id
      });
    } else {
      socket.emit('peer-not-found', targetPeerId);
    }
  });
  
  // Relay SDP Offer
  socket.on('sdp-offer', ({ targetSocketId, sdp }) => {
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      console.log(`[${new Date().toLocaleTimeString()}] Relay SDP Offer: ${peerId} -> ${peers.get(targetSocketId)?.id}`);
      targetSocket.emit('sdp-offer', {
        sdp,
        fromSocketId: socket.id,
        fromPeerId: peerId
      });
    }
  });
  
  // Relay SDP Answer
  socket.on('sdp-answer', ({ targetSocketId, sdp }) => {
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      console.log(`[${new Date().toLocaleTimeString()}] Relay SDP Answer: ${peerId} -> ${peers.get(targetSocketId)?.id}`);
      targetSocket.emit('sdp-answer', {
        sdp,
        fromSocketId: socket.id,
        fromPeerId: peerId
      });
    }
  });
  
  // Relay ICE Candidates
  socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit('ice-candidate', {
        candidate,
        fromSocketId: socket.id
      });
    }
  });
  
  // ===== XỬ LÝ FILE TRANSFER =====
  
  // Yêu cầu gửi file
  socket.on('file-request', ({ targetSocketId, fileInfo }) => {
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      console.log(`[${new Date().toLocaleTimeString()}] Yêu cầu gửi file: ${fileInfo.name} (${formatBytes(fileInfo.size)})`);
      targetSocket.emit('file-request', {
        fileInfo,
        fromSocketId: socket.id,
        fromPeerId: peerId
      });
    }
  });
  
  // Chấp nhận nhận file
  socket.on('file-accept', ({ targetSocketId }) => {
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      console.log(`[${new Date().toLocaleTimeString()}] Chấp nhận nhận file từ ${peerId}`);
      targetSocket.emit('file-accepted', {
        fromSocketId: socket.id
      });
    }
  });
  
  // Từ chối nhận file
  socket.on('file-reject', ({ targetSocketId }) => {
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit('file-rejected', {
        fromSocketId: socket.id
      });
    }
  });
  
  // ===== NGẮT KẾT NỐI =====
  
  socket.on('disconnect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Peer ngắt kết nối: ${peerId}`);
    peers.delete(socket.id);
    broadcastPeerList();
  });
});

// Tìm socket theo Peer ID
function findSocketByPeerId(peerId) {
  for (const [socketId, peer] of peers) {
    if (peer.id === peerId) {
      return io.sockets.sockets.get(socketId);
    }
  }
  return null;
}

// Broadcast danh sách peers cho tất cả
function broadcastPeerList() {
  const peerList = Array.from(peers.entries()).map(([socketId, peer]) => ({
    socketId,
    ...peer
  }));
  io.emit('peer-list', peerList);
}

// Format bytes thành chuỗi dễ đọc
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 Server đang chạy tại: http://localhost:${PORT}             ║
║                                                               ║
║   📁 Ứng dụng chia sẻ file P2P qua WebRTC                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
