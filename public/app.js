/**
 * Main Application - P2P File Transfer
 * Flow: A chia sẻ danh sách files → B chọn file muốn tải → Transfer
 */

// Elements
const myIdBadge = document.getElementById('my-id-badge');
const myPeerId = document.getElementById('my-peer-id');
const copyIdBtn = document.getElementById('copy-id-btn');
const connectionStatus = document.getElementById('connection-status');
const mainInterface = document.getElementById('main-interface');
const peersList = document.getElementById('peers-list');
const peerCount = document.getElementById('peer-count');
const targetPeerIdInput = document.getElementById('target-peer-id');
const connectBtn = document.getElementById('connect-btn');
const connectionPanel = document.getElementById('connection-panel');
const connectedPeerId = document.getElementById('connected-peer-id');
const remotePeerAvatar = document.getElementById('remote-peer-avatar');
const disconnectBtn = document.getElementById('disconnect-btn');
const dropZone = document.getElementById('drop-zone');
const fileDropArea = document.getElementById('file-drop-area');
const fileInput = document.getElementById('file-input');
const transferSection = document.getElementById('transfer-section');
const transferList = document.getElementById('transfer-list');
const emptyState = document.getElementById('empty-state');
const toastContainer = document.getElementById('toast-container');
const myIpEl = document.getElementById('my-ip');
const myDeviceEl = document.getElementById('my-device');
const myDeviceIconEl = document.getElementById('my-device-icon');
const userProfileBar = document.getElementById('user-profile-bar');
const userNameInput = document.getElementById('user-name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const userAvatarText = document.getElementById('user-avatar-text');

// New elements for file sharing
const mySharedFilesSection = document.getElementById('my-shared-files');
const mySharedList = document.getElementById('my-shared-list');
const mySharedCount = document.getElementById('my-shared-count');
const peerSharedFilesSection = document.getElementById('peer-shared-files');
const peerSharedList = document.getElementById('peer-shared-list');
const peerNameFiles = document.getElementById('peer-name-files');
const downloadSelectedBtn = document.getElementById('download-selected-btn');
const receivedFilesSection = document.getElementById('received-files');
const receivedList = document.getElementById('received-list');

// State
let socket = null;
let mySocketId = null;
let myId = null;
let peers = [];
let webrtc = null;
let myName = '';
let mySharedFiles = new Map(); // fileId -> { file, name, size, type }
let peerSharedFiles = new Map(); // fileId -> { name, size, type }
let receivedFiles = new Map(); // fileId -> { blob, name }
let transfers = new Map();

// Initialize
function init() {
  socket = io();
  webrtc = new WebRTCHandler();
  setupSocketHandlers();
  setupUIHandlers();
  setupWebRTCCallbacks();
}

// Lấy IP public từ STUN server
async function getPublicIP() {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    
    let publicIP = null;
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate;
        // Tìm IP public từ candidate (srflx = server reflexive = public IP)
        const match = candidate.match(/candidate:\d+ \d+ \w+ \d+ ([0-9.]+|[a-f0-9:]+) \d+ typ (srflx|prflx)/);
        if (match && match[1]) {
          publicIP = match[1];
        }
      } else {
        // ICE gathering complete
        pc.close();
        resolve(publicIP);
      }
    };
    
    // Tạo data channel để trigger ICE gathering
    pc.createDataChannel('');
    pc.createOffer().then(offer => pc.setLocalDescription(offer));
    
    // Timeout sau 5 giây
    setTimeout(() => {
      pc.close();
      resolve(publicIP);
    }, 5000);
  });
}

// Socket handlers
function setupSocketHandlers() {
  socket.on('connect', () => {
    console.log('[Socket] Đã kết nối');
  });
  
  socket.on('your-id', async (data) => {
    mySocketId = socket.id;
    myId = data.peerId;
    myPeerId.textContent = data.peerId;
    myDeviceEl.textContent = data.device;
    myDeviceIconEl.textContent = data.deviceIcon;
    myName = `${data.animalName} ${data.peerId}`;
    userNameInput.value = myName;
    userAvatarText.textContent = data.avatar;
    myIdBadge.classList.remove('hidden');
    userProfileBar.classList.remove('hidden');
    connectionStatus.classList.add('hidden');
    mainInterface.classList.remove('hidden');
    
    // Hiển thị IP local trước
    myIpEl.textContent = data.ip;
    
    // Lấy IP public từ STUN
    showToast('info', '🌐 Đang lấy IP...', 'Kết nối STUN server');
    const publicIP = await getPublicIP();
    if (publicIP) {
      myIpEl.textContent = publicIP;
      console.log('[STUN] Public IP:', publicIP);
      showToast('success', `${data.avatar} Đã kết nối`, `🌐 ${publicIP} • ${data.animalName}`);
    } else {
      // Fallback to local IP
      myIpEl.textContent = data.ip + ' (local)';
      showToast('success', `${data.avatar} Đã kết nối`, `${data.deviceIcon} ${data.device} • ${data.animalName}`);
    }
  });


  socket.on('name-changed', (newName) => {
    myName = newName;
    showToast('success', 'Đổi tên thành công', `Tên mới: ${newName}`);
  });
  
  socket.on('peer-list', (list) => {
    peers = list;
    renderPeerList();
  });
  
  socket.on('peer-not-found', (peerId) => {
    showToast('error', 'Không tìm thấy', `Peer "${peerId}" không tồn tại`);
  });
  
  // WebRTC Signaling
  socket.on('sdp-offer', async ({ sdp, fromSocketId, fromPeerId }) => {
    await webrtc.handleOffer(socket, sdp, fromSocketId, fromPeerId);
  });
  
  socket.on('sdp-answer', async ({ sdp }) => {
    await webrtc.handleAnswer(sdp);
  });
  
  socket.on('ice-candidate', async ({ candidate }) => {
    await webrtc.handleIceCandidate(candidate);
  });
  
  socket.on('disconnect', () => {
    showToast('error', 'Mất kết nối', 'Đã ngắt kết nối với server');
    connectionStatus.classList.remove('hidden');
    mainInterface.classList.add('hidden');
  });
}

// UI Handlers
function setupUIHandlers() {
  copyIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(myId);
    showToast('success', 'Đã sao chép', 'Mã peer đã được sao chép');
  });
  
  connectBtn.addEventListener('click', () => {
    const targetId = targetPeerIdInput.value.trim().toUpperCase();
    if (targetId && targetId !== myId) {
      connectToPeer(targetId);
    }
  });
  
  targetPeerIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') connectBtn.click();
  });
  
  targetPeerIdInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  
  disconnectBtn.addEventListener('click', disconnectPeer);
  
  // File drop
  fileDropArea.addEventListener('click', () => fileInput.click());
  
  fileDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropArea.classList.add('dragover');
  });
  
  fileDropArea.addEventListener('dragleave', () => {
    fileDropArea.classList.remove('dragover');
  });
  
  fileDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropArea.classList.remove('dragover');
    addFilesToShare(e.dataTransfer.files);
  });
  
  fileInput.addEventListener('change', (e) => {
    addFilesToShare(e.target.files);
    fileInput.value = '';
  });
  
  // Save name
  saveNameBtn.addEventListener('click', () => {
    const newName = userNameInput.value.trim();
    if (newName && newName !== myName) {
      socket.emit('change-name', newName);
    }
  });
  
  userNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveNameBtn.click();
  });
  
  // Download selected files
  downloadSelectedBtn.addEventListener('click', downloadSelectedFiles);
}

// WebRTC Callbacks
function setupWebRTCCallbacks() {
  webrtc.onConnected = () => {
    showToast('success', 'Kết nối P2P', `Đã kết nối với ${webrtc.remotePeerId}`);
  };
  
  webrtc.onDisconnected = () => {
    disconnectPeer();
    showToast('error', 'Mất kết nối P2P', 'Kết nối đã bị ngắt');
  };
  
  webrtc.onDataChannelOpen = () => {
    showConnectedUI();
    showToast('info', 'Sẵn sàng', 'Có thể chia sẻ file');
    // Gửi danh sách file đang chia sẻ cho peer
    sendFileList();
  };
  
  webrtc.onDataChannelClose = disconnectPeer;
  
  // Nhận danh sách file từ peer
  webrtc.onFileListReceived = (fileList) => {
    peerSharedFiles.clear();
    fileList.forEach(f => peerSharedFiles.set(f.id, f));
    renderPeerSharedFiles();
  };
  
  // Nhận yêu cầu tải file
  webrtc.onFileRequest = (fileId) => {
    const file = mySharedFiles.get(fileId);
    if (file) {
      webrtc.sendFile(file.file, fileId);
      showToast('info', 'Đang gửi', file.name);
    }
  };
  
  webrtc.onFileProgress = (fileId, progress, current, total, type) => {
    updateTransferProgress(fileId, progress, current, total, type);
  };
  
  webrtc.onFileComplete = (fileId, blob, fileName, type) => {
    completeTransfer(fileId, type);
    if (type === 'receiving' && blob) {
      // Lưu file đã nhận, không tự động download
      receivedFiles.set(fileId, { blob, name: fileName });
      addReceivedFile(fileId, fileName, blob.size);
      showToast('success', 'Đã nhận', fileName);
    } else if (type === 'sending') {
      showToast('success', 'Đã gửi', fileName);
    }
  };
  
  webrtc.onFileError = (fileId, error, type) => {
    showToast('error', 'Lỗi', `Lỗi ${type === 'sending' ? 'gửi' : 'nhận'} file`);
  };
}

// Connect to peer
function connectToPeer(targetId) {
  const targetPeer = peers.find(p => p.id === targetId);
  if (targetPeer) {
    showToast('info', 'Đang kết nối...', `Kết nối với ${targetId}`);
    webrtc.createConnection(socket, targetPeer.socketId, targetId);
  } else {
    showToast('error', 'Không tìm thấy', `Peer "${targetId}" không tồn tại`);
  }
}

function disconnectPeer() {
  webrtc.close();
  hideConnectedUI();
  peerSharedFiles.clear();
  transfers.clear();
}

function showConnectedUI() {
  connectionPanel.classList.remove('hidden');
  dropZone.classList.remove('hidden');
  peerSharedFilesSection.classList.remove('hidden');
  emptyState.classList.add('hidden');
  connectedPeerId.textContent = webrtc.remotePeerId;
  remotePeerAvatar.textContent = webrtc.remotePeerId.substring(0, 2);
  peerNameFiles.textContent = webrtc.remotePeerId;
}

function hideConnectedUI() {
  connectionPanel.classList.add('hidden');
  dropZone.classList.add('hidden');
  mySharedFilesSection.classList.add('hidden');
  peerSharedFilesSection.classList.add('hidden');
  transferSection.classList.add('hidden');
  receivedFilesSection.classList.add('hidden');
  emptyState.classList.remove('hidden');
  mySharedFiles.clear();
  peerSharedFiles.clear();
  receivedFiles.clear();
  transfers.clear();
  transferList.innerHTML = '';
  mySharedList.innerHTML = '';
  peerSharedList.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Chưa có file nào được chia sẻ</p>';
  receivedList.innerHTML = '';
}

// Render peer list
function renderPeerList() {
  const otherPeers = peers.filter(p => p.socketId !== mySocketId);
  peerCount.textContent = otherPeers.length;
  
  if (otherPeers.length === 0) {
    peersList.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">Chưa có peer nào</div>';
    return;
  }
  
  peersList.innerHTML = otherPeers.map(peer => `
    <div class="peer-item" data-socket-id="${peer.socketId}" data-peer-id="${peer.id}">
      <div class="peer-avatar-emoji">${peer.avatar || '🐾'}</div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-sm text-gray-800">${peer.name}</p>
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span class="font-mono">${peer.id}</span>
          <span>•</span>
          <span>${peer.deviceIcon || '💻'} ${peer.device || 'Unknown'}</span>
        </div>
      </div>
      <div class="w-2 h-2 rounded-full bg-green-500"></div>
    </div>
  `).join('');
  
  peersList.querySelectorAll('.peer-item').forEach(item => {
    item.addEventListener('click', () => {
      targetPeerIdInput.value = item.dataset.peerId;
      connectToPeer(item.dataset.peerId);
    });
  });
}

// Add files to share
function addFilesToShare(files) {
  for (const file of files) {
    const fileId = Math.random().toString(36).substring(2, 10);
    mySharedFiles.set(fileId, {
      file,
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type
    });
  }
  renderMySharedFiles();
  sendFileList();
  showToast('success', 'Đã thêm', `${files.length} file để chia sẻ`);
}

// Render my shared files
function renderMySharedFiles() {
  if (mySharedFiles.size === 0) {
    mySharedFilesSection.classList.add('hidden');
    return;
  }
  
  mySharedFilesSection.classList.remove('hidden');
  mySharedCount.textContent = mySharedFiles.size;
  
  mySharedList.innerHTML = Array.from(mySharedFiles.values()).map(file => `
    <div class="file-item" data-file-id="${file.id}">
      <div class="file-icon ${getFileIconClass(file.type)}">${getFileEmoji(file.type)}</div>
      <div class="file-info">
        <p class="file-name">${escapeHtml(file.name)}</p>
        <p class="file-meta">${formatBytes(file.size)}</p>
      </div>
      <button class="file-remove-btn" onclick="removeSharedFile('${file.id}')">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');
}

// Remove shared file
window.removeSharedFile = function(fileId) {
  mySharedFiles.delete(fileId);
  renderMySharedFiles();
  sendFileList();
};

// Send file list to peer
function sendFileList() {
  if (webrtc.isConnected()) {
    const fileList = Array.from(mySharedFiles.values()).map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type
    }));
    webrtc.sendFileList(fileList);
  }
}

// Render peer's shared files
function renderPeerSharedFiles() {
  if (peerSharedFiles.size === 0) {
    peerSharedList.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Chưa có file nào được chia sẻ</p>';
    downloadSelectedBtn.classList.add('hidden');
    return;
  }
  
  peerSharedList.innerHTML = Array.from(peerSharedFiles.values()).map(file => `
    <div class="file-item" data-file-id="${file.id}">
      <input type="checkbox" class="file-checkbox" data-file-id="${file.id}">
      <div class="file-icon ${getFileIconClass(file.type)}">${getFileEmoji(file.type)}</div>
      <div class="file-info">
        <p class="file-name">${escapeHtml(file.name)}</p>
        <p class="file-meta">${formatBytes(file.size)}</p>
      </div>
      <button class="file-download-btn" onclick="requestFile('${file.id}')">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
      </button>
    </div>
  `).join('');
  
  // Update download selected button visibility
  const checkboxes = peerSharedList.querySelectorAll('.file-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', updateDownloadSelectedBtn);
  });
}

function updateDownloadSelectedBtn() {
  const checked = peerSharedList.querySelectorAll('.file-checkbox:checked');
  if (checked.length > 0) {
    downloadSelectedBtn.classList.remove('hidden');
    downloadSelectedBtn.textContent = `Tải về ${checked.length} file`;
  } else {
    downloadSelectedBtn.classList.add('hidden');
  }
}

// Request file from peer
window.requestFile = function(fileId) {
  const file = peerSharedFiles.get(fileId);
  if (file && webrtc.isConnected()) {
    addTransferItem(fileId, file.name, file.size, 'receiving');
    webrtc.requestFile(fileId);
  }
};

// Download selected files
function downloadSelectedFiles() {
  const checked = peerSharedList.querySelectorAll('.file-checkbox:checked');
  checked.forEach(cb => {
    const fileId = cb.dataset.fileId;
    requestFile(fileId);
    cb.checked = false;
  });
  updateDownloadSelectedBtn();
}

// Add received file to list
function addReceivedFile(fileId, name, size) {
  receivedFilesSection.classList.remove('hidden');
  
  const item = document.createElement('div');
  item.className = 'received-file-item';
  item.innerHTML = `
    <div class="file-icon ${getFileIconClass('')}">${getFileEmoji('')}</div>
    <div class="file-info">
      <p class="file-name">${escapeHtml(name)}</p>
      <p class="file-meta">${formatBytes(size)}</p>
    </div>
    <button class="file-download-btn" onclick="saveReceivedFile('${fileId}')">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
    </button>
  `;
  receivedList.appendChild(item);
}

// Save received file to device
window.saveReceivedFile = function(fileId) {
  const file = receivedFiles.get(fileId);
  if (file) {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Đã lưu', file.name);
  }
};

// Transfer progress
function addTransferItem(fileId, name, size, type) {
  transferSection.classList.remove('hidden');
  
  const item = document.createElement('div');
  item.className = 'transfer-item';
  item.id = `transfer-${fileId}`;
  item.innerHTML = `
    <div class="transfer-icon ${type}">
      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        ${type === 'sending' 
          ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>'
          : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>'}
      </svg>
    </div>
    <div class="transfer-info">
      <p class="transfer-name">${escapeHtml(name)}</p>
      <div class="transfer-meta">
        <span>${formatBytes(size)}</span>
        <span>•</span>
        <span class="transfer-speed">--</span>
      </div>
      <div class="transfer-progress-bar">
        <div class="transfer-progress-fill ${type}" style="width: 0%"></div>
      </div>
    </div>
    <div class="transfer-status transferring">
      <span class="transfer-percent">0%</span>
    </div>
  `;
  
  transferList.appendChild(item);
  transfers.set(fileId, { name, size, type, startTime: Date.now() });
}

function updateTransferProgress(fileId, progress, current, total, type) {
  const item = document.getElementById(`transfer-${fileId}`);
  if (!item) return;
  
  const fill = item.querySelector('.transfer-progress-fill');
  const percent = item.querySelector('.transfer-percent');
  const speed = item.querySelector('.transfer-speed');
  
  fill.style.width = `${progress}%`;
  percent.textContent = `${Math.round(progress)}%`;
  
  const transfer = transfers.get(fileId);
  if (transfer) {
    const elapsed = (Date.now() - transfer.startTime) / 1000;
    if (elapsed > 0) {
      speed.textContent = `${formatBytes(current / elapsed)}/s`;
    }
  }
}

function completeTransfer(fileId, type) {
  const item = document.getElementById(`transfer-${fileId}`);
  if (!item) return;
  
  item.querySelector('.transfer-progress-fill').style.width = '100%';
  const status = item.querySelector('.transfer-status');
  status.className = 'transfer-status completed';
  status.innerHTML = '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
}

// Utilities
function getFileEmoji(type) {
  if (!type) return '📄';
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📕';
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '📦';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
  return '📄';
}

function getFileIconClass(type) {
  if (!type) return 'default';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.includes('pdf') || type.includes('word') || type.includes('document')) return 'document';
  if (type.includes('zip') || type.includes('rar')) return 'archive';
  return 'default';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(type, title, message) {
  const icons = {
    success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
  };
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon ${type}">${icons[type]}</div>
    <div>
      <p class="font-medium text-sm text-gray-800">${title}</p>
      <p class="text-xs text-gray-500">${message}</p>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', init);
