const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs/promises');
const path = require('node:path');

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 8080);
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 3000);
const ROOT = __dirname;
const BACKEND_DATA_DIR = process.env.BACKEND_DATA_DIR
  ? path.resolve(process.env.BACKEND_DATA_DIR)
  : path.resolve(ROOT, '..', 'data');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(payload));
}

async function readBackendJson(fileName, fallback) {
  try {
    const content = await fs.readFile(path.join(BACKEND_DATA_DIR, fileName), 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return fallback;
  }
}

function getRequestToken(req) {
  const authToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const cookieToken = req.headers.cookie
    ?.split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('sessionId='))
    ?.slice('sessionId='.length);

  return authToken || cookieToken || null;
}

async function handleFrontendBackendBridge(req, res) {
  if (req.method !== 'GET') return false;
  if (req.url !== '/api/auth/me' && req.url !== '/api/games' && !req.url.startsWith('/api/games/')) {
    return false;
  }

  const token = getRequestToken(req);
  const sessions = await readBackendJson('sessions.json', []);
  const session = sessions.find(item => item.token === token);
  if (!session) {
    sendJson(res, 401, {
      success: false,
      message: 'Authentication required'
    });
    return true;
  }

  const users = await readBackendJson('users.json', []);
  const user = users.find(item => item.id === session.userId);
  if (!user) {
    sendJson(res, 401, {
      success: false,
      message: 'User not found'
    });
    return true;
  }

  if (req.url === '/api/auth/me') {
    sendJson(res, 200, {
      success: true,
      message: 'User fetched successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt
        }
      }
    });
    return true;
  }

  const games = await readBackendJson('games.json', []);
  const visibleGames = games.filter(game =>
    !game.whitePlayerId ||
    !game.blackPlayerId ||
    game.whitePlayerId === user.id ||
    game.blackPlayerId === user.id
  );

  const gameMatch = req.url.match(/^\/api\/games\/([^/]+)$/);
  if (gameMatch) {
    const game = visibleGames.find(item => item.id === gameMatch[1]);
    if (!game) {
      sendJson(res, 404, {
        success: false,
        message: 'Game not found'
      });
      return true;
    }

    sendJson(res, 200, {
      success: true,
      message: 'Game fetched successfully',
      data: game
    });
    return true;
  }

  sendJson(res, 200, {
    success: true,
    message: 'Games fetched successfully',
    data: visibleGames
  });
  return true;
}

function proxyHttp(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const proxyHeaders = { ...req.headers };
  const bearerToken = proxyHeaders.authorization?.startsWith('Bearer ')
    ? proxyHeaders.authorization.slice(7)
    : null;
  if (bearerToken) {
    const cookies = proxyHeaders.cookie
      ? proxyHeaders.cookie
          .split(';')
          .map(cookie => cookie.trim())
          .filter(cookie => cookie && !cookie.startsWith('sessionId='))
      : [];
    cookies.push(`sessionId=${bearerToken}`);
    proxyHeaders.cookie = cookies.join('; ');
  }

  const proxyReq = http.request({
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    method: req.method,
    path: req.url,
    headers: {
      ...proxyHeaders,
      host: `${BACKEND_HOST}:${BACKEND_PORT}`
    }
  }, proxyRes => {
    res.writeHead(proxyRes.statusCode || 500, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', error => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Backend server is not reachable',
      detail: error.message
    }));
  });

  req.pipe(proxyReq);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${FRONTEND_PORT}`);
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api') || req.url === '/health') {
    if (await handleFrontendBackendBridge(req, res)) {
      return;
    }
    proxyHttp(req, res);
    return;
  }

  serveStatic(req, res);
});

server.on('upgrade', (req, clientSocket, head) => {
  if (!req.url.startsWith('/ws')) {
    clientSocket.destroy();
    return;
  }

  const backendSocket = net.connect(BACKEND_PORT, BACKEND_HOST, () => {
    const upgradeHeaders = { ...req.headers };
    const url = new URL(req.url, `http://localhost:${FRONTEND_PORT}`);
    const token = url.searchParams.get('token');
    if (token) {
      const cookies = upgradeHeaders.cookie
        ? upgradeHeaders.cookie
            .split(';')
            .map(cookie => cookie.trim())
            .filter(cookie => cookie && !cookie.startsWith('sessionId='))
        : [];
      cookies.push(`sessionId=${token}`);
      upgradeHeaders.cookie = cookies.join('; ');
    }

    const headers = Object.entries({
      ...upgradeHeaders,
      host: `${BACKEND_HOST}:${BACKEND_PORT}`
    })
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');

    backendSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
    if (head.length) backendSocket.write(head);
    clientSocket.pipe(backendSocket);
    backendSocket.pipe(clientSocket);
  });

  backendSocket.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => backendSocket.destroy());
});

server.listen(FRONTEND_PORT, () => {
  console.log(`Frontend running on http://localhost:${FRONTEND_PORT}`);
  console.log(`Proxying backend at http://${BACKEND_HOST}:${BACKEND_PORT}`);
});
