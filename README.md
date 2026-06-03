# ♟️ StackChess Pro 🚀

![StackChess Pro](https://img.shields.io/badge/StackChess-Pro-2563eb?style=for-the-badge&logo=chess)
![Developed By](https://img.shields.io/badge/Developed_by-@stackbyujjwal-d97706?style=for-the-badge)
![Python](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)
![Stockfish](https://img.shields.io/badge/Engine-Stockfish_17-black?style=for-the-badge)

Welcome to **StackChess Pro** – a high-performance, full-stack chess application built for seamless gameplay, deep engine analysis, and real-time multiplayer battles. 

### 🌟 [🎮 PLAY STACKCHESS PRO LIVE HERE](https://stackbyujjwal.github.io/StackChess/) 🌟

Powered by a custom **FastAPI** backend with a high-concurrency **Stockfish 17 Engine Pool** and real-time **WebSockets**, this app is designed to handle thousands of concurrent players and analysis requests without breaking a sweat.

---

## ✨ Key Features

* 🧠 **Deep Analyzer Mode:** Input any FEN, configure castling rights, and get instant best-move calculations with a dynamic Eval Bar.
* 🤖 **Play vs AI (Stockfish):** Test your skills against one of the strongest chess engines in the world.
* 🌍 **Real-Time Multiplayer:** Create private rooms with 6-digit codes and play online with friends instantly with zero lag.
* ⚡ **High-Concurrency Backend:** Features a custom Async Engine Pool (15+ Stockfish instances) to handle massive parallel requests.
* 🎨 **Pro UI/UX:** Clean, responsive, and mobile-friendly dashboard inspired by premium productivity tools. Features inline pawn promotion and native game result overlays.

---

## 🛠️ Tech Stack

**Frontend:** HTML5, CSS3, JavaScript, jQuery, Chessboard.js, Chess.js  
**Backend:** Python, FastAPI, WebSockets, Uvicorn, Asyncio  
**Engine:** Stockfish 17 (Linux Binary)  
**Deployment:** Docker, Hugging Face Spaces, GitHub Pages  

---

## 🚀 Public API Documentation

I have made the StackChess Pro APIs public! You can use these endpoints to integrate high-speed Stockfish analysis or real-time multiplayer chess into your own apps.

### 1. Calculate Best Move (REST API)
Instantly calculate the best move for any board position using our Stockfish engine pool.

* **Endpoint:** `POST https://stackbyujjwal1-stackchess.hf.space/calculate_move`
* **Headers:** `Content-Type: application/json`
* **Request Body:**
    ```json
    {
      "fen_string": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "think_time": 1
    }
    ```
* **Response:**
    ```json
    {
      "best_move": "e2e4",
      "score": 0.35,
      "pv": "e2e4",
      "depth": 15
    }
    ```
    *(Note: `score` returns the centipawn evaluation, or a string like "Mate in 3").*

### 2. Multiplayer WebSocket Game Room
Connect two players in a real-time chess match using WebSockets.

* **WebSocket URL:** `wss://stackbyujjwal1-stackchess.hf.space/ws/{room_id}`
    *(Replace `{room_id}` with any random 6-character string).*
* **Events You Can Send:**
    * **Make a move:** `{"type": "move", "source": "e2", "target": "e4", "promotion": "q"}`
    * **Resign:** `{"type": "resign"}`
* **Events You Will Receive:**
    * `{"type": "start", "message": "Game Started! White to move."}`
    * `{"type": "move", "source": "e2", "target": "e4", "promotion": "q"}`
    * `{"type": "disconnect", "message": "Opponent disconnected."}`
    * `{"type": "error", "message": "Room is full!"}`

---

## 💻 Run Locally

Want to run StackChess Pro on your own machine?

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/stackbyujjwal/StackChess.git](https://github.com/stackbyujjwal/StackChess.git)
   cd StackChess
