// Max MSP Tap Bridge Server — Railway-compatible version
const WebSocket = require('ws');
const http = require('http');
const dgram = require('dgram');

const PORT = process.env.PORT || 8080;
const MAX_HOST = process.env.MAX_HOST || '127.0.0.1';
const MAX_PORT = parseInt(process.env.MAX_PORT) || 7400;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Max MSP Tap Bridge OK\n');
});

const wss = new WebSocket.Server({ server });
const udpClient = dgram.createSocket('udp4');

let participants = {};
let participantCounter = 0;

console.log('Max MSP Tap Bridge starting on port ' + PORT);
console.log('Forwarding UDP to ' + MAX_HOST + ':' + MAX_PORT);

wss.on('connection', (ws) => {
  participantCounter++;
  const id = participantCounter;
  const name = 'Participant ' + id;
  participants[id] = { ws, name };

  console.log(name + ' connected');

  ws.send(JSON.stringify({ type: 'welcome', id, name, participantCount: Object.keys(participants).length }));
  broadcast({ type: 'participantCount', count: Object.keys(participants).length });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'tap') {
        console.log('TAP from ' + name + ' key: ' + msg.key);
        const udpMsg = Buffer.from('tap ' + id + ' ' + msg.key);
        udpClient.send(udpMsg, MAX_PORT, MAX_HOST, (err) => {
          if (err) console.error('UDP error:', err);
        });
        broadcast({ type: 'tap', id, name, key: msg.key, timestamp: Date.now() });
      }

      if (msg.type === 'setName') {
        participants[id].name = msg.name;
        broadcast({ type: 'participantCount', count: Object.keys(participants).length });
      }

    } catch (e) {
      console.error('Parse error:', e);
    }
  });

  ws.on('close', () => {
    console.log(name + ' disconnected');
    delete participants[id];
    broadcast({ type: 'participantCount', count: Object.keys(participants).length });
  });
});

function broadcast(msg) {
  const str = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(str);
  });
}

server.listen(PORT, () => {
  console.log('Server listening on port ' + PORT);
});
