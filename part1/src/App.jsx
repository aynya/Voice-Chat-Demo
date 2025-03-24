// App.jsx
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

function App() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [myId, setMyId] = useState('');
  const [roomId, setRoomId] = useState(''); // 改为房间号输入
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peersRef = useRef({}); // 存储所有PeerConnection

  // 初始化
  useEffect(() => {
    console.log('App组件加载')
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        localAudioRef.current.srcObject = stream; // 将本地音频绑定到DOM元素上
      });

    socket.on('myId', setMyId);
    const handleChatMessage = (msg) => {
      console.log(msg)
      setMessages((prev) => [...prev, msg]);
    };
    socket.on('chat message', handleChatMessage);
    socket.on('user-connected', handleUserConnected); // 新用户加入
    socket.on('user-disconnected', handleUserDisconnected); // 用户离开
    socket.on('signal', handleSignal);

    return () => {
      socket.off('signal', handleSignal);
      socket.off('user-connected', handleUserConnected);
      socket.off('user-disconnected', handleUserDisconnected);
      socket.off('myId', setMyId);
      socket.off('chat message', handleChatMessage);
    };
  }, []);

  // 处理新用户加入
  const handleUserConnected = (userId) => {
    // 如果对方是新用户，主动发起连接
    if (userId !== myId) {
      createPeerConnection(userId, true); // 创建连接并发送offer
    }
  };

  // 处理用户离开
  const handleUserDisconnected = (userId) => {
    if (peersRef.current[userId]) {
      peersRef.current[userId].close();
      delete peersRef.current[userId];
    }
  };

  // 创建PeerConnection
  const createPeerConnection = (targetId, isInitiator = false) => {
    if (peersRef.current[targetId]) return; // 避免重复创建

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // 添加本地音频轨道
    localAudioRef.current.srcObject.getTracks().forEach(track => { // 遍历本地音频轨道，把音轨添加到PeerConnection
      pc.addTrack(track, localAudioRef.current.srcObject); // 添加音频轨道
    });

    // 处理远程流
    pc.ontrack = (e) => {
      if (!remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.srcObject = e.streams[0]; // 
      }
    };

    // 收集ICE候选
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { targetId, signal: e.candidate.toJSON() });
      }
    };

    peersRef.current[targetId] = pc;

    // 如果是主动方，创建Offer
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('signal', { targetId, signal: pc.localDescription });
        });
    }
  };

  // 处理信令
  const handleSignal = async ({ senderId, signal }) => {
    if (!peersRef.current[senderId]) {
      createPeerConnection(senderId); // 被动方创建连接
    }
    const pc = peersRef.current[senderId];

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal)); // 设置远程描述
        const answer = await pc.createAnswer(); // 创建回复Offer
        await pc.setLocalDescription(answer); // 设置本地描述
        socket.emit('signal', { targetId: senderId, signal: answer }); // 发送回复
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    } catch (err) {
      console.error('信令处理失败:', err);
    }
  };

  // 加入房间
  const joinRoom = () => {
    if (roomId.trim()) {
      socket.emit('join-room', roomId.trim());
    }
  };

  // 发送消息
  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('chat message', message);
      setMessage('');
    }
  };

  return (
    <div>
      <div>我的ID: {myId}</div>
      
      {/* 输入房间号 */}
      <input
        type="text"
        placeholder="输入房间号"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={joinRoom}>加入房间</button>

      {/* 音频元素 */}
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />

      {/* 聊天界面 */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit">发送消息</button>
      </form>

      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;