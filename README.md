<div align="center">

# ♟️ StackChess Pro 🚀
**High-Concurrency Chess Engine & Real-Time Multiplayer**

<img src="https://media.tenor.com/tC6Jt_YmIckAAAAd/chess.gif" width="100%" height="250" style="border-radius: 15px; object-fit: cover;" alt="Animated Chess Banner">

<br>

![StackChess Pro](https://img.shields.io/badge/StackChess-Pro-2563eb?style=for-the-badge&logo=chess&logoColor=white)
![Developed By](https://img.shields.io/badge/Developed_by-@stackbyujjwal-d97706?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Stockfish](https://img.shields.io/badge/Engine-Stockfish_17-black?style=for-the-badge)
![WebSockets](https://img.shields.io/badge/RealTime-WebSockets-ff0055?style=for-the-badge&logo=socket.io&logoColor=white)

<h3> 🌟 <a href="https://stackbyujjwal.github.io/StackChess/">🎮 PLAY STACKCHESS PRO LIVE HERE</a> 🌟 </h3>

<p align="center">
  <b>Built for seamless gameplay, deep engine analysis, and zero-lag multiplayer battles.</b><br>
  Powered by a custom <b>FastAPI</b> backend with an Async <b>Stockfish 17 Engine Pool</b> to handle thousands of concurrent players.
</p>

</div>

---

<br>

## ✨ Epic Features

| 🧠 Deep Analyzer Mode | 🤖 Play vs AI (Stockfish) | 🌍 Real-Time Multiplayer |
| :--- | :--- | :--- |
| Input any FEN, configure castling rights, and get instant best-move calculations with a dynamic Eval Bar. | Test your skills against one of the strongest chess engines in the world (Stockfish 17). | Create private rooms with 6-digit codes and play online with friends instantly with zero lag. |

* ⚡ **High-Concurrency Backend:** Custom Async Engine Pool (15+ parallel Stockfish instances) for massive traffic.
* 🎨 **Pro UI/UX:** Clean, responsive, and mobile-friendly dashboard inspired by premium productivity tools.

---

## 🌐 Public API Documentation (Free to use!)

Want to build your own chess app? I've made the StackChess Pro APIs 100% public. Integrate high-speed Stockfish analysis or multiplayer sockets into your projects easily!

### 📡 API & WebSocket Reference payloads

```javascript
// ==========================================
// 1️⃣ REST API: CALCULATE BEST MOVE
// ==========================================
// Endpoint: POST [https://stackbyujjwal1-stackchess.hf.space/calculate_move](https://stackbyujjwal1-stackchess.hf.space/calculate_move)
// Headers: Content-Type: application/json

// 👉 Request Body:
{
  "fen_string": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "think_time": 1
}

// 👈 Response:
{
  "best_move": "e2e4",
  "score": 0.35,  // Centipawn evaluation or "Mate in X"
  "pv": "e2e4",
  "depth": 15
}


// ==========================================
// 2️⃣ WEBSOCKETS: MULTIPLAYER ENGINE
// ==========================================
// URL: wss://stackbyujjwal1-stackchess.hf.space/ws/{room_id}

// 📤 EVENTS YOU CAN SEND:
{ "type": "move", "source": "e2", "target": "e4", "promotion": "q" } // Make a move
{ "type": "resign" } // Resign from the game


// 📥 EVENTS YOU WILL RECEIVE:
{ "type": "start", "message": "Game Started! White to move." }
{ "type": "move", "source": "e7", "target": "e5", "promotion": "q" }
{ "type": "disconnect", "message": "Opponent disconnected." }
