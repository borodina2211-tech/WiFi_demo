// Max MSP Tap Bridge Server — UPDATED for participant numbers
const WebSocket = require('ws');
const http = require('http');
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const MAX_HOST = process.env.MAX_HOST || '127.0.0.1';
const MAX_PORT = parseInt(process.env.MAX_PORT) || 7400;

const server = http.createServer((req, res) => {
  // Serve participant.html
  if (req.url === '/' || req.url === '/participant.html') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    const html = fs.readFileSync(path.join(__dirname, 'participant.html'));
    res.end(html);
  } else {
    res.writeHead(200);
    res.end('Max MSP Tap Bridge OK\n');
  }
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
  participants[id] = { ws, name, participant: null };

  console.log(name + ' connected');

  ws.send(JSON.stringify({ type: 'welcome', id, name, participantCount: Object.keys(participants).length }));
  broadcast({ type: 'participantCount', count: Object.keys(participants).length });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'tap') {
        const participant = msg.participant || participants[id].participant || 1;
        console.log('TAP from P' + participant + ' (socket ' + id + ') key: ' + msg.key);
        
        // Send to Max: "tap 1", "tap 2", "tap 3", or "tap 4"
        const udpMsg = Buffer.from('tap ' + participant);
        udpClient.send(udpMsg, MAX_PORT, MAX_HOST, (err) => {
          if (err) console.error('UDP error:', err);
        });
        
        broadcast({ type: 'tap', id, name: participants[id].name, key: msg.key, participant });
      }

      if (msg.type === 'setParticipant') {
        participants[id].participant = msg.participant;
        console.log('Socket ' + id + ' is now P' + msg.participant);
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
    console.log(participants[id].name + ' disconnected');
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
