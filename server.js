const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve a basic health check
app.get('/', (req, res) => {
  res.send('Roast Hub Signaling Server is running!');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for easy testing
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Basic Room Join
  socket.on('join-room', (roomId, isHost, username) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username || (isHost ? 'Host' : 'Guest');
    console.log(`User ${socket.id} (${socket.username}) joined room ${roomId} as ${isHost ? 'Host' : 'Guest'}`);
    
    // Broadcast updated user list to everyone in the room
    sendUpdatedUsers(roomId);

    if (!isHost) {
      socket.to(roomId).emit('guest-joined', socket.id);
    }
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.roomId) {
      sendUpdatedUsers(socket.roomId);
    }
  });

  function sendUpdatedUsers(roomId) {
    const clients = io.sockets.adapter.rooms.get(roomId);
    const users = [];
    if (clients) {
      for (const clientId of clients) {
        const clientSocket = io.sockets.sockets.get(clientId);
        if (clientSocket && clientSocket.username) {
          users.push({ id: clientId, username: clientSocket.username });
        }
      }
    }
    io.to(roomId).emit('update-users', users);
  }

  // WebRTC Signaling: Offer
  socket.on('offer', (payload) => {
    // Send the offer to a specific guest
    io.to(payload.target).emit('offer', payload);
  });

  // WebRTC Signaling: Answer
  socket.on('answer', (payload) => {
    // Send the answer back to the host
    io.to(payload.target).emit('answer', payload);
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', (payload) => {
    // Send the candidate to the target peer
    io.to(payload.target).emit('ice-candidate', payload);
  });

  // Sync Video Title/Reactions
  socket.on('send-reaction', (roomId, reaction) => {
    socket.to(roomId).emit('receive-reaction', reaction);
  });
  
  // Sync Video URL
  socket.on('send-video-url', (roomId, url) => {
    socket.to(roomId).emit('receive-video-url', url);
  });

  // Sync Video Title
  socket.on('send-title', (roomId, title) => {
    socket.to(roomId).emit('receive-title', title);
  });

  // Sync Playback State (Timeline, Play, Pause)
  socket.on('sync-playback', (roomId, state) => {
    socket.to(roomId).emit('sync-playback', state);
  });

  // Sync Chat Messages
  socket.on('send-chat-message', (roomId, message) => {
    socket.to(roomId).emit('receive-chat-message', message);
  });

  // Request initial state
  socket.on('request-state', (roomId) => {
    socket.to(roomId).emit('request-state');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 7860; // Hugging Face Spaces defaults to 7860
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
