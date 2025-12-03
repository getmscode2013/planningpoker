# Planning Poker - Real-time Team Estimation Tool

A modern, real-time Fast Point application built with Flask and Socket.IO. Enables agile teams to estimate user stories in real-time with a clean, intuitive interface.

## Features

✨ **Real-time Voting**
- Live vote updates across all connected team members
- Automatic user state synchronization
- Instant reveal of all votes when estimation is complete

👥 **Team Collaboration**
- Multi-user support with custom names
- Waiting/Voted user status tracking
- Avatar display with user initials
- Real-time presence updates

📊 **Smart UX**
- Standard Fibonacci voting cards (0, 1, 2, 3, 5, 8, 13, 21, 34)
- Story input for what's being estimated
- "Reveal Votes" button appears when all have voted
- "Start New Round" to reset for next story
- Search and filter tickets (ready for integration)

🎨 **Modern Design**
- Beautiful purple gradient theme inspired by Kollabe
- Responsive layout for desktop and mobile
- Smooth animations and transitions
- Clean card-based interface

## Project Structure

```
planningpoker/
├── app.py              # Flask backend with Socket.IO
├── requirements.txt    # Python dependencies
├── templates/
│   └── index.html      # Main HTML template
├── static/
│   ├── style.css       # Styling (responsive design)
│   └── client.js       # Client-side Socket.IO logic
└── README.md           # This file
```

## Installation

### Prerequisites
- Python 3.7+
- pip (Python package manager)

### Setup Steps

1. **Clone or navigate to the project directory**
   ```bash
   cd d:\python\planningpoker\planningpoker
   ```

2. **Create a virtual environment (recommended)**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate
   
   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. **Activate virtual environment** (if you created one)
   ```bash
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   ```

2. **Start the server**
   ```bash
   python app.py
   ```

3. **Open in your browser**
   - Navigate to `http://localhost:5000`
   - The application runs on port 5000 by default

## How to Use

### Creating an Estimation Session

1. **Open the app** - You'll see the login screen
2. **Enter your name** - What you want to be called in the room
3. **Enter a room ID** - Any unique identifier (e.g., `team-sprint-1`, `project-xyz`)
4. **Join Room** - Click the join button

### Voting on a Story

1. **Add a Story** - Type the user story/task in the input field and click "Add Story"
2. **Choose Your Vote** - Click one of the Fibonacci cards (0, 1, 2, 3, 5, 8, 13, 21, 34)
3. **Wait for Others** - See team members in the left sidebar
   - "Waiting" section shows who hasn't voted yet
   - "Voted" section shows who has cast their vote
4. **Reveal Votes** - Once everyone has voted, the "Reveal Votes" button appears
5. **Start New Round** - After votes are revealed, click "Start New Round" for the next story

### Joining an Existing Room

- Share your Room ID with teammates
- They enter the same Room ID to join your estimation session
- All estimates happen in real-time with live updates

## API - Socket.IO Events

### Client → Server Events

- **join_room** - Join an estimation room
  ```javascript
  socket.emit('join_room', { name: 'John', room_id: 'room-1' })
  ```

- **vote** - Cast a vote
  ```javascript
  socket.emit('vote', { vote: 5 })
  ```

- **reveal_votes** - Reveal all votes to the team
  ```javascript
  socket.emit('reveal_votes')
  ```

- **reset_round** - Reset votes for next story
  ```javascript
  socket.emit('reset_round')
  ```

- **set_story** - Set a new story for estimation
  ```javascript
  socket.emit('set_story', { story: 'Create user login page' })
  ```

### Server → Client Events

- **connected** - Confirmation of connection with user ID
- **room_state** - Updated room state (users, votes, story)
- **error** - Error message

## Technical Stack

| Component | Technology |
|-----------|------------|
| Backend   | Flask 2.3.2 |
| WebSocket | Socket.IO 5.3.4 |
| Frontend  | HTML5, CSS3, JavaScript |
| Storage   | In-memory (Python dicts) |
| Database  | None (session-based) |

## Design Inspiration

The UI design is inspired by [Kollabe](https://kollabe.com), a professional planning poker tool. Key design elements:
- Purple color scheme (#7c3aed primary)
- Card-based voting interface
- User avatars with initials
- Real-time vote visualization
- Clean, modern typography

## Customization

### Change the Port
In `app.py`, modify the last line:
```python
socketio.run(app, debug=True, host='0.0.0.0', port=8080)  # Change port here
```

### Change the Theme
Edit `:root` CSS variables in `static/style.css`:
```css
:root {
    --primary-color: #your-color;
    --primary-dark: #darker-shade;
    /* ... other variables ... */
}
```

### Modify Voting Cards
In `templates/index.html`, update the voting cards section:
```html
<button class="vote-card" onclick="handleVote(YOUR_VALUE)">YOUR_VALUE</button>
```

## Future Enhancements

- 💾 Persistent storage with database (SQLite/PostgreSQL)
- 📱 Mobile app version
- 🔐 User authentication
- 📊 Vote history and analytics
- 🎯 Sprint planning integration
- 🌐 Multi-language support
- 📋 Ticket/story management
- 📤 Export estimates as CSV/PDF

## Troubleshooting

### Port already in use
If port 5000 is already in use, change it in `app.py` or use:
```bash
python app.py --port 8080
```

### Connection issues
- Make sure the Flask server is running
- Check that no firewall is blocking port 5000
- Try `http://localhost:5000` instead of `127.0.0.1:5000`

### Socket.IO not connecting
- Ensure Flask-SocketIO is installed: `pip install Flask-SocketIO`
- Check browser console for errors (F12 → Console tab)
- Try clearing cache and reloading

## Development

### Running in Production
For production deployment, use a production WSGI server:

```bash
pip install gunicorn
gunicorn --worker-class eventlet -w 1 app:app
```

Or with Docker:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["python", "app.py"]
```

## License

This project is provided as-is for educational and team collaboration purposes.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the console (F12 in browser) for error messages
3. Verify all dependencies are installed: `pip list`

---

**Happy Estimating! 🎯**
