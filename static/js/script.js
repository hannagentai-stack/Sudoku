// Dùng polling để tương thích tốt với server Render miễn phí
const socket = io({ transports: ['polling'] }); 

let initialBoard = [], currentBoard = [], solutionBoard = [], notesBoard = [];
let selectedCell = null, timerInterval = null, seconds = 0, score = 0;
let currentMode = 'normal'; 
let totalEmptyCells = 0, correctCells = 0, currentRoomCode = null;
let mistakesCount = 0; const MAX_MISTAKES = 3; let isPencilMode = false;

const boardElement = document.getElementById('sudoku-board');
const timerElement = document.getElementById('timer');
const scoreElement = document.getElementById('score');
const themeBtn = document.getElementById('btn-theme');
const mainTitle = document.getElementById('main-title');
const mistakesElement = document.getElementById('mistakes');
const btnPencil = document.getElementById('btn-pencil');

const roomModal = document.getElementById('room-modal');
const coopModal = document.getElementById('coop-modal');
const multiplayerPanel = document.getElementById('multiplayer-panel');
const myProgressEl = document.getElementById('my-progress');
const oppProgressEl = document.getElementById('opp-progress');
const homeScreen = document.getElementById('home-screen');

// Sinh số bay lơ lửng cho Sảnh Chờ
function createFloatingNumbers() {
    const bg = document.getElementById('floating-bg');
    for (let i = 0; i < 25; i++) {
        const num = document.createElement('div');
        num.classList.add('floating-num');
        num.innerText = Math.floor(Math.random() * 9) + 1;
        num.style.left = `${Math.random() * 100}%`;
        num.style.animationDuration = `${Math.random() * 8 + 7}s`;
        num.style.animationDelay = `${Math.random() * 5}s`;
        num.style.fontSize = `${Math.random() * 3 + 1.5}rem`;
        bg.appendChild(num);
    }
}
createFloatingNumbers();

// --- THEME & GHI NHÁP ---
themeBtn.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

btnPencil.addEventListener('click', () => {
    isPencilMode = !isPencilMode;
    if (isPencilMode) {
        btnPencil.classList.add('pencil-active');
        btnPencil.innerHTML = '<i class="fa-solid fa-pencil"></i> Nháp: BẬT';
    } else {
        btnPencil.classList.remove('pencil-active');
        btnPencil.innerHTML = '<i class="fa-solid fa-pencil"></i> Nháp: TẮT';
    }
});

function updateHearts() {
    let hearts = '';
    for(let i=0; i < MAX_MISTAKES - mistakesCount; i++) hearts += '❤️'; 
    for(let i=0; i < mistakesCount; i++) hearts += '🖤'; 
    mistakesElement.innerText = hearts;
}

// NÚT TRANG CHỦ GÓC TRÁI MÀN HÌNH
document.getElementById('btn-home').addEventListener('click', () => {
    homeScreen.classList.remove('slide-up'); // Hạ bức màn sảnh chờ xuống
});

// --- CÁC NÚT MENU TẠI SẢNH CHỜ ---
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.target;
        if (target === 'normal') {
            currentMode = 'normal'; mainTitle.innerHTML = '<i class="fa-solid fa-table-cells"></i> Sudoku';
            multiplayerPanel.style.display = 'none'; 
            startNewGame(document.getElementById('difficulty').value);
            homeScreen.classList.add('slide-up'); // Trượt sảnh chờ lên để lộ Game
        } 
        else if (target === 'daily') {
            currentMode = 'daily'; mainTitle.innerHTML = '<i class="fa-solid fa-calendar-day"></i> Đố Ngày';
            multiplayerPanel.style.display = 'none'; 
            startNewGame('medium'); 
            homeScreen.classList.add('slide-up');
        }
        else if (target === 'versus') {
            roomModal.style.display = 'flex';
        }
        else if (target === 'coop') {
            coopModal.style.display = 'flex';
        }
    });
});


// ==========================================
// MENU MULTIPLAYER 1VS1 (ĐỐI KHÁNG)
// ==========================================
document.getElementById('btn-close-modal').addEventListener('click', () => { roomModal.style.display = 'none'; });

document.getElementById('btn-create-room').addEventListener('click', (e) => { 
    e.target.innerText = "⏳ Đang tạo phòng...";
    e.target.style.opacity = '0.5';
    socket.emit('create_room'); 
});

document.getElementById('btn-join-room').addEventListener('click', (e) => {
    const code = document.getElementById('room-code-input').value;
    if (!code) return alert("Vui lòng nhập mã phòng!");
    e.target.innerText = "⏳ Đang kết nối...";
    e.target.style.opacity = '0.5';
    socket.emit('join_room', { room_code: code });
});

socket.on('room_created', (data) => {
    const btn = document.getElementById('btn-create-room');
    btn.innerText = "Tạo phòng mới"; btn.style.opacity = '1'; 
    alert(`Tạo phòng 1VS1 thành công!\n\n🔑 MÃ PHÒNG: ${data.room_code}`);
    currentRoomCode = data.room_code;
});

socket.on('game_start', (data) => {
    const btn = document.getElementById('btn-join-room');
    if (btn) { btn.innerText = "Vào phòng"; btn.style.opacity = '1'; }
    alert("🔥 ĐỐI THỦ ĐÃ VÀO PHÒNG! BẮT ĐẦU!");
    roomModal.style.display = 'none'; multiplayerPanel.style.display = 'block'; 
    currentMode = 'multiplayer'; currentRoomCode = data.room_code;
    
    initialBoard = JSON.parse(JSON.stringify(data.board));
    currentBoard = JSON.parse(JSON.stringify(data.board)); 
    solutionBoard = data.solution; 
    
    mainTitle.innerHTML = `⚔️ Đấu: ${currentRoomCode}`;
    resetGameStats();
    homeScreen.classList.add('slide-up'); // Trượt sảnh chờ lên
});

socket.on('opponent_progress', (data) => { oppProgressEl.style.width = `${data.progress}%`; });
socket.on('opponent_won', () => { clearInterval(timerInterval); alert("💀 BẠN ĐÃ THUA!\nĐối thủ đã giải xong trước!"); });


// ==========================================
// MENU ĐỒNG ĐỘI CO-OP
// ==========================================
document.getElementById('btn-close-coop-modal').addEventListener('click', () => { coopModal.style.display = 'none'; });

document.getElementById('btn-create-coop').addEventListener('click', (e) => { 
    e.target.innerText = "⏳ Đang tạo phòng...";
    e.target.style.opacity = '0.5';
    socket.emit('create_coop_room'); 
});

document.getElementById('btn-join-coop').addEventListener('click', (e) => {
    const code = document.getElementById('coop-code-input').value;
    if (!code) return alert("Vui lòng nhập mã phòng!");
    e.target.innerText = "⏳ Đang kết nối...";
    e.target.style.opacity = '0.5';
    socket.emit('join_coop_room', { room_code: code });
});

socket.on('coop_room_created', (data) => {
    const btn = document.getElementById('btn-create-coop');
    btn.innerText = "Tạo phòng Co-op"; btn.style.opacity = '1';
    alert(`Tạo phòng ĐỒNG ĐỘI thành công!\n\n🔑 MÃ PHÒNG: ${data.room_code}\n\nGửi mã này cho bạn bè nhé!`);
    currentRoomCode = data.room_code;
});

socket.on('coop_start', (data) => {
    const btn = document.getElementById('btn-join-coop');
    if (btn) { btn.innerText = "Vào phòng"; btn.style.opacity = '1'; }
    alert("🤝 ĐỒNG ĐỘI ĐÃ VÀO! HÃY CÙNG NHAU PHÁ ĐẢO!");
    coopModal.style.display = 'none'; multiplayerPanel.style.display = 'none'; 
    currentMode = 'coop'; currentRoomCode = data.room_code;
    
    initialBoard = JSON.parse(JSON.stringify(data.board));
    currentBoard = JSON.parse(JSON.stringify(data.board)); 
    solutionBoard = data.solution; 
    
    mainTitle.innerHTML = `🤝 Co-op: ${currentRoomCode}`;
    resetGameStats();
    homeScreen.classList.add('slide-up'); // Trượt sảnh chờ lên
});

socket.on('error', (data) => { 
    document.getElementById('btn-join-room').innerText = "Vào phòng"; document.getElementById('btn-join-room').style.opacity = '1';
    document.getElementById('btn-join-coop').innerText = "Vào phòng"; document.getElementById('btn-join-coop').style.opacity = '1';
    alert(data.message); 
});
socket.on('coop_opponent_select', (data) => { selectCell(data.row, data.col, true); });
socket.on('coop_opponent_fill', (data) => { fillCell(data.row, data.col, data.num, true); });


// ==========================================
// VẼ BẢNG & TRÒ CHƠI
// ==========================================
async function startNewGame(difficulty) {
    const res = await fetch('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty: difficulty, mode: currentMode }) });
    const data = await res.json();
    initialBoard = JSON.parse(JSON.stringify(data.board));
    currentBoard = JSON.parse(JSON.stringify(data.board)); 
    solutionBoard = data.solution;
    resetGameStats();
}

function resetGameStats() {
    selectedCell = null; score = 0; scoreElement.innerText = score;
    myProgressEl.style.width = '0%'; oppProgressEl.style.width = '0%';
    mistakesCount = 0; updateHearts();
    notesBoard = Array.from({length: 9}, () => Array.from({length: 9}, () => []));
    totalEmptyCells = 0; correctCells = 0;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) if (initialBoard[r][c] === 0) totalEmptyCells++;
    }
    renderBoard(); resetTimer();
}

function renderBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell'); cell.dataset.row = r; cell.dataset.col = c;
            
            if (currentBoard[r][c] !== 0) {
                cell.innerHTML = `<div class="cell-value">${currentBoard[r][c]}</div>`;
                if (initialBoard[r][c] !== 0) {
                    cell.classList.add('readonly');
                } else {
                    if (currentBoard[r][c] !== solutionBoard[r][c]) cell.classList.add('error');
                }
            } else {
                if (notesBoard[r][c].length > 0) {
                    let notesHtml = '<div class="notes-grid">';
                    for (let i = 1; i <= 9; i++) notesHtml += notesBoard[r][c].includes(i) ? `<div class="note">${i}</div>` : `<div class="note"></div>`;
                    notesHtml += '</div>';
                    cell.innerHTML = `<div class="cell-value"></div>` + notesHtml;
                } else {
                    cell.innerHTML = `<div class="cell-value"></div>`;
                }
            }
            cell.addEventListener('click', () => selectCell(r, c));
            boardElement.appendChild(cell);
        }
    }
}

function selectCell(row, col, fromPartner = false) {
    if (fromPartner) {
        document.querySelectorAll('.cell').forEach(c => c.classList.remove('partner-selected'));
        const partnerCell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (partnerCell) partnerCell.classList.add('partner-selected');
        return; 
    }
    selectedCell = { row, col };
    document.querySelectorAll('.cell').forEach(c => {
        c.classList.remove('selected', 'highlight');
        const r = parseInt(c.dataset.row), colIdx = parseInt(c.dataset.col);
        if (r === row && colIdx === col) c.classList.add('selected');
        else if (r === row || colIdx === col || (Math.floor(r/3) === Math.floor(row/3) && Math.floor(colIdx/3) === Math.floor(col/3))) c.classList.add('highlight');
    });
    if (currentMode === 'coop') socket.emit('coop_select', { room_code: currentRoomCode, row: row, col: col });
}

document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => { if (selectedCell) fillCell(selectedCell.row, selectedCell.col, parseInt(btn.dataset.num)); });
});
document.addEventListener('keydown', (e) => {
    if (!selectedCell) return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9) fillCell(selectedCell.row, selectedCell.col, num);
    if (e.key === 'Backspace' || e.key === 'Delete') fillCell(selectedCell.row, selectedCell.col, 0);
});

function checkWin() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) if (currentBoard[r][c] === 0 || currentBoard[r][c] !== solutionBoard[r][c]) return false;
    }
    return true; 
}

function autoRemoveNotes(row, col, num) {
    for (let i = 0; i < 9; i++) {
        notesBoard[row][i] = notesBoard[row][i].filter(n => n !== num);
        notesBoard[i][col] = notesBoard[i][col].filter(n => n !== num);
    }
    const sr = Math.floor(row/3)*3, sc = Math.floor(col/3)*3;
    for (let r=0; r<3; r++) {
        for (let c=0; c<3; c++) notesBoard[sr+r][sc+c] = notesBoard[sr+r][sc+c].filter(n => n !== num);
    }
}

function fillCell(row, col, num, fromPartner = false) {
    if (initialBoard[row][col] !== 0) return; 
    if (num !== 0 && !isPencilMode && currentBoard[row][col] === num) return; 

    if (num === 0) {
        if (currentBoard[row][col] === solutionBoard[row][col]) correctCells--; 
        currentBoard[row][col] = 0; notesBoard[row][col] = [];
        renderBoard(); selectCell(row, col); 
        if (currentMode === 'coop' && !fromPartner) socket.emit('coop_fill', { room_code: currentRoomCode, row: row, col: col, num: 0 });
        return;
    }

    if (isPencilMode && !fromPartner) {
        if (currentBoard[row][col] !== 0) return; 
        const noteIdx = notesBoard[row][col].indexOf(num);
        if (noteIdx > -1) notesBoard[row][col].splice(noteIdx, 1); 
        else notesBoard[row][col].push(num); 
        renderBoard(); selectCell(row, col);
        return;
    }

    const wasCorrect = (currentBoard[row][col] === solutionBoard[row][col] && currentBoard[row][col] !== 0);
    currentBoard[row][col] = num; notesBoard[row][col] = []; 
    
    if (currentMode === 'coop' && !fromPartner) socket.emit('coop_fill', { room_code: currentRoomCode, row: row, col: col, num: num });

    if (solutionBoard[row][col] !== num) {
        mistakesCount++; updateHearts();
        if (mistakesCount >= MAX_MISTAKES) {
            currentBoard = JSON.parse(JSON.stringify(solutionBoard)); 
            renderBoard(); clearInterval(timerInterval);
            setTimeout(() => { alert(currentMode === 'coop' ? "💀 GAME OVER!\nCả team đã bóp nhau quá 3 lần!" : "💀 GAME OVER!\nBạn đã điền sai quá 3 lần."); }, 100);
            return;
        }
        score = Math.max(0, score - 5); if (wasCorrect) correctCells--; 
    } else {
        score += 10; if (!wasCorrect) correctCells++;
        autoRemoveNotes(row, col, num);
    }
    
    scoreElement.innerText = score; renderBoard(); selectCell(row, col);

    if (currentMode === 'multiplayer' && !fromPartner) {
        const percent = Math.floor((correctCells / totalEmptyCells) * 100);
        myProgressEl.style.width = `${percent}%`;
        socket.emit('update_progress', { room_code: currentRoomCode, progress: percent });
    }

    if (checkWin()) {
        clearInterval(timerInterval); 
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
        if (currentMode === 'multiplayer' && !fromPartner) socket.emit('game_won', { room_code: currentRoomCode });

        setTimeout(() => {
            if (currentMode === 'coop') alert(`🤝 TUYỆT VỜI! Cả hai bạn đã cùng nhau phá đảo thành công!`);
            else if (currentMode === 'daily') { let name = prompt(`🎉 CHÚC MỪNG!\nThời gian: ${timerElement.innerText}\nNhập tên:`); if (name) submitDailyScore(name, seconds); }
            else if (currentMode === 'multiplayer') alert(`🏆 BẠN LÀ NGƯỜI CHIẾN THẮNG! 🏆\nĐối thủ hít khói rồi!`);
            else alert(`🎉 CHÚC MỪNG CHIẾN THẮNG! 🎉\n⭐ Điểm số: ${score}\n⏱ Thời gian: ${timerElement.innerText}`);
        }, 1000); 
    }
}

document.getElementById('btn-hint').addEventListener('click', () => {
    if (currentMode === 'multiplayer' || currentMode === 'daily' || currentMode === 'coop') return alert("❌ Chế độ này không cho dùng Gợi ý!");
    if (!selectedCell) return alert("Chọn 1 ô để gợi ý!");
    fillCell(selectedCell.row, selectedCell.col, solutionBoard[selectedCell.row][selectedCell.col]);
});
document.getElementById('btn-solve').addEventListener('click', () => {
    if (currentMode === 'multiplayer' || currentMode === 'daily' || currentMode === 'coop') return alert("❌ Không cho Giải tự động!");
    currentBoard = JSON.parse(JSON.stringify(solutionBoard)); renderBoard(); clearInterval(timerInterval);
});

async function submitDailyScore(name, timeSec) {
    const res = await fetch('/submit_daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player_name: name, time_seconds: timeSec }) });
    const data = await res.json();
    let boardText = "🏆 BẢNG XẾP HẠNG HÔM NAY 🏆\n\n";
    data.leaderboard.forEach((p, idx) => { boardText += `Top ${idx+1}: ${p.name} - ${String(Math.floor(p.time/60)).padStart(2,'0')}:${String(p.time%60).padStart(2,'0')}\n`; });
    alert(boardText);
}

function resetTimer() {
    clearInterval(timerInterval); seconds = 0; timerElement.innerText = "00:00";
    timerInterval = setInterval(() => {
        seconds++; timerElement.innerText = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
}
