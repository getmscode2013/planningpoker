"""
Fast Point Application - Backend
Real-time voting system for agile estimation using Flask and Socket.IO
"""

from flask import Flask, render_template, request, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import secrets
import uuid
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory storage for rooms and sessions
rooms = {}
user_sessions = {}


class Room:
    """Represents a Fast Point room"""

    def __init__(self, room_id):
        self.id = room_id
        self.users = {}  # {user_id: {name, avatar_initials, voted, vote_value}}
        self.current_story = None
        self.story_history = []
        self.votes_revealed = False
        self.created_at = datetime.now()
        self.admin_id = None  # First user to join is admin
        self.voting_system = None  # Set when first user joins

    def add_user(self, user_id, name, avatar=None):
        """Add user to room"""
        avatar_initials = ''.join([word[0].upper() for word in name.split()])[:2]
        # Set first user as admin
        if self.admin_id is None:
            self.admin_id = user_id
        self.users[user_id] = {
            'name': name,
            'avatar_initials': avatar_initials or 'U',
            'avatar_emoji': avatar or '😊',
            'voted': False,
            'vote_value': None,
            'is_admin': user_id == self.admin_id
        }

    def remove_user(self, user_id):
        """Remove user from room"""
        if user_id in self.users:
            del self.users[user_id]

    def cast_vote(self, user_id, vote_value):
        """Record user's vote"""
        if user_id in self.users:
            self.users[user_id]['vote_value'] = vote_value
            self.users[user_id]['voted'] = True

    def reveal_votes(self):
        """Reveal all votes"""
        self.votes_revealed = True

    def reset_round(self):
        """Reset votes for next round"""
        for user in self.users.values():
            user['voted'] = False
            user['vote_value'] = None
        self.votes_revealed = False

    def set_story(self, story_title):
        """Set current story for estimation"""
        self.current_story = {
            'title': story_title,
            'created_at': datetime.now(),
        }
        self.reset_round()

    def get_state(self):
        """Get current room state for broadcasting"""
        return {
            'id': self.id,
            'voting_system': self.voting_system,
            'current_story': self.current_story['title'] if self.current_story else None,
            'users': [
                {
                    'id': uid,
                    'name': user['name'],
                    'avatar_initials': user['avatar_initials'],
                    'avatar_emoji': user.get('avatar_emoji', '😊'),
                    'voted': user['voted'],
                    'vote_value': user['vote_value'] if self.votes_revealed else (
                        '👍' if user['voted'] else None
                    ),
                    'is_admin': user['is_admin']
                }
                for uid, user in self.users.items()
            ],
            'votes_revealed': self.votes_revealed,
            'waiting_count': sum(1 for u in self.users.values() if not u['voted']),
            'voted_count': sum(1 for u in self.users.values() if u['voted'])
        }


@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')


@socketio.on('connect')
def handle_connect():
    """Handle user connection"""
    user_id = str(uuid.uuid4())
    session['user_id'] = user_id
    user_sessions[user_id] = {
        'connected_at': datetime.now(),
        'name': None,
        'current_room': None
    }
    emit('connected', {'user_id': user_id})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle user disconnection"""
    user_id = session.get('user_id')
    if user_id:
        # Remove from any room
        room_id = user_sessions[user_id].get('current_room')
        if room_id and room_id in rooms:
            room = rooms[room_id]
            room.remove_user(user_id)
            socketio.emit('user_left', room.get_state(), room=room_id)

            # Clean up empty rooms
            if not room.users:
                del rooms[room_id]

        if user_id in user_sessions:
            del user_sessions[user_id]


@socketio.on('join_room')
def handle_join_room(data):
    """Handle user joining a room"""
    user_id = session.get('user_id')
    name = data.get('name', 'Anonymous').strip()
    room_id = data.get('room_id', '').strip()
    avatar = data.get('avatar', '😊')
    voting_system = data.get('voting_system', 'fibonacci')

    if not user_id or not name or not room_id:
        emit('error', {'message': 'Invalid room or name'})
        return

    # Check if room already exists
    is_new_room = room_id not in rooms
    
    # Create room if it doesn't exist
    if is_new_room:
        rooms[room_id] = Room(room_id)
        rooms[room_id].voting_system = voting_system
    else:
        # Check if voting system matches for existing room
        if rooms[room_id].voting_system != voting_system:
            emit('error', {'message': f"This room uses {rooms[room_id].voting_system} voting system. You cannot change it."})
            return

    room = rooms[room_id]

    # Remove user from previous room if any
    old_room_id = user_sessions[user_id].get('current_room')
    if old_room_id and old_room_id in rooms and old_room_id != room_id:
        rooms[old_room_id].remove_user(user_id)
        socketio.emit('user_left', rooms[old_room_id].get_state(), room=old_room_id)

    # Add user to room
    room.add_user(user_id, name, avatar)
    user_sessions[user_id]['name'] = name
    user_sessions[user_id]['current_room'] = room_id

    join_room(room_id)

    # Broadcast updated state with room info to all users in room
    room_state = room.get_state()
    room_state['is_new_room'] = is_new_room
    socketio.emit('room_state', room_state, room=room_id)


@socketio.on('vote')
def handle_vote(data):
    """Handle user vote"""
    user_id = session.get('user_id')
    vote_value = data.get('vote')
    room_id = user_sessions[user_id].get('current_room') if user_id else None

    if not room_id or room_id not in rooms or not user_id:
        emit('error', {'message': 'Not in a room'})
        return

    room = rooms[room_id]
    room.cast_vote(user_id, vote_value)

    # Broadcast updated state
    socketio.emit('room_state', room.get_state(), room=room_id)


@socketio.on('reveal_votes')
def handle_reveal():
    """Handle reveal votes request"""
    user_id = session.get('user_id')
    room_id = user_sessions[user_id].get('current_room') if user_id else None

    if not room_id or room_id not in rooms or not user_id:
        emit('error', {'message': 'Not in a room'})
        return

    room = rooms[room_id]
    room.reveal_votes()

    # Broadcast updated state
    socketio.emit('room_state', room.get_state(), room=room_id)


@socketio.on('reset_round')
def handle_reset():
    """Handle reset round request"""
    user_id = session.get('user_id')
    room_id = user_sessions[user_id].get('current_room') if user_id else None

    if not room_id or room_id not in rooms or not user_id:
        emit('error', {'message': 'Not in a room'})
        return

    room = rooms[room_id]
    room.reset_round()

    # Broadcast updated state
    socketio.emit('room_state', room.get_state(), room=room_id)


@socketio.on('set_story')
def handle_set_story(data):
    """Handle new story creation"""
    user_id = session.get('user_id')
    story_title = data.get('story', '').strip()
    room_id = user_sessions[user_id].get('current_room') if user_id else None

    if not room_id or room_id not in rooms or not user_id or not story_title:
        emit('error', {'message': 'Invalid story'})
        return

    room = rooms[room_id]
    room.set_story(story_title)

    # Broadcast updated state
    socketio.emit('room_state', room.get_state(), room=room_id)


@socketio.on('remove_user')
def handle_remove_user(data):
    """Handle admin removing a user from the room"""
    user_id = session.get('user_id')
    user_name_to_remove = data.get('user_name', '').strip()
    room_id = user_sessions[user_id].get('current_room') if user_id else None

    if not room_id or room_id not in rooms or not user_id:
        emit('error', {'message': 'Invalid room'})
        return

    room = rooms[room_id]
    
    # Check if current user is admin
    if not room.users.get(user_id, {}).get('is_admin', False):
        emit('error', {'message': 'Only admin can remove users'})
        return

    # Find and remove the user with matching name
    user_to_remove = None
    for uid, user_info in room.users.items():
        if user_info['name'] == user_name_to_remove and uid != user_id:
            user_to_remove = uid
            break

    if user_to_remove:
        room.remove_user(user_to_remove)
        # Notify the removed user
        socketio.emit('user_removed', {'message': 'You have been removed from the room'}, room=user_to_remove)
        # Broadcast updated state to remaining users
        socketio.emit('room_state', room.get_state(), room=room_id)


if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)