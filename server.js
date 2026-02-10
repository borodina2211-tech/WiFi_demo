// Max MSP Tap Bridge Server
// Deploy on Railway/Render — forwards participant keypresses to Max via UDP

const WebSocket = require('ws');
const dgram = require('dgram');

const WS_PORT = process.env.PORT || 8080;
const MAX_HOST = process.env.MAX_HOST || '127.0.0.1'; // Set to your IP when deployed
const MAX_PORT = parseInt(process.env.MAX_PORT) || 7400;

const wss = new WebSocket.Server({ port: WS_PORT });
const udpClient = dgram.createSocket('udp4');

let participants = {};
let participantCounter = 0;

console.log(`🎵 Max MSP Tap Bridge running on ws port ${WS_PORT}`);
console.log(`📡 Forwarding UDP to ${MAX_HOST}:${MAX_PORT}`);

wss.on('connection', (ws, req) => {
  participantCounter++;
  const id = participantCounter;
  const name = `Participant ${id}`;
  participants[id] = { ws, name };

  console.log(`✅ ${name} connected (${Object.keys(participants).length} total)`);

  // Send welcome with assigned ID
  ws.send(JSON.stringify({ type: 'welcome', id, name, participantCount: Object.keys(participants).length }));

  // Broadcast updated count to all
  broadcast({ type: 'participantCount', count: Object.keys(participants).length });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'tap') {
        console.log(`🥁 TAP from ${name} | key: ${msg.key}`);

        // Send OSC-style UDP message to Max
        // Format: "tap <participantId> <key>"
        const udpMsg = Buffer.from(`tap ${id} ${msg.key}`);
        udpClient.send(udpMsg, MAX_PORT, MAX_HOST, (err) => {
          if (err) console.error('UDP error:', err);
        });

        // Also broadcast tap event to all (for visualization)
        broadcast({ type: 'tap', id, name, key: msg.key, timestamp: Date.now() });
      }

      if (msg.type === 'setName') {
        participants[id].name = msg.name;
        console.log(`✏️  Participant ${id} renamed to "${msg.name}"`);
        broadcast({ type: 'participantCount', count: Object.keys(participants).length });
      }

    } catch (e) {
      console.error('Parse error:', e);
    }
  });

  ws.on('close', () => {
    console.log(`❌ ${name} disconnected`);
    delete participants[id];
    broadcast({ type: 'participantCount', count: Object.keys(participants).length });
  });
});

function broadcast(msg) {
  const str = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  });
}

// Health check for deployment platforms
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Max MSP Tap Bridge OK\n');
}).listen(3000);
