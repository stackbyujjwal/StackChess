// ====== TAB SWITCHING & AUTO RESIZING ======
function resizeAllBoards() {
    if (window.aBoard) aBoard.resize();
    if (window.pBoard) pBoard.resize();
    if (window.mBoard) mBoard.resize();
    if (window.rBoard) rBoard.resize();
}

function switchTab(tabId) {
    const evt = window.event;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active-view'));

    if (evt && evt.target) {
        evt.target.classList.add('active');
    } else {
        const btn = document.querySelector(`button[onclick="switchTab('${tabId}')"]`);
        if (btn) btn.classList.add('active');
    }
    
    document.getElementById(tabId + '-view').classList.add('active-view');

    // IMPORTANT FIX: 50ms timeout ensures 'display: block' applies before calculating board width
    setTimeout(() => {
        resizeAllBoards();
        cancelPromotion();
    }, 50);
}

window.addEventListener('resize', () => {
    resizeAllBoards();
    cancelPromotion();
});

const API_URL = 'https://stackbyujjwal1-stackchess.hf.space/calculate_move';
const REVIEW_API_URL = 'https://stackbyujjwal1-stackchess.hf.space/review_move';
const WS_URL = 'wss://stackbyujjwal1-stackchess.hf.space/ws/';
const PIECE_THEME = 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png';
window.lastTouch = 0;

// ==========================================
// UTILITIES
// ==========================================
function clearAllHighlights() {
    $('.square-55d63').removeClass('highlight-blue highlight-red highlight-path highlight-best highlight-mistake highlight-blunder');
}

function copyPGN(gameInstance) {
    const pgn = gameInstance.pgn();
    if (!pgn) {
        alert("No moves to copy yet!");
        return;
    }
    navigator.clipboard.writeText(pgn).then(() => {
        alert("PGN Copied to clipboard! Paste it anywhere.");
    });
}

// ==========================================
// SHARED EVALUATION LOGIC
// ==========================================
function updateEvalBar(scoreValue, type, turn, whiteId, blackId) {
    let actualScore = parseFloat(scoreValue);
    if (Number.isNaN(actualScore)) actualScore = 0;

    if (turn === 'b' && type !== 'mate') actualScore = -actualScore;

    let whitePct = 50;
    if (type === 'mate') {
        whitePct = actualScore > 0 ? 100 : 0;
    } else {
        const cappedScore = Math.max(-6, Math.min(6, actualScore));
        whitePct = 50 + (cappedScore * 8.33);
    }

    whitePct = Math.max(0, Math.min(100, whitePct));

    const wEl = document.getElementById(whiteId);
    const bEl = document.getElementById(blackId);

    if (wEl && bEl) {
        wEl.style.width = whitePct + '%';
        bEl.style.width = (100 - whitePct) + '%';

        wEl.innerText = whitePct > 10 ? Math.round(whitePct) + '%' : '';
        bEl.innerText = (100 - whitePct) > 10 ? Math.round(100 - whitePct) + '%' : '';
    }
}

function resetEvalBar(whiteId, blackId) {
    updateEvalBar(0, 'cp', 'w', whiteId, blackId);
}

async function fetchEvaluationBackground(fen, turn, whiteId, blackId) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen_string: fen, think_time: 1 })
        });

        const data = await response.json();
        const isMate = typeof data.score === 'string' && data.score.includes('Mate');
        updateEvalBar(data.score, isMate ? 'mate' : 'cp', turn, whiteId, blackId);
    } catch (e) {}
}

// ==========================================
// VISUAL PAWN PROMOTION LOGIC
// ==========================================
var pendingPromoMove = null;
let promoOpenedAt = 0;

function showPromotionPopup(source, target, mode, turn) {
    pendingPromoMove = { source, target, mode, turn };
    promoOpenedAt = Date.now();

    const color = turn === 'w' ? 'w' : 'b';

    document.getElementById('promo-q').src = `https://chessboardjs.com/img/chesspieces/wikipedia/${color}Q.png`;
    document.getElementById('promo-r').src = `https://chessboardjs.com/img/chesspieces/wikipedia/${color}R.png`;
    document.getElementById('promo-b').src = `https://chessboardjs.com/img/chesspieces/wikipedia/${color}B.png`;
    document.getElementById('promo-n').src = `https://chessboardjs.com/img/chesspieces/wikipedia/${color}N.png`;

    const boardId = mode === 'analyzer' ? '#analyzerBoard' : (mode === 'ai' ? '#playBoard' : '#multiBoard');
    const squareEl = $(`${boardId} .square-${target}`);

    if (!squareEl.length) return;

    const popup = $('#promoPopup');
    const sqOffset = squareEl.offset();
    const sqWidth = squareEl.outerWidth() || 50;

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const availableWidth = Math.max(220, window.innerWidth - 16);
    let pieceSize = Math.floor(Math.min(sqWidth, availableWidth / 5));
    pieceSize = Math.max(40, Math.min(60, pieceSize));

    const popupWidth = pieceSize * 5;
    const popupHeight = pieceSize;

    let left = (sqOffset.left - scrollX);
    let topPos = (sqOffset.top - scrollY) + (sqWidth / 2) - (popupHeight / 2);

    left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8));
    topPos = Math.max(8, Math.min(topPos, window.innerHeight - popupHeight - 8));

    popup.find('.promo-piece, .promo-cancel').css({
        width: pieceSize + 'px',
        height: pieceSize + 'px'
    });

    popup.css({
        display: 'flex',
        position: 'fixed',
        top: topPos + 'px',
        left: left + 'px',
        width: popupWidth + 'px'
    });
}

function cancelPromotion() {
    $('#promoPopup').css('display', 'none');
    pendingPromoMove = null;

    if (window.aBoard) {
        updateFenUI();
        aBoard.position(aBoard.position(), false);
    }
    if (window.pBoard && window.pGame) pBoard.position(pGame.fen(), false);
    if (window.mBoard && window.mGame) mBoard.position(mGame.fen(), false);
}

async function executePromotion(piece) {
    if (Date.now() - promoOpenedAt < 500) return;

    $('#promoPopup').css('display', 'none');
    if (!pendingPromoMove) return;

    const { source, target, mode, turn } = pendingPromoMove;
    pendingPromoMove = null;

    if (mode === 'analyzer') {
        const color = turn === 'w' ? 'w' : 'b';
        const promoPieceCode = color + piece.toUpperCase();

        tempGame.load(generateFullFen());
        const move = tempGame.move({ from: source, to: target, promotion: piece.toLowerCase() });

        if (move) {
            aBoard.position(tempGame.fen(), false);
        } else {
            const pos = { ...aBoard.position() };
            delete pos[source];
            pos[target] = promoPieceCode;
            aBoard.position(pos, false);
        }

        setTurnBasedOnMove(promoPieceCode);
        updateFenUI();
    } else if (mode === 'ai') {
        const move = pGame.move({ from: source, to: target, promotion: piece });
        if (move) {
            pBoard.position(pGame.fen(), false);
            updateGameStatus();
            await makeEngineMove();
        }
    } else if (mode === 'multi') {
        const move = mGame.move({ from: source, to: target, promotion: piece });
        if (move) {
            mBoard.position(mGame.fen(), false);
            socket.send(JSON.stringify({
                type: "move",
                source: source,
                target: target,
                promotion: piece
            }));
            updateMultiStatus();
            fetchEvaluationBackground(mGame.fen(), mGame.turn(), 'evalWhiteMulti', 'evalBlackMulti');
        }
    }
}

// ==========================================
// TAB 1: ANALYZER LOGIC
// ==========================================
var aBoard = null;
var aSelectedSq = null;
var tempGame = new Chess();

function setTurnBasedOnMove(pieceCode) {
    if (!pieceCode) return;

    const wRadio = document.querySelector('input[name="turn"][value="w"]');
    const bRadio = document.querySelector('input[name="turn"][value="b"]');

    if (pieceCode.charAt(0) === 'w') {
        wRadio.checked = false;
        bRadio.checked = true;
    } else if (pieceCode.charAt(0) === 'b') {
        bRadio.checked = false;
        wRadio.checked = true;
    }
}

function handleManualCastling(source, target, piece) {
    const pos = { ...aBoard.position() };
    let changed = false;

    if (piece === 'wK' && source === 'e1' && target === 'g1') {
        delete pos['h1'];
        pos['f1'] = 'wR';
        changed = true;
    }
    if (piece === 'wK' && source === 'e1' && target === 'c1') {
        delete pos['a1'];
        pos['d1'] = 'wR';
        changed = true;
    }
    if (piece === 'bK' && source === 'e8' && target === 'g8') {
        delete pos['h8'];
        pos['f8'] = 'bR';
        changed = true;
    }
    if (piece === 'bK' && source === 'e8' && target === 'c8') {
        delete pos['a8'];
        pos['d8'] = 'bR';
        changed = true;
    }

    if (changed) aBoard.position(pos, false);
}

var aConfig = {
    draggable: true,
    dropOffBoard: 'trash',
    sparePieces: true,
    position: 'start',
    onDrop: function(source, target, piece) {
        if (source !== target && source !== 'spare' && target !== 'offboard') {
            const isPawn = piece.charAt(1) === 'P';
            const rank = target.charAt(1);

            if (isPawn && (rank === '8' || rank === '1')) {
                showPromotionPopup(source, target, 'analyzer', piece.charAt(0));
                return 'snapback';
            }

            const currentPos = { ...aBoard.position() };
            delete currentPos[source];
            currentPos[target] = piece;
            aBoard.position(currentPos, false);

            handleManualCastling(source, target, piece);
            setTurnBasedOnMove(piece);
            updateFenUI();
            clearAllHighlights();
            aSelectedSq = null;
        }
    },
    onChange: function() {
        clearAllHighlights();
        updateFenUI();
    },
    pieceTheme: PIECE_THEME
};

aBoard = Chessboard('analyzerBoard', aConfig);

$('#analyzerBoard').on('mousedown touchstart', '.square-55d63', function(e) {
    if (e.type === 'mousedown' && (Date.now() - window.lastTouch < 500)) return;
    if (e.type === 'touchstart') window.lastTouch = Date.now();

    const sq = $(this).attr('data-square');

    if (aSelectedSq && aSelectedSq !== sq) {
        if ($(this).hasClass('highlight-path')) {
            const pieceMoved = aBoard.position()[aSelectedSq];
            const isPawn = pieceMoved.charAt(1) === 'P';
            const rank = sq.charAt(1);

            if (isPawn && (rank === '8' || rank === '1')) {
                showPromotionPopup(aSelectedSq, sq, 'analyzer', pieceMoved.charAt(0));
                clearAllHighlights();
                aSelectedSq = null;
                return;
            }

            tempGame.load(generateFullFen());
            const move = tempGame.move({ from: aSelectedSq, to: sq, promotion: 'q' });

            if (move) {
                aBoard.position(tempGame.fen(), false);
            } else {
                const currentPos = { ...aBoard.position() };
                delete currentPos[aSelectedSq];
                currentPos[sq] = pieceMoved;
                aBoard.position(currentPos, false);
                setTimeout(() => handleManualCastling(aSelectedSq, sq, pieceMoved), 2);
            }

            setTurnBasedOnMove(pieceMoved);
            updateFenUI();
            clearAllHighlights();
            aSelectedSq = null;
            return;
        }
    }

    clearAllHighlights();
    aSelectedSq = null;

    const piece = aBoard.position()[sq];
    if (piece) {
        aSelectedSq = sq;
        $(this).addClass('highlight-blue');

        const loaded = tempGame.load(generateFullFen());
        if (loaded) {
            const moves = tempGame.moves({ square: sq, verbose: true });
            moves.forEach(m => $('#analyzerBoard .square-' + m.to).addClass('highlight-path'));
        }
    }
});

function generateFullFen() {
    const pos = aBoard.fen();
    const turn = document.querySelector('input[name="turn"]:checked').value;
    const boardState = aBoard.position();

    let castling = '';
    if (document.getElementById('cwK').checked && boardState['e1'] === 'wK' && boardState['h1'] === 'wR') castling += 'K';
    if (document.getElementById('cwQ').checked && boardState['e1'] === 'wK' && boardState['a1'] === 'wR') castling += 'Q';
    if (document.getElementById('cbK').checked && boardState['e8'] === 'bK' && boardState['h8'] === 'bR') castling += 'k';
    if (document.getElementById('cbQ').checked && boardState['e8'] === 'bK' && boardState['a8'] === 'bR') castling += 'q';

    if (castling === '') castling = '-';
    return pos + ' ' + turn + ' ' + castling + ' - 0 1';
}

function updateFenUI() {
    const fenInput = document.getElementById('fenInput');
    if (fenInput) fenInput.value = generateFullFen();
}

async function calculateAnalyzer() {
    const btn = document.getElementById('calcBtn');
    btn.innerText = "Processing...";
    btn.style.background = "#d97706";

    const timeOutField = document.getElementById('analyzerTimeOut');
    if (timeOutField) timeOutField.value = "Thinking...";

    clearAllHighlights();

    const startTime = performance.now();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen_string: generateFullFen(), think_time: 1 })
        });

        const data = await response.json();
        const endTime = performance.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

        if (timeOutField) timeOutField.value = timeTaken + " s";

        document.getElementById('bestMoveOut').innerText = data.best_move || "None";
        document.getElementById('scoreOut').innerText = data.score;
        document.getElementById('depthOut').innerText = data.depth + "+";

        const currentTurn = document.querySelector('input[name="turn"]:checked').value;
        const isMate = typeof data.score === 'string' && data.score.includes('Mate');
        updateEvalBar(data.score, isMate ? 'mate' : 'cp', currentTurn, 'evalWhite', 'evalBlack');

        if (data.best_move) {
            const action = document.querySelector('input[name="action"]:checked').value;
            const fromSq = data.best_move.substring(0, 2);
            const toSq = data.best_move.substring(2, 4);

            if (action === 'make') {
                const pieceMoved = aBoard.position()[fromSq];

                tempGame.load(generateFullFen());
                const move = tempGame.move({ from: fromSq, to: toSq, promotion: 'q' });

                if (move) {
                    aBoard.position(tempGame.fen(), false);
                } else {
                    const currentPos = { ...aBoard.position() };
                    delete currentPos[fromSq];
                    currentPos[toSq] = pieceMoved;
                    aBoard.position(currentPos, false);
                    setTimeout(() => handleManualCastling(fromSq, toSq, pieceMoved), 2);
                }

                if (pieceMoved) setTurnBasedOnMove(pieceMoved);
                updateFenUI();
            } else {
                $('#analyzerBoard .square-' + fromSq).addClass('highlight-blue');
                $('#analyzerBoard .square-' + toSq).addClass('highlight-red');
            }
        }
    } catch (error) {
        alert("Server issue! Please try again.");
    }

    btn.innerText = "Analyze Position";
    btn.style.background = "#2563eb";
}

// ==========================================
// TAB 2: PLAY VS AI LOGIC
// ==========================================
var pBoard = null;
var pGame = new Chess();
var pSelectedSq = null;

function pOnDragStart(source, piece) {
    if (pGame.game_over() || piece.search(/^b/) !== -1) return false;
}

async function pOnDrop(source, target) {
    const moves = pGame.moves({ verbose: true });
    const isPromo = moves.some(m => m.from === source && m.to === target && m.flags.includes('p'));

    if (isPromo) {
        showPromotionPopup(source, target, 'ai', pGame.turn());
        return 'snapback';
    }

    const move = pGame.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    clearAllHighlights();
    pSelectedSq = null;
    updateGameStatus();
    await makeEngineMove();
}

function pOnSnapEnd() {
    pBoard.position(pGame.fen());
}

var pConfig = {
    draggable: true,
    position: 'start',
    pieceTheme: PIECE_THEME,
    onDragStart: pOnDragStart,
    onDrop: pOnDrop,
    onSnapEnd: pOnSnapEnd
};

pBoard = Chessboard('playBoard', pConfig);

$('#playBoard').on('mousedown touchstart', '.square-55d63', async function(e) {
    if (e.type === 'mousedown' && (Date.now() - window.lastTouch < 500)) return;
    if (e.type === 'touchstart') window.lastTouch = Date.now();

    if (pGame.game_over() || pGame.turn() === 'b') return;

    const sq = $(this).attr('data-square');

    if (pSelectedSq && $(this).hasClass('highlight-path')) {
        const moves = pGame.moves({ verbose: true });
        const isPromo = moves.some(m => m.from === pSelectedSq && m.to === sq && m.flags.includes('p'));

        if (isPromo) {
            showPromotionPopup(pSelectedSq, sq, 'ai', pGame.turn());
            clearAllHighlights();
            pSelectedSq = null;
            return;
        }

        const move = pGame.move({ from: pSelectedSq, to: sq, promotion: 'q' });
        if (move) {
            pBoard.position(pGame.fen(), false);
            clearAllHighlights();
            pSelectedSq = null;
            updateGameStatus();
            await makeEngineMove();
        }
        return;
    }

    clearAllHighlights();
    pSelectedSq = null;

    const piece = pGame.get(sq);
    if (piece && piece.color === 'w') {
        const moves = pGame.moves({ square: sq, verbose: true });
        if (moves.length > 0) {
            pSelectedSq = sq;
            $(this).addClass('highlight-blue');
            moves.forEach(m => $('#playBoard .square-' + m.to).addClass('highlight-path'));
        }
    }
});

async function makeEngineMove() {
    document.getElementById('gameStatus').innerText = "AI is thinking...";

    const playTimeField = document.getElementById('playTimeOut');
    if (playTimeField) playTimeField.value = "Thinking...";

    const startTime = performance.now();

    try {
        const fenToEvaluate = pGame.fen();
        const turnToEvaluate = pGame.turn();

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen_string: fenToEvaluate, think_time: 1 })
        });

        const data = await response.json();

        const endTime = performance.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

        if (playTimeField) playTimeField.value = timeTaken + " s";

        const isMate = typeof data.score === 'string' && data.score.includes('Mate');
        updateEvalBar(data.score, isMate ? 'mate' : 'cp', turnToEvaluate, 'evalWhitePlay', 'evalBlackPlay');

        if (data.best_move) {
            pGame.move({
                from: data.best_move.substring(0, 2),
                to: data.best_move.substring(2, 4),
                promotion: 'q'
            });

            pBoard.position(pGame.fen(), false);
            fetchEvaluationBackground(pGame.fen(), pGame.turn(), 'evalWhitePlay', 'evalBlackPlay');
        }
    } catch (e) {}

    updateGameStatus();
}

function updateGameStatus() {
    let statusText = "Your Turn (White)";
    const overlay = document.getElementById('aiResultOverlay');
    overlay.style.display = 'none';

    if (pGame.in_checkmate()) {
        const winner = pGame.turn() === 'w' ? "AI Wins!" : "You Win!";
        statusText = "Game Over - Checkmate!";
        overlay.innerText = winner;
        overlay.style.display = 'flex';
    } else if (pGame.in_draw()) {
        statusText = "Game Over - Draw!";
        overlay.innerText = "Draw!";
        overlay.style.display = 'flex';
    } else if (pGame.turn() === 'b') {
        statusText = "AI is thinking...";
    }

    document.getElementById('gameStatus').innerText = statusText;
    document.getElementById('moveHistory').innerText = pGame.pgn() || "No moves yet.";
}

function startNewGame() {
    pGame.reset();
    pBoard.start();
    clearAllHighlights();
    document.getElementById('aiResultOverlay').style.display = 'none';

    const playTimeField = document.getElementById('playTimeOut');
    if (playTimeField) playTimeField.value = "0.00 s";

    resetEvalBar('evalWhitePlay', 'evalBlackPlay');
    updateGameStatus();
}

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
    draggable: true,
    position: 'start',
    pieceTheme: PIECE_THEME,
    onDragStart: function(source, piece) {
        if (!roomActive || mGame.game_over()) return false;
        if ((mGame.turn() === 'w' && piece.search(/^b/) !== -1) || (mGame.turn() === 'b' && piece.search(/^w/) !== -1)) return false;
        if (mGame.turn() !== myPlayerColor) return false;
    },
    onDrop: function(source, target) {
        const moves = mGame.moves({ verbose: true });
        const isPromo = moves.some(m => m.from === source && m.to === target && m.flags.includes('p'));

        if (isPromo) {
            showPromotionPopup(source, target, 'multi', mGame.turn());
            return 'snapback';
        }

        const move = mGame.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return 'snapback';

        socket.send(JSON.stringify({
            type: "move",
            source: source,
            target: target,
            promotion: 'q'
        }));

        updateMultiStatus();
        clearAllHighlights();
        mSelectedSq = null;
        fetchEvaluationBackground(mGame.fen(), mGame.turn(), 'evalWhiteMulti', 'evalBlackMulti');
    },
    onSnapEnd: function() {
        mBoard.position(mGame.fen());
    }
};

mBoard = Chessboard('multiBoard', mConfig);

$('#multiBoard').on('mousedown touchstart', '.square-55d63', function(e) {
    if (e.type === 'mousedown' && (Date.now() - window.lastTouch < 500)) return;
    if (e.type === 'touchstart') window.lastTouch = Date.now();

    if (!roomActive || mGame.game_over() || mGame.turn() !== myPlayerColor) return;

    const sq = $(this).attr('data-square');

    if (mSelectedSq && $(this).hasClass('highlight-path')) {
        const moves = mGame.moves({ verbose: true });
        const isPromo = moves.some(m => m.from === mSelectedSq && m.to === sq && m.flags.includes('p'));

        if (isPromo) {
            showPromotionPopup(mSelectedSq, sq, 'multi', mGame.turn());
            clearAllHighlights();
            mSelectedSq = null;
            return;
        }

        const move = mGame.move({ from: mSelectedSq, to: sq, promotion: 'q' });
        if (move) {
            mBoard.position(mGame.fen(), false);
            socket.send(JSON.stringify({
                type: "move",
                source: mSelectedSq,
                target: sq,
                promotion: 'q'
            }));
            updateMultiStatus();
            clearAllHighlights();
            mSelectedSq = null;
            fetchEvaluationBackground(mGame.fen(), mGame.turn(), 'evalWhiteMulti', 'evalBlackMulti');
        }
        return;
    }

    clearAllHighlights();
    mSelectedSq = null;

    const piece = mGame.get(sq);
    if (piece && piece.color === myPlayerColor) {
        const moves = mGame.moves({ square: sq, verbose: true });
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
        document.getElementById('multiResultOverlay').style.display = 'none';
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);

        if (data.type === 'start') {
            roomActive = true;
            mGame.reset();
            mBoard.start();
            updateMultiStatus();
            document.getElementById('multiEvalContainer').style.display = 'flex';
            resetEvalBar('evalWhiteMulti', 'evalBlackMulti');
        } else if (data.type === 'move') {
            mGame.move({ from: data.source, to: data.target, promotion: data.promotion });
            mBoard.position(mGame.fen(), false);
            updateMultiStatus();
            fetchEvaluationBackground(mGame.fen(), mGame.turn(), 'evalWhiteMulti', 'evalBlackMulti');
        } else if (data.type === 'disconnect') {
            roomActive = false;
            document.getElementById('multiStatus').innerText = data.message;
            document.getElementById('multiStatus').style.color = "#10b981";

            const overlay = document.getElementById('multiResultOverlay');
            overlay.innerText = "Opponent Left";
            overlay.style.display = 'flex';
        } else if (data.type === 'error') {
            alert(data.message);
            exitRoom();
        }
    };
}

function createRoom() {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    myPlayerColor = 'w';
    mBoard.orientation('white');
    connectToRoom(roomId, true);
}

function joinRoom() {
    const roomId = document.getElementById('joinRoomCode').value.toUpperCase().trim();
    if (roomId.length !== 6) {
        alert("Invalid code.");
        return;
    }
    myPlayerColor = 'b';
    mBoard.orientation('black');
    connectToRoom(roomId, false);
}

function updateMultiStatus() {
    if (!roomActive) return;

    let statusText = "";
    const overlay = document.getElementById('multiResultOverlay');
    overlay.style.display = 'none';

    if (mGame.in_checkmate()) {
        const winnerText = mGame.turn() === 'w' ? "Black Wins!" : "White Wins!";
        statusText = "Checkmate! " + winnerText;
        overlay.innerText = (mGame.turn() === myPlayerColor) ? "You Lose!" : "You Win!";
        overlay.style.display = 'flex';
    } else if (mGame.in_draw()) {
        statusText = "Game Over - Draw!";
        overlay.innerText = "Draw!";
        overlay.style.display = 'flex';
    } else {
        if (mGame.turn() === myPlayerColor) statusText = "Your Turn to move!";
        else statusText = "Friend's turn... waiting.";
    }

    document.getElementById('multiStatus').innerText = statusText;
}

function resignGame(mode) {
    if (!confirm("Are you sure you want to resign?")) return;

    if (mode === 'ai') {
        document.getElementById('gameStatus').innerText = "You Resigned. AI Wins!";
        const overlay = document.getElementById('aiResultOverlay');
        overlay.innerText = "AI Wins!";
        overlay.style.display = 'flex';
        pGame.clear();
        pBoard.clear();
    } else if (mode === 'multi') {
        if (socket && roomActive) {
            socket.send(JSON.stringify({ type: "resign" }));
            roomActive = false;
            document.getElementById('multiStatus').innerText = "You Resigned. You lose.";
            document.getElementById('multiStatus').style.color = "#ef4444";

            const overlay = document.getElementById('multiResultOverlay');
            overlay.innerText = "You Resigned";
            overlay.style.display = 'flex';
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
    document.getElementById('multiResultOverlay').style.display = 'none';
    document.getElementById('multiEvalContainer').style.display = 'none';
}

// Initial eval bar reset
resetEvalBar('evalWhite', 'evalBlack');
resetEvalBar('evalWhitePlay', 'evalBlackPlay');

// ==========================================
// TAB 4: GAME REVIEW LOGIC (CHESS.COM STYLE)
// ==========================================
var rBoard = null;
var rGame = new Chess();
var reviewHistory = [];
var currentReviewIndex = -1;
var isAnalyzing = false;

var rConfig = {
    draggable: false,
    position: 'start',
    pieceTheme: PIECE_THEME
};

// Start Review (Board is loaded exactly when tab is visible to avoid 0x0 size glitch)
function startReview() {
    const pgn = document.getElementById('pgnInput').value.trim();
    if (!pgn) {
        alert("Please paste a PGN first!");
        return;
    }
    
    rGame.reset();
    const loaded = rGame.load_pgn(pgn);
    if (!loaded) {
        alert("Invalid PGN. Please check the text.");
        return;
    }
    
    reviewHistory = rGame.history({ verbose: true });
    rGame.reset();
    
    // Board sirf tab initialize hoga jab PGN load ho jaye, width perfect ayegi!
    if (!rBoard) {
        rBoard = Chessboard('reviewBoard', rConfig);
    }
    rBoard.start();
    
    // Safety auto-resize
    setTimeout(() => { rBoard.resize(); }, 10);
    
    currentReviewIndex = -1;
    
    document.getElementById('reviewControls').style.display = 'block';
    document.getElementById('feedbackBox').style.borderLeftColor = "#64748b";
    document.getElementById('moveQuality').innerText = "Game Loaded";
    document.getElementById('moveQuality').style.color = "#0f172a";
    document.getElementById('moveComment').innerText = `Total Moves: ${reviewHistory.length}. Click Next to start analyzing.`;
    resetEvalBar('evalWhiteReview', 'evalBlackReview');
    clearAllHighlights();
}

async function nextReviewMove() {
    if (isAnalyzing || currentReviewIndex >= reviewHistory.length - 1) return;
    isAnalyzing = true;
    currentReviewIndex++;
    
    const movePlayed = reviewHistory[currentReviewIndex];
    const fenBeforeMove = rGame.fen();
    
    // Execute player's move on board
    rGame.move(movePlayed.san);
    rBoard.position(rGame.fen());
    
    const btn = document.getElementById('nextMoveBtn');
    btn.innerText = "Analyzing...";
    btn.style.background = "#d97706";
    
    try {
        // Evaluate position BEFORE player moved to find the engine's best move
        const response = await fetch(REVIEW_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen_string: fenBeforeMove, think_time: 1 }) 
        });
        const data = await response.json();
        
        clearAllHighlights();
        
        const isMate = typeof data.score === 'string' && data.score.includes('Mate');
        updateEvalBar(data.score, isMate ? 'mate' : 'cp', rGame.turn() === 'w' ? 'b' : 'w', 'evalWhiteReview', 'evalBlackReview');
        
        const engineBestMove = data.best_move; // Output format e.g. "e2e4"
        const playedMoveCoords = movePlayed.from + movePlayed.to;
        
        const fbBox = document.getElementById('feedbackBox');
        const qualityTitle = document.getElementById('moveQuality');
        const comment = document.getElementById('moveComment');
        
        // --- CHESS.COM STYLE HIGHLIGHTING & FEEDBACK ---
        
        // Check if player found the top engine move
        if (engineBestMove === playedMoveCoords || engineBestMove === playedMoveCoords + movePlayed.promotion) {
            qualityTitle.innerText = "★ Best Move";
            qualityTitle.style.color = "#81b64c"; // Green
            fbBox.style.borderLeftColor = "#81b64c";
            comment.innerHTML = `<strong>${movePlayed.san}</strong> is the best move! Excellent play.`;
            
            // Highlight the played move (Green)
            $('#reviewBoard .square-' + movePlayed.from).addClass('highlight-best');
            $('#reviewBoard .square-' + movePlayed.to).addClass('highlight-best');
        } else {
            qualityTitle.innerText = "✖ Inaccuracy / Mistake";
            qualityTitle.style.color = "#e58f02"; // Orange
            fbBox.style.borderLeftColor = "#e58f02";
            
            const bestFrom = engineBestMove.substring(0, 2);
            const bestTo = engineBestMove.substring(2, 4);
            
            comment.innerHTML = `You played <strong>${movePlayed.san}</strong>.<br>The best engine move was <strong>${bestFrom} &rarr; ${bestTo}</strong>.`;
            
            // Highlight player's mistake (Orange)
            $('#reviewBoard .square-' + movePlayed.from).addClass('highlight-mistake');
            $('#reviewBoard .square-' + movePlayed.to).addClass('highlight-mistake');
            
            // Highlight what the engine wanted to do (Green)
            $('#reviewBoard .square-' + bestFrom).addClass('highlight-best');
            $('#reviewBoard .square-' + bestTo).addClass('highlight-best');
        }
        
    } catch (e) {
        document.getElementById('moveQuality').innerText = "Analysis Failed";
        document.getElementById('moveComment').innerText = "Server error while evaluating this move.";
    }
    
    isAnalyzing = false;
    btn.innerText = "Next Move \u2192";
    btn.style.background = "#2563eb";
}

function prevReviewMove() {
    if (isAnalyzing || currentReviewIndex < 0) return;
    
    // Undo logic
    rGame.undo();
    rBoard.position(rGame.fen());
    currentReviewIndex--;
    clearAllHighlights();
    
    document.getElementById('moveQuality').innerText = "Move Undone";
    document.getElementById('moveQuality').style.color = "#64748b";
    document.getElementById('feedbackBox').style.borderLeftColor = "#64748b";
    document.getElementById('moveComment').innerText = "Click Next to re-analyze.";
}
