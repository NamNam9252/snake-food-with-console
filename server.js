const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.static('public'));

// Get network IP address
function getLocalIP() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const NETWORK_IP = getLocalIP();
console.log('Network IP detected:', NETWORK_IP);

// Endpoint to generate QR code for a given sessionId
app.get('/api/qrcode', async (req, res) => {
  const { sessionId } = req.query;
  console.log('QR code request received for sessionId:', sessionId);
  if (!sessionId) return res.status(400).send('Missing sessionId');
  
  // Get the current port from the request
  const port = req.socket.localPort;
  const url = `https://snake-food-with-console.netlify.app/control.html?sessionId=${sessionId}`;
  console.log('Generating QR code for URL:', url);
  
  try {
    const qr = await QRCode.toDataURL(url);
    console.log('QR code generated successfully for URL:', url);
    res.json({ qr, url, networkIp: NETWORK_IP, port });
  } catch (err) {
    console.error('QR code generation failed:', err);
    res.status(500).send('QR code generation failed');
  }
});

// Socket.IO session handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('join-session', (sessionId) => {
    console.log('Client joined session:', sessionId);
    socket.join(sessionId);
  });

  socket.on('control-action', ({ sessionId, action }) => {
    console.log('Control action received:', { sessionId, action });
    socket.to(sessionId).emit('control-action', { action });
  });
});

// Function to start server with port fallback
function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    const actualPort = server.address().port;
    console.log(`Server running on http://localhost:${actualPort}`);
    console.log(`Accessible on your network at: http://${NETWORK_IP}:${actualPort}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying port ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(3000); 
