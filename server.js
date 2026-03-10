const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Create HTTP server that serves participant.html
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/participant.html') {
    const htmlPath = path.join(__dirname, 'participant.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      const html = fs.readFileSync(htmlPath);
      res.end(html);
    } else {
      res.writeHead(404);
      res.end('participant.html not found!');
    }
  } else {
    res.writeHead(200);
    res.end('Max MSP Tap Bridge - Railway Edition');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

let connections = [];

wss.on('connection', (ws, req) => {
  const isMax = req.url === '/max'; // Max connects to /max endpoint
  const id = connections.length + 1;
  
  connections.push({ 
    id, 
    ws, 
    participant: null,
    isMax: isMax,
    type: isMax ? 'MAX' : 'PARTICIPANT'
  });
  
  console.log(`✓ ${isMax ? 'MAX CLIENT' : 'Participant'} ${id} connected (total: ${connections.length})`);
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      if (msg.type === 'setParticipant') {
        const conn = connections.find(c => c.ws === ws);
        if (conn) {
          conn.participant = msg.participant;
          console.log(`✓ Connection ${id} is P${msg.participant}`);
        }
      }
      
      if (msg.type === 'tap') {
        const conn = connections.find(c => c.ws === ws);
        const p = conn ? conn.participant : 1;
        
        console.log(`>>> TAP from P${p}`);
        
        // Broadcast tap to ALL Max clients
        const tapMessage = JSON.stringify({
          type: 'tap',
          participant: p,
          timestamp: Date.now()
        });
        
        connections.forEach(c => {
          if (c.isMax && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(tapMessage);
            console.log(`    ✓ Sent to Max client ${c.id}`);
          }
        });
      }
      
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  });
  
  ws.on('close', () => {
    const conn = connections.find(c => c.ws === ws);
    console.log(`✗ ${conn ? conn.type : 'Connection'} ${id} disconnected`);
    connections = connections.filter(c => c.ws !== ws);
  });
  
  ws.on('error', (err) => {
    console.log(`! WebSocket error on connection ${id}:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log(`Railway Server running on port ${PORT}`);
  console.log(`Participants: wss://[your-railway-url]/participant.html`);
  console.log(`Max connects: wss://[your-railway-url]/max`);
  console.log('========================================');
});
