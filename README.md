# File Transfer P2P - WebRTC

Ứng dụng chia sẻ file peer-to-peer qua WebRTC, tự triển khai từ đầu để hiểu rõ cơ chế Signaling, STUN/ICE và Data Channel.

## Tính năng

### Kết nối P2P

- Kết nối trực tiếp giữa 2 browser không qua server
- Tự động phát hiện đường kết nối tốt nhất (LAN → STUN → TURN)
- Hỗ trợ Peer ID để dễ dàng kết nối

### Chia sẻ file

- Upload file từ thiết bị (drag & drop)
- Chunk file thành 16KB để truyền qua Data Channel
- Hiển thị progress bar realtime
- Tự động reassemble file ở phía nhận
- Download file đã nhận

### Quản lý peers

- Hiển thị danh sách peers online
- Trạng thái kết nối realtime
- Join/leave room notifications

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Server:** Node.js, Express, Socket.io
- **WebRTC:** Native API (RTCPeerConnection, RTCDataChannel)
- **STUN:** Google STUN servers

## Setup & Installation

### Prerequisites

- Node.js 16+
- Modern browser (Chrome, Firefox, Safari 13+)

### 1. Clone Repository

```bash
git clone https://github.com/phamthainb/file-transfer-p2p.git
cd file-transfer-p2p
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Signaling Server

```bash
npm run dev
```

Server sẽ chạy tại: http://localhost:3000

### 4. Mở ứng dụng

- Mở browser: http://localhost:3000
- Mở tab/window thứ 2: http://localhost:3000
- Copy Peer ID từ tab 1 → paste vào tab 2 để kết nối

## Cách sử dụng

### Bước 1: Kết nối peers

1. User A mở app → nhận được Peer ID (ví dụ: `ABC123`)
2. User A share Peer ID cho User B
3. User B nhập Peer ID → click "Connect"
4. WebRTC handshake tự động diễn ra
5. Hiển thị "Connected ✅" khi thành công

### Bước 2: Gửi file

1. User A drag & drop file vào vùng upload
2. Click "Send File"
3. File được chunk thành 16KB và gửi qua Data Channel
4. User B thấy progress bar nhận file
5. File tự động download khi hoàn tất

## Triển khai (Deployment)

### Local Development

```bash
npm run start
# Truy cập: http://localhost:3000
```

### Test cùng mạng LAN

1. Mở http://localhost:3000 trên 2 thiết bị cùng mạng
2. Thay `localhost` → IP máy server (ví dụ: `192.168.1.100:3000`)
3. Kết nối sẽ dùng Host Candidate (siêu nhanh)

## Troubleshooting

### Không kết nối được P2P

- Kiểm tra console có lỗi JavaScript không
- Thử test STUN server (xem phần Testing)
- Firewall có thể chặn UDP → thử mạng khác

### File transfer bị lỗi

- Kiểm tra file size (> 100MB có thể chậm)
- Browser có thể crash với file quá lớn
- Thử file nhỏ hơn để test
- Debug thông qua: chrome://webrtc-internals/

## References

- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [WebRTC.org](https://webrtc.org/)
- [Socket.io Documentation](https://socket.io/docs/)
- [RFC 5389 - STUN Protocol](https://tools.ietf.org/html/rfc5389)
