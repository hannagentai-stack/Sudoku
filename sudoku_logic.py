import random
import copy

def is_valid(board, row, col, num):
    for i in range(9):
        if board[row][i] == num or board[i][col] == num:
            return False
    start_row, start_col = 3 * (row // 3), 3 * (col // 3)
    for i in range(3):
        for j in range(3):
            if board[start_row + i][start_col + j] == num:
                return False
    return True

def solve_sudoku(board):
    for row in range(9):
        for col in range(9):
            if board[row][col] == 0:
                for num in range(1, 10):
                    if is_valid(board, row, col, num):
                        board[row][col] = num
                        if solve_sudoku(board):
                            return True
                        board[row][col] = 0
                return False
    return True

def generate_sudoku(difficulty, seed_value=None):
    if seed_value:
        random.seed(seed_value) # Ép hàm random chạy theo 1 khóa cố định (Ngày)
    else:
        random.seed() # Trả lại sự ngẫu nhiên bình thường
        
    board = [[0 for _ in range(9)] for _ in range(9)]
    for i in range(0, 9, 3):
        nums = list(range(1, 10))
        random.shuffle(nums)
        for r in range(3):
            for c in range(3):
                board[i + r][i + c] = nums.pop()
    
    solve_sudoku(board)
    solution = copy.deepcopy(board)
    
    if difficulty == 'easy': removals = 30
    elif difficulty == 'medium': removals = 45
    else: removals = 55
        
    cells = [(r, c) for r in range(9) for c in range(9)]
    random.shuffle(cells)
    
    for r, c in cells[:removals]:
        board[r][c] = 0
            
    if seed_value:
        random.seed() # Reset lại ngẫu nhiên cho các ván chơi thường sau đó
        
    return board, solution