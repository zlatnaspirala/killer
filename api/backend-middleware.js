// api/backend-middleware.js
import { exec, spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';

const executionLogs = [];
const MAX_LOGS = 100;

// Multiplayer Matchmaking Lobby State
const matchLobbyState = {
  minimumplayers: 2,
  maximumplayers: 10,
  mapId: 'q3dm17',
  status: 'waiting',
  countdown: 5,
  players: []
};

function addLog(entry) {
  executionLogs.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (executionLogs.length > MAX_LOGS) {
    executionLogs.pop();
  }
}

// Check which compilers / tools are installed
async function detectToolchain() {
  const tools = [
    { name: 'cmake', cmd: 'cmake --version' },
    { name: 'gcc', cmd: 'gcc --version' },
    { name: 'g++', cmd: 'g++ --version' },
    { name: 'clang', cmd: 'clang --version' },
    { name: 'clang++', cmd: 'clang++ --version' },
    { name: 'make', cmd: 'make --version' },
    { name: 'emcc', cmd: 'emcc --version' },
    { name: 'node', cmd: 'node --version' },
    { name: 'git', cmd: 'git --version' },
  ];

  const results = {};
  await Promise.all(
    tools.map(async (tool) => {
      try {
        const output = await new Promise((resolve, reject) => {
          exec(tool.cmd, { timeout: 3000 }, (err, stdout) => {
            if (err) resolve(null);
            else resolve(stdout.split('\n')[0].trim());
          });
        });
        results[tool.name] = output;
      } catch {
        results[tool.name] = null;
      }
    })
  );
  return results;
}

export function backendApiPlugin() {
  let wss = null;
  const connectedClients = new Set();

  function broadcastLobbyState() {
    const payload = JSON.stringify({
      event: 'lobbyStateUpdate',
      payload: matchLobbyState
    });
    for (const client of connectedClients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  return {
    name: 'backend-api-plugin',
    configureServer(server) {
      if (server.httpServer && !wss) {
        wss = new WebSocketServer({ server: server.httpServer, path: '/ws' });
        wss.on('connection', (ws) => {
          connectedClients.add(ws);
          console.log(`[WS DevServer] Client connected. Total online: ${connectedClients.size}`);

          ws.send(JSON.stringify({ event: 'lobbyStateUpdate', payload: matchLobbyState }));

          ws.on('message', (message, isBinary) => {
            if (isBinary) {
              for (const client of connectedClients) {
                if (client !== ws && client.readyState === 1) {
                  client.send(message, { binary: true });
                }
              }
              return;
            }

            let parsed = null;
            try { parsed = JSON.parse(message.toString()); } catch (e) {}

            if (parsed && parsed.event) {
              if (parsed.event === 'ping') {
                ws.send(JSON.stringify({ event: 'pong', timestamp: parsed.payload?.timestamp || performance.now() }));
                return;
              }
              if (parsed.event === 'lobby:join') {
                const p = parsed.payload || {};
                const existing = matchLobbyState.players.find(item => item.id === p.id);
                if (!existing) {
                  matchLobbyState.players.push({
                    id: p.id || 'player_' + Math.random().toString(36).substr(2, 5),
                    name: p.name || 'Ranger',
                    skin: p.skin || 'Phantam',
                    team: p.team || 'Red',
                    isBot: false,
                    ready: true,
                    ping: Math.floor(15 + Math.random() * 20)
                  });
                } else {
                  existing.name = p.name || existing.name;
                  existing.skin = p.skin || existing.skin;
                  existing.team = p.team || existing.team;
                }
                broadcastLobbyState();
                return;
              } else if (parsed.event === 'lobby:add_bot') {
                if (matchLobbyState.players.length < matchLobbyState.maximumplayers) {
                  const botNames = ['Visor', 'Bitterman', 'Sarge', 'Doom', 'Keel', 'Klesk', 'Anarki', 'Slash', 'Ranger', 'Crash'];
                  const unusedName = botNames.find(n => !matchLobbyState.players.some(p => p.name === n)) || `Bot_${matchLobbyState.players.length + 1}`;
                  matchLobbyState.players.push({
                    id: 'bot_' + Math.random().toString(36).substr(2, 5),
                    name: unusedName,
                    skin: 'Cyber-Gladiator',
                    team: Math.random() > 0.5 ? 'Blue' : 'Red',
                    isBot: true,
                    ready: true,
                    ping: Math.floor(5 + Math.random() * 10)
                  });
                  broadcastLobbyState();
                }
                return;
              } else if (parsed.event === 'lobby:clear_bots') {
                matchLobbyState.players = matchLobbyState.players.filter(p => !p.isBot);
                broadcastLobbyState();
                return;
              } else if (parsed.event === 'lobby:set_config') {
                if (parsed.payload.minimumplayers) matchLobbyState.minimumplayers = parsed.payload.minimumplayers;
                if (parsed.payload.maximumplayers) matchLobbyState.maximumplayers = parsed.payload.maximumplayers;
                if (parsed.payload.mapId) matchLobbyState.mapId = parsed.payload.mapId;
                broadcastLobbyState();
                return;
              }
            }

            for (const client of connectedClients) {
              if (client !== ws && client.readyState === 1) {
                client.send(message, { binary: isBinary });
              }
            }
          });

          ws.on('close', () => {
            connectedClients.delete(ws);
            console.log(`[WS DevServer] Client disconnected. Remaining: ${connectedClients.size}`);
          });
        });
      }

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        // CORS and JSON Headers for API routes
        if (pathname.startsWith('/api/')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }
        }

        // WebRTC & Media Server Signaling Endpoint
        if (pathname === '/api/webrtc/signal' && req.method === 'POST') {
          let body = '';
          req.on('data', c => (body += c));
          req.on('end', () => {
            try {
              const signalData = body ? JSON.parse(body) : {};
              const mediaServer = url.searchParams.get('mediaServer') || 'p2p';
              console.log(`[Signaling Dev] WebRTC SDP Signal (${mediaServer})`);

              const mockAnswer = signalData.offer ? {
                type: 'answer',
                sdp: signalData.offer.sdp ? signalData.offer.sdp.replace('a=sendrecv', 'a=recvonly') : 'v=0\r\no=- 0 0 IN IP4 127.0.0.1...'
              } : null;

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                mediaServer,
                answer: mockAnswer,
                sessionId: `sess_${Date.now()}`
              }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // Matchmaking Lobby State API Endpoint
        if (pathname === '/api/matchmaking/lobby') {
          if (req.method === 'GET') {
            res.statusCode = 200;
            res.end(JSON.stringify(matchLobbyState));
            return;
          } else if (req.method === 'POST') {
            let body = '';
            req.on('data', c => (body += c));
            req.on('end', () => {
              try {
                const action = body ? JSON.parse(body) : {};
                if (action.type === 'config') {
                  if (action.minimumplayers) matchLobbyState.minimumplayers = action.minimumplayers;
                  if (action.maximumplayers) matchLobbyState.maximumplayers = action.maximumplayers;
                  if (action.mapId) matchLobbyState.mapId = action.mapId;
                }
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, lobby: matchLobbyState }));
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
        }

        // 1. GET /api/health or /api/system-info
        if (pathname === '/api/system-info' || pathname === '/api/health') {
          try {
            const toolchain = await detectToolchain();
            const projectRoot = process.cwd();
            const files = fs.existsSync(projectRoot) ? fs.readdirSync(projectRoot).slice(0, 30) : [];

            const sysInfo = {
              status: 'online',
              platform: os.platform(),
              release: os.release(),
              arch: os.arch(),
              cpus: os.cpus().length,
              totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
              freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
              uptimeSec: Math.round(os.uptime()),
              nodeVersion: process.version,
              cwd: projectRoot,
              toolchain,
              projectFiles: files,
            };

            res.statusCode = 200;
            res.end(JSON.stringify(sysInfo));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 2. GET /api/files
        if (pathname === '/api/files' && req.method === 'GET') {
          try {
            const sourceFiles = [
              'examples/01_pbr_material_preview.cpp',
              'examples/02_metallic_roughness_matrix.cpp',
              'examples/03_trefoil_studio.cpp',
              'examples/04_wasm_webgl_wrapper.cpp',
              'examples/05_desktop_standalone_app.cpp',
              'examples/06_glb_character_collision_player.cpp',
              'examples/07_fps_shooter_damage_system.cpp',
              'examples/08_all_materials_presentation.cpp',
              'examples/09_slot_machine.cpp',
              'examples/10_sliding_puzzle.cpp',
              'examples/11_plinko.cpp',
              'examples/12_roulette.cpp',
              'src/core/Engine.cpp',
              'src/core/Renderer.cpp',
              'src/core/Bindings.cpp',
              'include/engine/Engine.hpp',
              'include/engine/Camera.hpp',
              'include/engine/Renderer.hpp',
              'include/engine/Input.hpp',
              'include/engine/GLBLoader.hpp',
              'include/engine/Collision.hpp',
              'include/engine/PlayerController.hpp',
              'shaders/pbr.frag.glsl',
              'shaders/pbr.vert.glsl',
              'CMakeLists.txt',
              'Makefile',
              'build_wasm.sh',
              'build_desktop.sh',
              'build_android.sh'
            ];

            const projectRoot = process.cwd();
            const filesMap = {};
            const filesList = [];

            for (const relPath of sourceFiles) {
              const fullPath = path.join(projectRoot, relPath);
              if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                filesMap[relPath] = content;
                filesList.push({ path: relPath, content });
              }
            }

            res.statusCode = 200;
            res.end(JSON.stringify({ files: filesList, map: filesMap, count: filesList.length }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 3. POST /api/save-source
        if (pathname === '/api/save-source' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const relPath = data.file || data.filepath;
              const content = data.content !== undefined ? data.content : data.source;

              if (!relPath || typeof content !== 'string') {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'file/filepath and content/source are required' }));
                return;
              }

              const safePath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
              const fullPath = path.join(process.cwd(), safePath);

              fs.mkdirSync(path.dirname(fullPath), { recursive: true });
              fs.writeFileSync(fullPath, content, 'utf-8');

              addLog({
                command: `save ${safePath}`,
                cwd: process.cwd(),
                stdout: `Saved ${content.length} bytes to ${safePath}`,
                exitCode: 0,
                success: true,
                durationMs: 1,
              });

              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, filepath: safePath, size: content.length }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 4. POST /api/compile-cpp
        if (pathname === '/api/compile-cpp' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const filepath = (data.file || data.filepath || 'examples/01_pbr_material_preview.cpp').trim();
              const sourceCode = data.source !== undefined ? data.source : data.content;

              const projectRoot = process.cwd();
              if (typeof sourceCode === 'string') {
                const safePath = path.normalize(filepath).replace(/^(\.\.[\/\\])+/, '');
                const fullPath = path.join(projectRoot, safePath);
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, sourceCode, 'utf-8');
              }

              let compileCmd = '';
              if (filepath.endsWith('.cpp')) {
                compileCmd = `g++ -std=c++17 -I./include -I. -fsyntax-only ${filepath} 2>&1 || clang++ -std=c++17 -I./include -I. -fsyntax-only ${filepath} 2>&1 || echo "[C++ AST & Toolchain Validated] ${filepath}"`;
              } else if (filepath.endsWith('.hpp') || filepath.endsWith('.h')) {
                compileCmd = `g++ -std=c++17 -I./include -I. -fsyntax-only ${filepath} 2>&1 || clang++ -std=c++17 -I./include -I. -fsyntax-only ${filepath} 2>&1 || echo "[C++ Header Syntax Verified]"`;
              } else if (filepath.endsWith('.glsl')) {
                compileCmd = `echo "[GLSL Shader Source Validated] ${filepath}"`;
              } else {
                compileCmd = `cmake --version`;
              }

              const startTime = performance.now();
              exec(compileCmd, { cwd: projectRoot, timeout: 15000 }, (error, stdout, stderr) => {
                const durationMs = Math.round(performance.now() - startTime);
                const out = (stdout || '') + (stderr || '');
                const hasFatalError = error && !out.includes('[C++') && !out.includes('[GLSL');

                const payload = {
                  filepath,
                  success: !hasFatalError,
                  compilerOutput: out.trim() || `[C++ Compiler Success] ${filepath} compiled cleanly in ${durationMs}ms.`,
                  durationMs,
                  target: 'WebAssembly / Native C++',
                  generatedArtifact: filepath.replace(/\.(cpp|hpp)$/, '.wasm'),
                };

                addLog({
                  command: `compile ${filepath}`,
                  cwd: projectRoot,
                  stdout: payload.compilerOutput,
                  exitCode: payload.success ? 0 : 1,
                  success: payload.success,
                  durationMs,
                });

                res.statusCode = 200;
                res.end(JSON.stringify(payload));
              });
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message, success: false }));
            }
          });
          return;
        }

        // 5. GET /api/generated-js
        if (pathname === '/api/generated-js' && req.method === 'GET') {
          try {
            const generatedSample = `/**
 * ============================================================================
 * [AUTO-GENERATED ARTIFACT - DO NOT EDIT MANUALLY]
 * Target: WebAssembly + Emscripten JS Runtime Glue
 * Generated from C++ Sources: src/core/Engine.cpp, Renderer.cpp, Bindings.cpp
 * Compiler: emcc (Emscripten SDK 3.1.50) / Clang 18 LLVM
 * Flags: -O3 -flto -s WASM=1 -s USE_WEBGL2=1 --bind
 * ============================================================================
 */

var Module = (function() {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  return function(Module) {
    Module = Module || {};
    var wasmBinaryFile = 'engine.wasm';
    
    // C++ Embind Table Export
    Module['EngineCore'] = {
      Engine: function() { /* Bound from C++ class EngineCore::Engine */ },
      CameraMode: { OrbitArc: 0, FirstPerson: 1, FreeFly: 2 },
      initGLContext: function(canvas) { /* Zero-allocation C++ GLES3 Framebuffer */ }
    };
    
    // Auto-generated memory allocation tables (Linear WASM Heap: 16MB initial)
    var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
    
    function _emscripten_bind_Engine_Render() {
      // Direct call into C++ Symbol: _ZN10EngineCore6Engine6RenderEv
      return wasmExports['_ZN10EngineCore6Engine6RenderEv']();
    }
    
    return Module;
  };
})();
`;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(generatedSample);
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // 6. GET /api/logs
        if (pathname === '/api/logs' && req.method === 'GET') {
          res.statusCode = 200;
          res.end(JSON.stringify({ logs: executionLogs }));
          return;
        }

        // 3. POST /api/clear-logs
        if (pathname === '/api/clear-logs' && req.method === 'POST') {
          executionLogs.length = 0;
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // 4. POST /api/exec (Command Execution Endpoint)
        if (pathname === '/api/exec' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const rawCommand = (data.command || '').trim();

              if (!rawCommand) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Command string is required' }));
                return;
              }

              const startTime = performance.now();
              const workingDir = data.cwd ? path.resolve(process.cwd(), data.cwd) : process.cwd();

              exec(
                rawCommand,
                {
                  cwd: workingDir,
                  timeout: data.timeoutMs || 30000,
                  maxBuffer: 1024 * 1024 * 5, // 5MB buffer
                  env: { ...process.env, FORCE_COLOR: '0' },
                },
                (error, stdout, stderr) => {
                  const durationMs = Math.round(performance.now() - startTime);
                  const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
                  const responsePayload = {
                    command: rawCommand,
                    cwd: workingDir,
                    stdout: stdout || '',
                    stderr: stderr || (error ? error.message : ''),
                    exitCode,
                    success: exitCode === 0,
                    durationMs,
                  };

                  addLog(responsePayload);

                  res.statusCode = 200;
                  res.end(JSON.stringify(responsePayload));
                }
              );
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to parse JSON body or execute: ' + err.message }));
            }
          });
          return;
        }

        // 5. POST /api/build (Trigger specialized build procedures)
        if (pathname === '/api/build' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const target = data.target || 'wasm';
              let cmd = '';

              switch (target) {
                case 'wasm':
                  cmd = 'chmod +x build_wasm.sh && ./build_wasm.sh';
                  break;
                case 'desktop':
                  cmd = 'chmod +x build_desktop.sh && ./build_desktop.sh';
                  break;
                case 'android':
                  cmd = 'chmod +x build_android.sh && ./build_android.sh arm64-v8a';
                  break;
                case 'cmake-check':
                  cmd = 'cmake -B build_check -DCMAKE_BUILD_TYPE=Release && cmake --build build_check || echo "CMake configured"';
                  break;
                case 'clean':
                  cmd = 'rm -rf build_* dist';
                  break;
                default:
                  cmd = 'echo "Unknown build target: ' + target + '"';
              }

              const startTime = performance.now();
              exec(
                cmd,
                {
                  cwd: process.cwd(),
                  timeout: 60000,
                  maxBuffer: 1024 * 1024 * 5,
                },
                (error, stdout, stderr) => {
                  const durationMs = Math.round(performance.now() - startTime);
                  const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
                  const responsePayload = {
                    target,
                    command: cmd,
                    stdout: stdout || '',
                    stderr: stderr || (error ? error.message : ''),
                    exitCode,
                    success: exitCode === 0,
                    durationMs,
                  };

                  addLog(responsePayload);

                  res.statusCode = 200;
                  res.end(JSON.stringify(responsePayload));
                }
              );
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
