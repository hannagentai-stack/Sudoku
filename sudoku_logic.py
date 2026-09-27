import copy
import random

PRE_BOARD = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
]

def generate_shuffled_board():
    """Tạo bảng giải hoàn chỉnh siêu tốc bằng Ma trận Hoán vị"""
    board = copy.deepcopy(PRE_BOARD)
    # Trộn số (Hoán đổi giá trị 1-9)
    nums = list(range(1, 10))
    random.shuffle(nums)
    num_map = {i+1: nums[i] for i in range(9)}
    for r in range(9):
        for c in range(9):
            board[r][c] = num_map[board[r][c]]
            
    # Trộn các hàng trong cùng một khối 3x3
    for band in range(0, 9, 3):
        rows = [board[band], board[band+1], board[band+2]]
        random.shuffle(rows)
        board[band], board[band+1], board[band+2] = rows
        
    # Trộn các cột trong cùng một khối 3x3
    for band in range(0, 9, 3):
        cols = [band, band+1, band+2]
        random.shuffle(cols)
        for r in range(9):
            temp = [board[r][cols[0]], board[r][cols[1]], board[r][cols[2]]]
            board[r][band], board[r][band+1], board[r][band+2] = temp
            
    return board


# ==========================================
# THUẬT TOÁN ALGORITHM X (DONALD KNUTH)
# Giải Quyết Bài Toán "Exact Cover" (Che Phủ Chính Xác)
# ==========================================

def exact_cover_sudoku():
    """Tạo Không gian Ràng buộc (Constraint Matrix) cho Sudoku 9x9"""
    constraints = []
    for r in range(9):
        for c in range(9): constraints.append(("rc", r, c))
    for i in range(9):
        for n in range(1, 10):
            constraints.append(("rn", i, n))
            constraints.append(("cn", i, n))
            constraints.append(("bn", i, n))
            
    X = {j: set() for j in constraints}
    Y = {}
    for r in range(9):
        for c in range(9):
            for n in range(1, 10):
                b = (r // 3) * 3 + (c // 3)
                Y[(r, c, n)] = [("rc", r, c), ("rn", r, n), ("cn", c, n), ("bn", b, n)]
                
    for row_key, consts in Y.items():
        for const in consts:
            X[const].add(row_key)
    return X, Y

def select(X, Y, r):
    cols = []
    for j in Y[r]:
        for i in X[j]:
            for k in Y[i]:
                if k != j:
                    X[k].remove(i)
        cols.append(X.pop(j))
    return cols

def deselect(X, Y, r, cols):
    for j in reversed(Y[r]):
        X[j] = cols.pop()
        for i in X[j]:
            for k in Y[i]:
                if k != j:
                    X[k].add(i)

def solve_dlx(X, Y, solution):
    """Đệ quy Dancing Links: Lướt qua không gian ma trận thưa"""
    if not X:
        yield list(solution)
    else:
        # Chọn ràng buộc có ít sự lựa chọn nhất (Tối ưu hóa tốc độ Heuristic)
        c = min(X, key=lambda c: len(X[c]))
        for r in list(X[c]):
            solution.append(r)
            cols = select(X, Y, r)
            for s in solve_dlx(X, Y, solution):
                yield s
            deselect(X, Y, r, cols)
            solution.pop()

def check_unique_solution(board):
    """Kiểm tra xem bảng Sudoku có ĐÚNG 1 NGHIỆM DUY NHẤT hay không"""
    X, Y = exact_cover_sudoku()
    solution = []
    
    # Nạp các số đã có sẵn trên bảng vào DLX
    for r in range(9):
        for c in range(9):
            n = board[r][c]
            if n != 0:
                select(X, Y, (r, c, n))
                solution.append((r, c, n))
    
    count = 0
    for _ in solve_dlx(X, Y, solution):
        count += 1
        if count > 1: # Chắc chắn đa nghiệm, dừng sớm để tiết kiệm CPU
            break
    return count == 1


# ==========================================
# KHỞI TẠO BẢNG CHƠI CHUẨN QUỐC TẾ
# ==========================================

def generate_sudoku(difficulty, seed_value=None):
    """
    Quy trình thông minh: 
    1. Trộn ma trận để lấy bảng giải 
    2. Khoét lỗ (Digging) 
    3. Dùng DLX xác thực Nghiệm Duy Nhất sau mỗi lần khoét
    """
    if seed_value:
        random.seed(seed_value)
        
    solution = generate_shuffled_board()
    board = copy.deepcopy(solution)
    
    # Định lượng độ khó
    if difficulty == 'easy': cells_to_remove = random.randint(35, 40)
    elif difficulty == 'medium': cells_to_remove = random.randint(45, 50)
    else: cells_to_remove = random.randint(55, 60) # Chế độ khó sẽ bị xóa rất nhiều lỗ
        
    # Tạo danh sách tọa độ 81 ô và xáo trộn ngẫu nhiên
    positions = [(r, c) for r in range(9) for c in range(9)]
    random.shuffle(positions)
    
    removed = 0
    for r, c in positions:
        if removed >= cells_to_remove:
            break
            
        temp = board[r][c]
        board[r][c] = 0 # Thử khoét lỗ
        
        # Gọi Siêu thuật toán DLX để kiểm tra lỗ vừa khoét
        if check_unique_solution(board):
            # Nếu bảng vẫn ĐỘC NHẤT -> Chấp nhận khoét
            removed += 1
        else:
            # Nếu lỗ này tạo ra 2 cách giải khác nhau -> Bịt lỗ lại, trả về số cũ
            board[r][c] = temp
            
    if seed_value:
        random.seed() # Trả lại sự ngẫu nhiên cho các ván bình thường
        
    return board, solution
