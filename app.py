import os
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit, join_room, leave_room
from sudoku_logic import generate_sudoku
import datetime
import random
import string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'sudoku-secret'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sudoku.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

class Leaderboard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date_str = db.Column(db.String(10), nullable=False)
    player_name = db.Column(db.String(50), nullable=False)
    time_seconds = db.Column(db.Integer, nullable=False)

with app.app_context():
    db.create_all()

active_rooms = {}

def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate():
    data = request.json
    mode = data.get('mode', 'normal')
    difficulty = data.get('difficulty', 'easy')
    
    if mode == 'daily':
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        board, solution = generate_sudoku('medium', seed_value=today_str)
    else:
        board, solution = generate_sudoku(difficulty)
        
    return jsonify({'board': board, 'solution': solution})

@app.route('/submit_daily', methods=['POST'])
def submit_daily():
    data = request.json
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    new_record = Leaderboard(date_str=today_str, player_name=data.get('player_name'), time_seconds=data.get('time_seconds'))
    db.session.add(new_record)
    db.session.commit()
    
    top_players = Leaderboard.query.filter_by(date_str=today_str).order_by(Leaderboard.time_seconds).limit(5).all()
    leaderboard_data = [{'name': p.player_name, 'time': p.time_seconds} for p in top_players]
    return jsonify({'status': 'success', 'leaderboard': leaderboard_data})


# ==========================================
# 1. LOGIC MULTIPLAYER: ĐỐI KHÁNG (1vs1)
# ==========================================
@socketio.on('create_room')
def handle_create_room():
    room_code = generate_room_code()
    join_room(room_code)
    board, solution = generate_sudoku('medium') 
    active_rooms[room_code] = {'board': board, 'solution': solution, 'type': 'versus'}
    emit('room_created', {'room_code': room_code})

@socketio.on('join_room')
def handle_join_room(data):
    room_code = data.get('room_code').upper()
    if room_code in active_rooms and active_rooms[room_code].get('type') == 'versus':
        join_room(room_code)
        emit('game_start', {
            'board': active_rooms[room_code]['board'],
            'solution': active_rooms[room_code]['solution'],
            'room_code': room_code
        }, to=room_code)
    else:
        emit('error', {'message': 'Mã phòng Đối Kháng không tồn tại!'})

@socketio.on('update_progress')
def handle_update_progress(data):
    emit('opponent_progress', {'progress': data.get('progress')}, to=data.get('room_code'), include_self=False)

@socketio.on('game_won')
def handle_game_won(data):
    emit('opponent_won', {}, to=data.get('room_code'), include_self=False)


# ==========================================
# 2. LOGIC MULTIPLAYER: ĐỒNG ĐỘI (CO-OP)
# ==========================================
@socketio.on('create_coop_room')
def handle_create_coop_room():
    room_code = generate_room_code()
    join_room(room_code)
    board, solution = generate_sudoku('hard')
    active_rooms[room_code] = {'board': board, 'solution': solution, 'type': 'coop'}
    emit('coop_room_created', {'room_code': room_code})

@socketio.on('join_coop_room')
def handle_join_coop_room(data):
    room_code = data.get('room_code').upper()
    if room_code in active_rooms and active_rooms[room_code].get('type') == 'coop':
        join_room(room_code)
        emit('coop_start', {
            'board': active_rooms[room_code]['board'],
            'solution': active_rooms[room_code]['solution'],
            'room_code': room_code
        }, to=room_code)
    else:
        emit('error', {'message': 'Mã phòng Đồng Đội không tồn tại!'})

@socketio.on('coop_select')
def handle_coop_select(data):
    emit('coop_opponent_select', data, to=data.get('room_code'), include_self=False)

@socketio.on('coop_fill')
def handle_coop_fill(data):
    emit('coop_opponent_fill', data, to=data.get('room_code'), include_self=False)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port)
