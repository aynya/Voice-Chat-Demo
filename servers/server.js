// server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const app = express();

const server = http.createServer(app);
app.use(cors());
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  }
});

io.on('connection', (socket) => {
  console.log(`用户 ${socket.id} 已连接`);

  // 加入房间
  socket.on('join-room', (roomId) => {
    socket.join(roomId); // 加入指定房间
    socket.roomId = roomId; // 存储房间号
    socket.emit('myId', socket.id); // 发送自己的ID
    console.log(`用户 ${socket.id} 加入房间 ${roomId}`);
    console.log(`${roomId}房间中有 ${io.sockets.adapter.rooms.get(roomId).size} 个成员`)
    
    // 通知房间内其他用户有新成员加入
    socket.to(roomId).emit('user-connected', socket.id);
  });

  // 转发WebRTC信令给房间内其他用户
  socket.on('signal', ({ targetId, signal }) => {
    socket.to(targetId).emit('signal', { senderId: socket.id, signal });
  });

  // 广播文字消息到房间
  socket.on('chat message', (msg) => {
    console.log('收到消息：', msg);
    io.to(socket.roomId).emit('chat message', msg);
  });

  // 用户断开时通知房间
  socket.on('disconnect', () => {
    if (socket.roomId) {
      console.log(`用户 ${socket.id} 已断开连接`);
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
    }
  });
});

server.listen(3000, () => {
  console.log('服务端运行在:3000');
});