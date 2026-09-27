import random
import copy

# Cung cấp 1 bảng đã giải sẵn hoàn chỉnh
BASE_SOLUTION = [
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

def shuffle_board(board, seed_value=None):
    if seed_value:
        random.seed(seed_value)
        
    b = copy.deepcopy(board)
    
    # 1. Tráo đổi các con số ngẫu nhiên
    nums = list(range(1, 10))
    shuffled_nums = list(range(1, 10))
    random.shuffle(shuffled_nums)
    mapping = dict(zip(nums, shuffled_nums))
    for r in range(9):
        for c in range(9):
            if b[r][c] != 0:
                b[r][c] = mapping[b[r][c]]
                
    # 2. Tráo đổi các hàng ngang (trong cùng 1 khối 3x3)
    for block in range(3):
        rows = [block*3, block*3+1, block*3+2]
        random.shuffle(rows)
        temp = [copy.deepcopy(b[rows[0]]), copy.deepcopy(b[rows[1]]), copy.deepcopy(b[rows[2]])]
        for i in range(3):
            b[block*3 + i] = temp[i]
            
    # 3. Tráo đổi các cột dọc (trong cùng 1 khối 3x3)
    for block in range(3):
        cols = [block*3, block*3+1, block*3+2]
        random.shuffle(cols)
        temp = [[b[r][cols[i]] for r in range(9)] for i in range(3)]
        for r in range(9):
            for i in range(3):
                b[r][block*3 + i] = temp[i][r]
                
    return b

def generate_sudoku(difficulty, seed_value=None):
    # Bước 1: Sinh ra bảng đáp án hoàn toàn mới cực nhanh
    solution = shuffle_board(BASE_SOLUTION, seed_value)
    board = copy.deepcopy(solution)
    
    # Bước 2: Đục lỗ ngẫu nhiên tùy theo độ khó
    holes = {'easy': 35, 'medium': 45, 'hard': 55}.get(difficulty, 40)
    
    cells = [(r, c) for r in range(9) for c in range(9)]
    if seed_value:
        random.seed(str(seed_value) + "holes")
    random.shuffle(cells)
    
    for r, c in cells[:holes]:
        board[r][c] = 0
        
    return board, solution
