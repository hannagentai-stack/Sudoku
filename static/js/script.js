const socket = io(); // Kết nối WebSocket với Server
let currentBoard = [];
let solutionBoard = [];
let selectedCell = null;
let timerInterval = null;
let seconds = 0;
let score = 0;
let currentMode = 'normal';
let totalEmptyCells = 0;    
let correctCells = 0;
let currentRoomCode = null;

// --- CÁC BIẾN CHO TÍNH NĂNG MỚI ---
let mistakesCount = 0;
const MAX_MISTAKES = 3;
let isPencilMode = false;
let notesBoard = []; // Mảng 3 chiều lưu các số nháp của từng ô

const boardElement = document.getElementById('sudoku-board');
const timerElement = document.getElementById('timer');
const scoreElement = document.getElementById('score');
const themeBtn = document.getElementById('btn-theme');
const mainTitle = document.getElementById('main-title');
const mistakesElement = document.getElementById('mistakes');
const btnPencil = document.getElementById('btn-pencil');

// UI Elements cho Multiplayer
const roomModal = document.getElementById('room-modal');
const multiplayerPanel = document.getElementById('multiplayer-panel');
const myProgressEl = document.getElementById('my-progress');
const oppProgressEl = document.getElementById('opp-progress');

// --- BẬT TẮT CHẾ ĐỘ SÁNG/TỐI ---
themeBtn.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

// --- NÚT BẬT/TẮT GHI NHÁP ---
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

// --- HÀM CẬP NHẬT 3 TRÁI TIM ---
function updateHearts() {
    let hearts = '';
    for(let i=0; i < MAX_MISTAKES - mistakesCount; i++) hearts += '❤️'; // Tim đỏ
    for(let i=0; i < mistakesCount; i++) hearts += '🖤'; // Tim đen (mất mạng)
    mistakesElement.innerText = hearts;
}

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
    roomModal.style.display = 'flex';
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    roomModal.style.display = 'none';
});

document.getElementById('btn-create-room').addEventListener('click', () => {
    socket.emit('create_room');
});

document.getElementById('btn-join-room').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value;
    if (!code) return alert("Vui lòng nhập mã phòng!");
    socket.emit('join_room', { room_code: code });
});

socket.on('room_created', (data) => {
    alert(`Tạo phòng thành công!\n\n🔑 MÃ PHÒNG: ${data.room_code}\n\nHãy gửi mã này cho bạn bè.`);
    currentRoomCode = data.room_code;
});

socket.on('game_start', (data) => {
    alert("🔥 ĐỐI THỦ ĐÃ VÀO PHÒNG! BẮT ĐẦU!");
    roomModal.style.display = 'none';
    multiplayerPanel.style.display = 'block'; 
    currentMode = 'multiplayer';
    currentRoomCode = data.room_code;
    mainTitle.innerHTML = `⚔️ Đấu: ${currentRoomCode}`;
    
    currentBoard = data.board;
    solutionBoard = data.solution;
    resetGameStats();
});

socket.on('opponent_progress', (data) => {
    oppProgressEl.style.width = `${data.progress}%`;
});

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
    resetGameStats();
}

function resetGameStats() {
    selectedCell = null;
    score = 0;
    scoreElement.innerText = score;
    myProgressEl.style.width = '0%';
    oppProgressEl.style.width = '0%';
    
    // Reset Trái tim và Bàn nháp
    mistakesCount = 0;
    updateHearts();
    notesBoard = Array.from({length: 9}, () => Array.from({length: 9}, () => []));

    totalEmptyCells = 0;
    correctCells = 0;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (currentBoard[r][c] === 0) totalEmptyCells++;
        }
    }

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
                // Đã có số chính thức
                cell.innerHTML = `<div class="cell-value">${currentBoard[r][c]}</div>`;
                cell.classList.add('readonly');
            } else {
                // Ô trống, kiểm tra xem có ghi nháp không
                if (notesBoard[r][c].length > 0) {
                    let notesHtml = '<div class="notes-grid">';
                    for (let i = 1; i <= 9; i++) {
                        if (notesBoard[r][c].includes(i)) notesHtml += `<div class="note">${i}</div>`;
                        else notesHtml += `<div class="note"></div>`;
                    }
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

// Hỗ trợ đánh dấu ô đang chọn
function selectCell(row, col) {
    selectedCell = { row, col };
    const cells = document.querySelectorAll('.cell');
    cells.forEach(c => {
        c.classList.remove('selected', 'highlight');
        const r = parseInt(c.dataset.row);
        const colIdx = parseInt(c.dataset.col);
        if (r === row && colIdx === col) c.classList.add('selected');
        else if (r === row || colIdx === col || 
            (Math.floor(r/3) === Math.floor(row/3) && Math.floor(colIdx/3) === Math.floor(col/3))) 
            c.classList.add('highlight');
    });
}

// Lắng nghe sự kiện Bàn phím
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

// Điều kiện thắng
function checkWin() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (currentBoard[r][c] === 0 || currentBoard[r][c] !== solutionBoard[r][c]) return false;
        }
    }
    return true; 
}

// --- XÓA SỐ NHÁP TỰ ĐỘNG THÔNG MINH ---
// Khi điền đúng số 5, tự xóa hết nháp số 5 ở cùng hàng, cùng cột, cùng khối 3x3
function autoRemoveNotes(row, col, num) {
    for (let i = 0; i < 9; i++) {
        notesBoard[row][i] = notesBoard[row][i].filter(n => n !== num);
        notesBoard[i][col] = notesBoard[i][col].filter(n => n !== num);
    }
    const sr = Math.floor(row/3)*3, sc = Math.floor(col/3)*3;
    for (let r=0; r<3; r++) {
        for (let c=0; c<3; c++) {
            notesBoard[sr+r][sc+c] = notesBoard[sr+r][sc+c].filter(n => n !== num);
        }
    }
}

// --- XỬ LÝ KHI NGƯỜI CHƠI BẤM SỐ ---
function fillCell(row, col, num) {
    const cellEl = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (cellEl.classList.contains('readonly')) return;

    // Nút Xóa (Cục tẩy)
    if (num === 0) {
        currentBoard[row][col] = 0;
        notesBoard[row][col] = []; // Cục tẩy xóa sạch cả số thật lẫn nháp
        renderBoard();
        selectCell(row, col); // Giữ highlight
        return;
    }

    // NẾU ĐANG BẬT BÚT CHÌ (GHI NHÁP)
    if (isPencilMode) {
        if (currentBoard[row][col] !== 0) return; // Nếu ô đã có số thật thì không cho nháp nữa
        
        const noteIdx = notesBoard[row][col].indexOf(num);
        if (noteIdx > -1) notesBoard[row][col].splice(noteIdx, 1); // Bấm lại lần 2 để xóa nháp
        else notesBoard[row][col].push(num); // Bấm lần 1 để viết nháp
        
        renderBoard();
        selectCell(row, col);
        return;
    }

    // NẾU LÀ ĐIỀN SỐ THẬT CHÍNH THỨC
    const wasCorrect = (currentBoard[row][col] === solutionBoard[row][col] && currentBoard[row][col] !== 0);
    currentBoard[row][col] = num;
    notesBoard[row][col] = []; // Đã chốt số thật thì xóa hết nháp ở ô đó đi
    
    if (solutionBoard[row][col] !== num) {
        // TRƯỜNG HỢP: ĐIỀN SAI -> BỊ TRỪ MẠNG
        mistakesCount++;
        updateHearts();
        
        if (mistakesCount >= MAX_MISTAKES) {
            // HẾT MẠNG LÀ GAME OVER LUÔN
            currentBoard = JSON.parse(JSON.stringify(solutionBoard)); // Hiện thẳng đáp án
            renderBoard();
            clearInterval(timerInterval);
            setTimeout(() => {
                alert("💀 GAME OVER!\nBạn đã điền sai quá 3 lần. Trò chơi kết thúc!");
            }, 100);
            return;
        }

        score = Math.max(0, score - 5);
        if (wasCorrect) correctCells--; 
    } else {
        // TRƯỜNG HỢP: ĐIỀN ĐÚNG
        score += 10;
        if (!wasCorrect) correctCells++;
        
        // Tự động xóa số nháp tương ứng ở các ô xung quanh
        autoRemoveNotes(row, col, num);
    }
    
    scoreElement.innerText = score;
    renderBoard();
    selectCell(row, col);

    // Tô đỏ ô nếu điền sai (Phải chèn class error sau khi render lại)
    const newCellEl = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (solutionBoard[row][col] !== num) {
        newCellEl.classList.add('error');
    }

    // BẮN TIẾN ĐỘ CHẠY SANG MÁY ĐỐI THỦ (MULTILAYER)
    if (currentMode === 'multiplayer') {
        const percent = Math.floor((correctCells / totalEmptyCells) * 100);
        myProgressEl.style.width = `${percent}%`;
        socket.emit('update_progress', { room_code: currentRoomCode, progress: percent });
    }

    // KIỂM TRA CHIẾN THẮNG CUỐI CÙNG
    if (checkWin()) {
        clearInterval(timerInterval); 
        
        // Bắn Pháo giấy (Confetti) bay tung tóe ra khắp màn hình!!! 🎉
        confetti({
            particleCount: 150, // Số lượng pháo
            spread: 80,         // Độ văng xa
            origin: { y: 0.6 }  // Nổ từ giữa màn hình hất lên
        });

        if (currentMode === 'multiplayer') socket.emit('game_won', { room_code: currentRoomCode });

        // Chờ 1 giây cho pháo hoa nổ xong thì mới bung thông báo chúc mừng
        setTimeout(() => {
            if (currentMode === 'daily') {
                let name = prompt(`🎉 CHÚC MỪNG!\nThời gian: ${timerElement.innerText}\nNhập tên để lưu Bảng xếp hạng:`);
                if (name) submitDailyScore(name, seconds);
            } else if (currentMode === 'multiplayer') {
                alert(`🏆 BẠN LÀ NGƯỜI CHIẾN THẮNG! 🏆\nĐối thủ hít khói rồi!`);
            } else {
                alert(`🎉 CHÚC MỪNG CHIẾN THẮNG! 🎉\n⭐ Điểm số: ${score}\n⏱ Thời gian: ${timerElement.innerText}`);
            }
        }, 1000); 
    }
}

// Cấm gian lận
document.getElementById('btn-hint').addEventListener('click', () => {
    if (currentMode === 'multiplayer' || currentMode === 'daily') return alert("❌ Không cho dùng Gợi ý!");
    if (!selectedCell) return alert("Chọn 1 ô để gợi ý!");
    fillCell(selectedCell.row, selectedCell.col, solutionBoard[selectedCell.row][selectedCell.col]);
    score = Math.max(0, score - 15);
    scoreElement.innerText = score;
});

document.getElementById('btn-solve').addEventListener('click', () => {
    if (currentMode === 'multiplayer' || currentMode === 'daily') return alert("❌ Không cho Giải tự động!");
    currentBoard = JSON.parse(JSON.stringify(solutionBoard));
    renderBoard();
    clearInterval(timerInterval);
});

async function submitDailyScore(name, timeSec) {
    const res = await fetch('/submit_daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: name, time_seconds: timeSec })
    });
    const data = await res.json();
    let boardText = "🏆 BẢNG XẾP HẠNG HÔM NAY 🏆\n\n";
    data.leaderboard.forEach((p, idx) => {
        let m = String(Math.floor(p.time/60)).padStart(2,'0');
        let s = String(p.time%60).padStart(2,'0');
        boardText += `Top ${idx+1}: ${p.name} - ${m}:${s}\n`;
    });
    alert(boardText);
}

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
