// ====== TAB SWITCHING & AUTO RESIZING ======
function resizeAllBoards() {
    if(aBoard) aBoard.resize();
    if(pBoard) pBoard.resize();
    if(mBoard) mBoard.resize();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active-view'));
    event.target.classList.add('active');
    document.getElementById(tabId + '-view').classList.add('active-view');
    resizeAllBoards();
}

window.addEventListener('resize', resizeAllBoards);

// YAHAN APNA HUGGING FACE LINK DAALNA HAI
const API_URL = 'https://stackbyujjwal1-stackchess.hf.space/calculate_move';
const WS_URL = 'wss://stackbyujjwal1-stackchess.hf.space/ws/';

const PIECE_THEME = 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png';

function clearAllHighlights() {
    $('.square-55d63').removeClass('highlight-blue highlight-red highlight-path');
}

function copyPGN(gameInstance) {
    let pgn = gameInstance.pgn();
    if (!pgn) { alert("No moves to copy yet!"); return; }
    navigator.clipboard.writeText(pgn).then(() => {
        alert("PGN Copied to clipboard! Paste it anywhere.");
    });
}

// ==========================================
// TAB 1: ANALYZER LOGIC
// ==========================================
var aBoard = null;
var aSelectedSq = null;
var tempGame = new Chess();

function toggleTurn() {
    let wRadio = document.querySelector('input[name="turn"][value="w"]');
    let bRadio = document.querySelector('input[name="turn"][value="b"]');
    if (wRadio.checked) { wRadio.checked = false; bRadio.checked = true; } 
    else { bRadio.checked = false; wRadio.checked = true; }
}

function handleManualCastling(source, target, piece) {
    if (piece === 'wK' && source === 'e1' && target === 'g1') aBoard.move('h1-f1');
    if (piece === 'wK' && source === 'e1' && target === 'c1') aBoard.move('a1-d1');
    if (piece === 'bK' && source === 'e8' && target === 'g8') aBoard.move('h8-f8');
    if (piece === 'bK' && source === 'e8' && target === 'c8') aBoard.move('a8-d8');
}

var aConfig = {
    draggable: true, dropOffBoard: 'trash', sparePieces: true, position: 'start',
    onDrop: function(source, target, piece) {
        if (source !== target && source !== 'spare' && target !== 'offboard') {
            handleManualCastling(source, target, piece);
            toggleTurn(); 
            updateFenUI();
            clearAllHighlights(); aSelectedSq = null;
        }
    },
    onChange: function() { clearAllHighlights(); updateFenUI(); },
    pieceTheme: PIECE_THEME
};
aBoard = Chessboard('analyzerBoard', aConfig);

$('#analyzerBoard').on('mousedown touchstart', '.square-55d63', function(e) {
    let sq = $(this).attr('data-square');

    if (aSelectedSq && aSelectedSq !== sq) {
        aBoard.move(aSelectedSq + '-' + sq);
        handleManualCastling(aSelectedSq, sq, aBoard.position()[sq]);
        toggleTurn(); updateFenUI();
        clearAllHighlights(); aSelectedSq = null;
        return;
    }

    clearAllHighlights(); aSelectedSq = null;
    let piece = aBoard.position()[sq];

    if (piece) {
        aSelectedSq = sq;
        $(this).addClass('highlight-blue');
        
        let loaded = tempGame.load(generateFullFen());
        if(loaded) {
            let moves = tempGame.moves({ square: sq, verbose: true });
            moves.forEach(m => $('#analyzerBoard .square-' + m.to).addClass('highlight-path'));
        }
    }
});

function generateFullFen() {
    let pos = aBoard.fen();
    let turn = document.querySelector('input[name="turn"]:checked').value;
    let boardState = aBoard.position(); 
    let castling = '';
    if(document.getElementById('cwK').checked && boardState['e1'] === 'wK' && boardState['h1'] === 'wR') castling += 'K';
    if(document.getElementById('cwQ').checked && boardState['e1'] === 'wK' && boardState['a1'] === 'wR') castling += 'Q';
    if(document.getElementById('cbK').checked && boardState['e8'] === 'bK' && boardState['h8'] === 'bR') castling += 'k';
    if(document.getElementById('cbQ').checked && boardState['e8'] === 'bK' && boardState['a8'] === 'bR') castling += 'q';
    if(castling === '') castling = '-';
    return pos + ' ' + turn + ' ' + castling + ' - 0 1';
}

function updateFenUI() { document.getElementById('fenInput').value = generateFullFen(); }
function setFenManual() { aBoard.position(document.getElementById('fenInput').value.split(' ')[0]); clearAllHighlights(); }

function updateEvalBar(scoreValue, type, turn) {
    let actualScore = parseFloat(scoreValue);
    if (turn === 'b' && type !== 'mate') actualScore = -actualScore; 
    let whitePct = 50;
    if (type === 'mate') whitePct = actualScore > 0 ? 100 : 0;
    else {
        let cappedScore = Math.max(-6, Math.min(6, actualScore));
        whitePct = 50 + (cappedScore * 8.33); 
    }
    document.getElementById('evalWhite').style.width = whitePct + '%';
    document.getElementById('evalWhite').innerText = whitePct > 10 ? Math.round(whitePct) + '%' : '';
    document.getElementById('evalBlack').innerText = (100 - whitePct) > 10 ? Math.round(100 - whitePct) + '%' : '';
}
function resetEvalBar() { updateEvalBar(0, 'cp', 'w'); }

async function calculateAnalyzer() {
    let btn = document.getElementById('calcBtn');
    btn.innerText = "Processing...";
    btn.style.background = "#d97706";
    clearAllHighlights();

    try {
        let response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen_string: generateFullFen(), think_time: parseInt(document.getElementById('thinkTime').value) })
        });
        
        let data = await response.json();
        document.getElementById('bestMoveOut').innerText = data.best_move || "None";
        document.getElementById('scoreOut').innerText = data.score;
        document.getElementById('depthOut').innerText = data.depth + "+";

        let currentTurn = document.querySelector('input[name="turn"]:checked').value;
        if (typeof data.score === 'string' && data.score.includes('Mate')) {
            updateEvalBar(data.score.includes('-') ? -100 : 100, 'mate', currentTurn);
        } else updateEvalBar(data.score, 'cp', currentTurn);

        if (data.best_move) {
            let action = document.querySelector('input[name="action"]:checked').value;
            let fromSq = data.best_move.substring(0,2);
            let toSq = data.best_move.substring(2,4);

            if(action === 'make') {
                aBoard.move(fromSq + '-' + toSq);
                handleManualCastling(fromSq, toSq, aBoard.position()[toSq]);
                toggleTurn(); updateFenUI();
            } else {
                $('#analyzerBoard .square-' + fromSq).addClass('highlight-blue');
                $('#analyzerBoard .square-' + toSq).addClass('highlight-red');
            }
        }
    } catch (error) { alert("Backend is offline!"); }
    btn.innerText = "Analyze Position";
    btn.style.background = "#2563eb";
}

// ==========================================
// TAB 2: PLAY VS AI LOGIC
// ==========================================
var pBoard = null;
var pGame = new Chess();
var pSelectedSq = null;

function pOnDragStart (source, piece) { if (pGame.game_over() || piece.search(/^b/) !== -1) return false; }

async function pOnDrop (source, target) {
    var move = pGame.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback'; 
    clearAllHighlights(); pSelectedSq = null;
    updateGameStatus();
    await makeEngineMove();
}

function pOnSnapEnd () { pBoard.position(pGame.fen()); }

var pConfig = { draggable: true, position: 'start', pieceTheme: PIECE_THEME, onDragStart: pOnDragStart, onDrop: pOnDrop, onSnapEnd: pOnSnapEnd };
pBoard = Chessboard('playBoard', pConfig);

$('#playBoard').on('mousedown touchstart', '.square-55d63', async function(e) {
    if (pGame.game_over() || pGame.turn() === 'b') return; 
    let sq = $(this).attr('data-square');
    
    if (pSelectedSq && $(this).hasClass('highlight-path')) {
        let move = pGame.move({ from: pSelectedSq, to: sq, promotion: 'q' });
        if (move) {
            pBoard.position(pGame.fen());
            clearAllHighlights(); pSelectedSq = null;
            updateGameStatus();
            await makeEngineMove();
        }
        return;
    }
    clearAllHighlights(); pSelectedSq = null;
    let piece = pGame.get(sq);
    if (piece && piece.color === 'w') {
        let moves = pGame.moves({ square: sq, verbose: true });
        if (moves.length > 0) {
            pSelectedSq = sq;
            $(this).addClass('highlight-blue');
            moves.forEach(m => $('#playBoard .square-' + m.to).addClass('highlight-path'));
        }
    }
});

async function makeEngineMove() {
    document.getElementById('gameStatus').innerText = "AI is thinking...";
    try {
        let response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen_string: pGame.fen(), think_time: 1 })
        });
        let data = await response.json();
        if(data.best_move) {
            pGame.move({ from: data.best_move.substring(0,2), to: data.best_move.substring(2,4), promotion: 'q' });
            pBoard.position(pGame.fen());
        }
    } catch(e) {}
    updateGameStatus();
}

function updateGameStatus() {
    let statusText = "Your Turn (White)";
    if (pGame.in_checkmate()) statusText = "Game Over - Checkmate!";
    else if (pGame.in_draw()) statusText = "Game Over - Draw!";
    else if (pGame.turn() === 'b') statusText = "AI is thinking...";
    
    document.getElementById('gameStatus').innerText = statusText;
    document.getElementById('moveHistory').innerText = pGame.pgn() || "No moves yet.";
}

function startNewGame() { pGame.reset(); pBoard.start(); clearAllHighlights(); updateGameStatus(); }

// ==========================================
// TAB 3: PLAY ONLINE (MULTIPLAYER) LOGIC
// ==========================================
var mBoard = null;
var mGame = new Chess();
var socket = null;
var myPlayerColor = null; 
var roomActive = false;
var mSelectedSq = null;

var mConfig = {
    draggable: true, position: 'start', pieceTheme: PIECE_THEME,
    onDragStart: function(source, piece) {
        if (!roomActive || mGame.game_over()) return false;
        if ((mGame.turn() === 'w' && piece.search(/^b/) !== -1) || (mGame.turn() === 'b' && piece.search(/^w/) !== -1)) return false;
        if (mGame.turn() !== myPlayerColor) return false;
    },
    onDrop: function(source, target) {
        var move = mGame.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return 'snapback';
        socket.send(JSON.stringify({ type: "move", source: source, target: target, promotion: 'q' }));
        updateMultiStatus();
        clearAllHighlights(); mSelectedSq = null;
    },
    onSnapEnd: function() { mBoard.position(mGame.fen()); }
};
mBoard = Chessboard('multiBoard', mConfig);

$('#multiBoard').on('mousedown touchstart', '.square-55d63', function(e) {
    if (!roomActive || mGame.game_over() || mGame.turn() !== myPlayerColor) return;
    let sq = $(this).attr('data-square');
    
    if (mSelectedSq && $(this).hasClass('highlight-path')) {
        let move = mGame.move({ from: mSelectedSq, to: sq, promotion: 'q' });
        if (move) {
            mBoard.position(mGame.fen());
            socket.send(JSON.stringify({ type: "move", source: mSelectedSq, target: sq, promotion: 'q' }));
            updateMultiStatus();
            clearAllHighlights(); mSelectedSq = null;
        }
        return;
    }
    clearAllHighlights(); mSelectedSq = null;
    let piece = mGame.get(sq);
    if (piece && piece.color === myPlayerColor) {
        let moves = mGame.moves({ square: sq, verbose: true });
        if (moves.length > 0) {
            mSelectedSq = sq;
            $(this).addClass('highlight-blue');
            moves.forEach(m => $('#multiBoard .square-' + m.to).addClass('highlight-path'));
        }
    }
});

function connectToRoom(roomId, isCreator) {
    socket = new WebSocket(WS_URL + roomId);
    socket.onopen = function() {
        document.getElementById('roomControls').style.display = 'none';
        document.getElementById('roomInfo').style.display = 'block';
        document.getElementById('multiActions').style.display = 'flex'; 
        document.getElementById('displayRoomCode').innerText = roomId;
        document.getElementById('multiStatus').innerText = "Waiting for friend to join...";
    };

    socket.onmessage = function(event) {
        let data = JSON.parse(event.data);
        if (data.type === 'start') {
            roomActive = true;
            mGame.reset(); mBoard.start();
            updateMultiStatus();
        } 
        else if (data.type === 'move') {
            mGame.move({ from: data.source, to: data.target, promotion: data.promotion });
            mBoard.position(mGame.fen());
            updateMultiStatus();
        } 
        else if (data.type === 'disconnect') {
            roomActive = false;
            document.getElementById('multiStatus').innerText = data.message;
            document.getElementById('multiStatus').style.color = "#10b981"; 
        }
        else if (data.type === 'error') {
            alert(data.message);
            exitRoom(); 
        }
    };
}

function createRoom() {
    let roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    myPlayerColor = 'w';
    mBoard.orientation('white');
    connectToRoom(roomId, true);
}

function joinRoom() {
    let roomId = document.getElementById('joinRoomCode').value.toUpperCase().trim();
    if (roomId.length !== 6) { alert("Invalid code."); return; }
    myPlayerColor = 'b';
    mBoard.orientation('black');
    connectToRoom(roomId, false);
}

function updateMultiStatus() {
    if (!roomActive) return;
    let statusText = "";
    if (mGame.in_checkmate()) statusText = "Checkmate! " + (mGame.turn() === 'w' ? "Black" : "White") + " wins!";
    else if (mGame.in_draw()) statusText = "Game Over - Draw!";
    else {
        if (mGame.turn() === myPlayerColor) statusText = "Your Turn to move!";
        else statusText = "Friend's turn... waiting.";
    }
    document.getElementById('multiStatus').innerText = statusText;
}

function resignGame(mode) {
    if (!confirm("Are you sure you want to resign?")) return;
    
    if (mode === 'ai') {
        document.getElementById('gameStatus').innerText = "You Resigned. AI Wins!";
        // FIX: pGame.set_fen galti se code ko crash kar raha tha, ab pGame.clear() aur pBoard.clear() use hoga
        pGame.clear(); 
        pBoard.clear(); 
    } else if (mode === 'multi') {
        if (socket && roomActive) {
            socket.send(JSON.stringify({ type: "resign" }));
            roomActive = false;
            document.getElementById('multiStatus').innerText = "You Resigned. You lose.";
            document.getElementById('multiStatus').style.color = "#ef4444";
        }
    }
}

function exitRoom() {
    if (socket) {
        socket.close(); 
        socket = null;
    }
    roomActive = false;
    mGame.reset();
    mBoard.start();
    
    document.getElementById('roomControls').style.display = 'flex';
    document.getElementById('roomInfo').style.display = 'none';
    document.getElementById('multiActions').style.display = 'none';
    document.getElementById('multiStatus').innerText = "Waiting to start...";
    document.getElementById('multiStatus').style.color = "#2563eb";
}

resetEvalBar();
