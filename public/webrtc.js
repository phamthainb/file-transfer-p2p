/**
 * WebRTC Handler - Quản lý kết nối P2P và truyền file
 * Hỗ trợ: Chia sẻ danh sách file, yêu cầu tải file theo ID
 */

class WebRTCHandler {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.remoteSocketId = null;
    this.remotePeerId = null;
    
    // File transfer state
    this.receivingFiles = new Map();
    this.sendingFiles = new Map();
    this.pendingFiles = new Map(); // Files đang chờ gửi khi có request
    
    // Callbacks
    this.onConnected = null;
    this.onDisconnected = null;
    this.onDataChannelOpen = null;
    this.onDataChannelClose = null;
    this.onFileProgress = null;
    this.onFileComplete = null;
    this.onFileError = null;
    this.onFileListReceived = null; // Nhận danh sách file từ peer
    this.onFileRequest = null; // Peer yêu cầu tải file
    
    // ICE Servers configuration
    this.iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ]
    };
    
    // Chunk size for file transfer (16KB)
    this.CHUNK_SIZE = 16384;
  }
  
  // Tạo kết nối mới với peer
  async createConnection(socket, targetSocketId, targetPeerId) {
    this.remoteSocketId = targetSocketId;
    this.remotePeerId = targetPeerId;
    
    this.peerConnection = new RTCPeerConnection(this.iceServers);
    this._setupPeerConnectionHandlers(socket);
    
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true
    });
    this._setupDataChannelHandlers();
    
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      socket.emit('sdp-offer', {
        targetSocketId: targetSocketId,
        sdp: offer
      });
      
      console.log('[WebRTC] Đã gửi SDP Offer');
    } catch (error) {
      console.error('[WebRTC] Lỗi tạo offer:', error);
      throw error;
    }
  }
  
  // Xử lý khi nhận SDP Offer
  async handleOffer(socket, offer, fromSocketId, fromPeerId) {
    this.remoteSocketId = fromSocketId;
    this.remotePeerId = fromPeerId;
    
    this.peerConnection = new RTCPeerConnection(this.iceServers);
    this._setupPeerConnectionHandlers(socket);
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    socket.emit('sdp-answer', {
      targetSocketId: fromSocketId,
      sdp: answer
    });
    
    console.log('[WebRTC] Đã gửi SDP Answer');
  }
  
  // Xử lý khi nhận SDP Answer
  async handleAnswer(answer) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('[WebRTC] Đã nhận SDP Answer');
  }
  
  // Xử lý ICE Candidate
  async handleIceCandidate(candidate) {
    if (this.peerConnection && candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[WebRTC] Lỗi thêm ICE candidate:', error);
      }
    }
  }
  
  // Setup handlers cho PeerConnection
  _setupPeerConnectionHandlers(socket) {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          targetSocketId: this.remoteSocketId,
          candidate: event.candidate
        });
      }
    };
    
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE State:', this.peerConnection.iceConnectionState);
      
      if (this.peerConnection.iceConnectionState === 'connected') {
        if (this.onConnected) this.onConnected();
      } else if (this.peerConnection.iceConnectionState === 'disconnected' || 
                 this.peerConnection.iceConnectionState === 'failed') {
        if (this.onDisconnected) this.onDisconnected();
      }
    };
    
    this.peerConnection.ondatachannel = (event) => {
      console.log('[WebRTC] Nhận Data Channel');
      this.dataChannel = event.channel;
      this._setupDataChannelHandlers();
    };
  }
  
  // Setup handlers cho Data Channel
  _setupDataChannelHandlers() {
    this.dataChannel.binaryType = 'arraybuffer';
    
    this.dataChannel.onopen = () => {
      console.log('[WebRTC] Data Channel OPEN');
      if (this.onDataChannelOpen) this.onDataChannelOpen();
    };
    
    this.dataChannel.onclose = () => {
      console.log('[WebRTC] Data Channel CLOSE');
      if (this.onDataChannelClose) this.onDataChannelClose();
    };
    
    this.dataChannel.onerror = (error) => {
      console.error('[WebRTC] Data Channel Error:', error);
    };
    
    this.dataChannel.onmessage = (event) => {
      this._handleDataChannelMessage(event);
    };
  }
  
  // Xử lý message từ Data Channel
  _handleDataChannelMessage(event) {
    if (typeof event.data === 'string') {
      const message = JSON.parse(event.data);
      
      // Nhận danh sách file từ peer
      if (message.type === 'file-list') {
        console.log('[WebRTC] Nhận danh sách file:', message.files.length);
        if (this.onFileListReceived) {
          this.onFileListReceived(message.files);
        }
      }
      // Peer yêu cầu tải file
      else if (message.type === 'file-request') {
        console.log('[WebRTC] Nhận yêu cầu tải file:', message.fileId);
        if (this.onFileRequest) {
          this.onFileRequest(message.fileId);
        }
      }
      // Bắt đầu nhận file
      else if (message.type === 'file-start') {
        this.receivingFiles.set(message.fileId, {
          name: message.name,
          size: message.size,
          type: message.mimeType,
          chunks: [],
          receivedSize: 0
        });
        console.log(`[WebRTC] Bắt đầu nhận: ${message.name}`);
      } 
      // Hoàn thành nhận file
      else if (message.type === 'file-end') {
        const file = this.receivingFiles.get(message.fileId);
        if (file) {
          const blob = new Blob(file.chunks, { type: file.type });
          if (this.onFileComplete) {
            this.onFileComplete(message.fileId, blob, file.name, 'receiving');
          }
          this.receivingFiles.delete(message.fileId);
          console.log(`[WebRTC] Hoàn thành: ${file.name}`);
        }
      }
    } 
    // Binary data (file chunk)
    else {
      const data = new Uint8Array(event.data);
      const fileIdLength = new DataView(event.data).getInt32(0, true);
      const fileId = new TextDecoder().decode(data.slice(4, 4 + fileIdLength));
      const chunk = data.slice(4 + fileIdLength);
      
      const file = this.receivingFiles.get(fileId);
      if (file) {
        file.chunks.push(chunk);
        file.receivedSize += chunk.length;
        
        const progress = (file.receivedSize / file.size) * 100;
        if (this.onFileProgress) {
          this.onFileProgress(fileId, progress, file.receivedSize, file.size, 'receiving');
        }
      }
    }
  }
  
  // Gửi danh sách file đang chia sẻ
  sendFileList(fileList) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'file-list',
        files: fileList
      }));
      console.log('[WebRTC] Gửi danh sách file:', fileList.length);
    }
  }
  
  // Yêu cầu tải file từ peer
  requestFile(fileId) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'file-request',
        fileId: fileId
      }));
      console.log('[WebRTC] Yêu cầu file:', fileId);
    }
  }
  
  // Gửi file qua Data Channel
  async sendFile(file, fileId) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data Channel chưa sẵn sàng');
    }
    
    const id = fileId || Math.random().toString(36).substring(2, 10);
    
    // Gửi metadata
    this.dataChannel.send(JSON.stringify({
      type: 'file-start',
      fileId: id,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream'
    }));
    
    // Đọc và gửi file theo chunks
    const reader = file.stream().getReader();
    let sendSize = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        for (let i = 0; i < value.length; i += this.CHUNK_SIZE) {
          const chunk = value.slice(i, i + this.CHUNK_SIZE);
          
          const fileIdBytes = new TextEncoder().encode(id);
          const buffer = new ArrayBuffer(4 + fileIdBytes.length + chunk.length);
          const view = new DataView(buffer);
          view.setInt32(0, fileIdBytes.length, true);
          
          const bufferArray = new Uint8Array(buffer);
          bufferArray.set(fileIdBytes, 4);
          bufferArray.set(chunk, 4 + fileIdBytes.length);
          
          // Chờ buffer trống nếu đầy
          while (this.dataChannel.bufferedAmount > 16 * 1024 * 1024) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          this.dataChannel.send(buffer);
          sendSize += chunk.length;
          
          const progress = (sendSize / file.size) * 100;
          if (this.onFileProgress) {
            this.onFileProgress(id, progress, sendSize, file.size, 'sending');
          }
        }
      }
      
      // Gửi thông báo hoàn thành
      this.dataChannel.send(JSON.stringify({
        type: 'file-end',
        fileId: id
      }));
      
      if (this.onFileComplete) {
        this.onFileComplete(id, null, file.name, 'sending');
      }
      
      return id;
    } catch (error) {
      console.error('[WebRTC] Lỗi gửi file:', error);
      if (this.onFileError) {
        this.onFileError(id, error, 'sending');
      }
      throw error;
    }
  }
  
  // Đóng kết nối
  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteSocketId = null;
    this.remotePeerId = null;
    this.receivingFiles.clear();
    this.sendingFiles.clear();
  }
  
  // Kiểm tra trạng thái kết nối
  isConnected() {
    return this.peerConnection && 
           this.peerConnection.iceConnectionState === 'connected' &&
           this.dataChannel && 
           this.dataChannel.readyState === 'open';
  }
}

// Export
window.WebRTCHandler = WebRTCHandler;
