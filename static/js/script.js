const socket = io(); // Kết nối WebSocket với Server
let currentBoard = [];
let solutionBoard = [];
let selectedCell = null;
let timerInterval = null;
let seconds = 0;
let score = 0;
let currentMode = 'normal'; // 'normal', 'daily', 'multiplayer'
let totalEmptyCells = 0;    // Dùng để tính % tiến trình
let correctCells = 0;
let currentRoomCode = null;

const boardElement = document.getElementById('sudoku-board');
const timerElement = document.getElementById('timer');
const scoreElement = document.getElementById('score');
const themeBtn = document.getElementById('btn-theme');
const mainTitle = document.getElementById('main-title');

// UI Elements cho Multiplayer
const roomModal = document.getElementById('room-modal');
const multiplayerPanel = document.getElementById('multiplayer-panel');
const myProgressEl = document.getElementById('my-progress');
const oppProgressEl = document.getElementById('opp-progress');

// --- CÁC NÚT ĐIỀU HƯỚNG ---
themeBtn.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

document.getElementById('btn-new-game').addEventListener('click', () => {
    currentMode = 'normal';
    mainTitle.innerHTML = '<i class="fa-solid fa-table-cells"></i> Sudoku';
    multiplayerPanel.style.display = 'none';
    const difficulty = document.getElementById('difficulty').value;
    startNewGame(difficulty);
});

document.getElementById('btn-daily').addEventListener('click', () => {
    currentMode = 'daily';
    mainTitle.innerHTML = '<i class="fa-solid fa-calendar-day"></i> Đố Ngày';
    multiplayerPanel.style.display = 'none';
    startNewGame('medium');
});

// --- LOGIC MULTIPLAYER 1vs1 ---
document.getElementById('btn-multiplayer').addEventListener('click', () => {
    roomModal.style.display = 'flex'; // Hiện bảng chọn phòng
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    roomModal.style.display = 'none';
});

// Xin server cấp mã phòng
document.getElementById('btn-create-room').addEventListener('click', () => {
    socket.emit('create_room');
});

// Bấm vào phòng người khác
document.getElementById('btn-join-room').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value;
    if (!code) return alert("Vui lòng nhập mã phòng!");
    socket.emit('join_room', { room_code: code });
});

// Lắng nghe Server: Khi tạo phòng thành công
socket.on('room_created', (data) => {
    alert(`Tạo phòng thành công!\n\n🔑 MÃ PHÒNG: ${data.room_code}\n\nHãy gửi mã này cho bạn bè để họ nhập vào và bắt đầu trận đấu.`);
    currentRoomCode = data.room_code;
});

// Lắng nghe Server: Khi đủ 2 người, Game bắt đầu!
socket.on('game_start', (data) => {
    alert("🔥 ĐỐI THỦ ĐÃ VÀO PHÒNG! TRẬN ĐẤU BẮT ĐẦU!");
    roomModal.style.display = 'none';
    multiplayerPanel.style.display = 'block'; // Hiện 2 thanh tiến trình
    currentMode = 'multiplayer';
    currentRoomCode = data.room_code;
    mainTitle.innerHTML = `⚔️ Đấu: ${currentRoomCode}`;

    currentBoard = data.board;
    solutionBoard = data.solution;
    selectedCell = null;
    score = 0;
    scoreElement.innerText = score;
    myProgressEl.style.width = '0%';
    oppProgressEl.style.width = '0%';

    // Đếm tổng số ô trống để tính % Thanh tiến trình
    totalEmptyCells = 0;
    correctCells = 0;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (currentBoard[r][c] === 0) totalEmptyCells++;
        }
    }

    renderBoard();
    resetTimer();
});

// Nhận tiến độ từ đối thủ
socket.on('opponent_progress', (data) => {
    oppProgressEl.style.width = `${data.progress}%`;
});

// Nhận tin báo thua
socket.on('opponent_won', () => {
    clearInterval(timerInterval);
    alert("💀 BẠN ĐÃ THUA!\nĐối thủ đã giải xong bảng Sudoku trước bạn!");
});

socket.on('error', (data) => {
    alert(data.message);
});

// --- API TẠO BẢNG CHẾ ĐỘ THƯỜNG / ĐỐ NGÀY ---
async function startNewGame(difficulty) {
    const res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: difficulty, mode: currentMode })
    });
    const data = await res.json();
    currentBoard = data.board;
    solutionBoard = data.solution;
    selectedCell = null;
    score = 0;
    scoreElement.innerText = score;
    renderBoard();
    resetTimer();
}

// --- VẼ BẢNG VÀ CHỌN Ô ---
function renderBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            if (currentBoard[r][c] !== 0) {
                cell.innerText = currentBoard[r][c];
                cell.classList.add('readonly');
            }
            cell.addEventListener('click', () => selectCell(r, c));
            boardElement.appendChild(cell);
        }
    }
}

function selectCell(row, col) {
    selectedCell = { row, col };
    const cells = document.querySelectorAll('.cell');
    cells.forEach(c => {
        c.classList.remove('selected', 'highlight');
        const r = parseInt(c.dataset.row);
        const colIdx = parseInt(c.dataset.col);
        if (r === row && colIdx === col) c.classList.add('selected');
        else if (r === row || colIdx === col ||
            (Math.floor(r / 3) === Math.floor(row / 3) && Math.floor(colIdx / 3) === Math.floor(col / 3)))
            c.classList.add('highlight');
    });
}

// Bàn phím bấm
document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!selectedCell) return;
        fillCell(selectedCell.row, selectedCell.col, parseInt(btn.dataset.num));
    });
});
document.addEventListener('keydown', (e) => {
    if (!selectedCell) return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9) fillCell(selectedCell.row, selectedCell.col, num);
    if (e.key === 'Backspace' || e.key === 'Delete') fillCell(selectedCell.row, selectedCell.col, 0);
});

function checkWin() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (currentBoard[r][c] === 0 || currentBoard[r][c] !== solutionBoard[r][c]) return false;
        }
    }
    return true;
}

async function submitDailyScore(name, timeSec) {
    const res = await fetch('/submit_daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: name, time_seconds: timeSec })
    });
    const data = await res.json();
    let boardText = "🏆 BẢNG XẾP HẠNG HÔM NAY 🏆\n\n";
    data.leaderboard.forEach((p, idx) => {
        let m = String(Math.floor(p.time / 60)).padStart(2, '0');
        let s = String(p.time % 60).padStart(2, '0');
        boardText += `Top ${idx + 1}: ${p.name} - ${m}:${s}\n`;
    });
    alert(boardText);
}

// --- XỬ LÝ ĐIỀN Ô VÀ ĐỒNG BỘ MULTIPLAYER ---
function fillCell(row, col, num) {
    const cellEl = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (cellEl.classList.contains('readonly')) return;

    // Xem số cũ có đang đúng không
    const wasCorrect = (currentBoard[row][col] === solutionBoard[row][col] && currentBoard[row][col] !== 0);

    if (num === 0) {
        currentBoard[row][col] = 0;
        cellEl.innerText = '';
        cellEl.classList.remove('error');
        if (wasCorrect) correctCells--;
    } else {
        currentBoard[row][col] = num;
        cellEl.innerText = num;

        if (solutionBoard[row][col] !== num) {
            cellEl.classList.add('error');
            score = Math.max(0, score - 5);
            if (wasCorrect) correctCells--; // Nếu sửa từ số đúng thành số sai
        } else {
            cellEl.classList.remove('error');
            score += 10;
            if (!wasCorrect) correctCells++; // Điền đúng 1 ô mới
        }
        scoreElement.innerText = score;

        // BẮN TIẾN ĐỘ CHẠY SANG MÁY ĐỐI THỦ
        if (currentMode === 'multiplayer') {
            const percent = Math.floor((correctCells / totalEmptyCells) * 100);
            myProgressEl.style.width = `${percent}%`;
            socket.emit('update_progress', { room_code: currentRoomCode, progress: percent });
        }

        // KIỂM TRA CHIẾN THẮNG
        if (checkWin()) {
            clearInterval(timerInterval);

            // Nếu là Multiplayer, báo cho Server biết mình đã thắng để chốt hạ đối thủ
            if (currentMode === 'multiplayer') {
                socket.emit('game_won', { room_code: currentRoomCode });
            }

            setTimeout(() => {
                if (currentMode === 'daily') {
                    let name = prompt(`🎉 CHÚC MỪNG!\nThời gian: ${timerElement.innerText}\nNhập tên để lưu Bảng xếp hạng:`);
                    if (name) submitDailyScore(name, seconds);
                } else if (currentMode === 'multiplayer') {
                    alert(`🏆 BẠN LÀ NGƯỜI CHIẾN THẮNG! 🏆\nĐối thủ hít khói rồi!`);
                } else {
                    alert(`🎉 CHÚC MỪNG CHIẾN THẮNG! 🎉\n⭐ Điểm số: ${score}\n⏱ Thời gian: ${timerElement.innerText}`);
                }
            }, 100);
        }
    }
}

// Cấm gian lận khi Đấu Online / Đố Ngày
document.getElementById('btn-hint').addEventListener('click', () => {
    if (currentMode === 'multiplayer' || currentMode === 'daily') return alert("❌ Tính năng thi đấu/xếp hạng không cho phép dùng Gợi ý!");
    if (!selectedCell) return alert("Chọn 1 ô để gợi ý!");
    fillCell(selectedCell.row, selectedCell.col, solutionBoard[selectedCell.row][selectedCell.col]);
    score = Math.max(0, score - 15);
    scoreElement.innerText = score;
});

document.getElementById('btn-solve').addEventListener('click', () => {
    if (currentMode === 'multiplayer' || currentMode === 'daily') return alert("❌ Tính năng thi đấu/xếp hạng không cho phép Giải tự động!");
    currentBoard = JSON.parse(JSON.stringify(solutionBoard));
    renderBoard();
    clearInterval(timerInterval);
});

function resetTimer() {
    clearInterval(timerInterval);
    seconds = 0;
    timerElement.innerText = "00:00";
    timerInterval = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        timerElement.innerText = `${mins}:${secs}`;
    }, 1000);
}

startNewGame('easy');