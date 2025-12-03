/* ========================================
   Fast Point - Client JavaScript
   ======================================== */

let socket;
let currentUser = {
    id: null,
    name: null,
    room: null,
    vote: null,
    avatar: '😊',
    votingSystem: 'fibonacci',
    is_admin: false
};

const roomState = {
    users: [],
    votes_revealed: false,
    current_story: null,
    voted_count: 0,
    waiting_count: 0,
    is_new_room: true
};

// Voting systems definition
const votingSystems = {
    fibonacci: [0, 1, 2, 3, 5, 8, 13, 21, '☕'],
    modified: [0, '1/2', 1, 2, 3, 5, 8, 13, 20, 40, 100, '☕'],
    tshirt: ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '☕'],
    powers: [0, 1, 2, 4, 8, 16, 32, '☕'],
    health: ['😄', '😕', '😐', '😟', '😞', '😭', '😠', '🤯', '☕'],
    traffic: ['🔴', '🟡', '🟢', '☕']
};

// Avatar database by category
const avatarDatabase = {
    male: ['😊', '😄', '🧑‍🦰', '👨', '🧔', '👨‍🦱', '👨‍🦲', '👴', '🧑‍💼', '👨‍🎓', '👨‍🏫', '👨‍⚕️'],
    neutral: ['🤖', '👽', '🎭', '🤡', '👻', '💀', '🎪', '🧛', '🧟', '🧌', '👹', '👺'],
    female: ['👩', '👩‍🦰', '👩‍🦱', '👩‍🦲', '👵', '👩‍🦳', '👩‍💼', '👩‍🎓', '👩‍🏫', '👩‍⚕️', '👱‍♀️', '🧑‍🎨']
};

let currentAvatarTab = 'male';

/**
 * Initialize Socket.IO connection
 */
function initSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('connected', (data) => {
        currentUser.id = data.user_id;
        console.log('User ID:', currentUser.id);
    });

    socket.on('room_state', (state) => {
        Object.assign(roomState, state);
        
        // If this is an existing room, update our voting system to match
        if (!roomState.is_new_room && roomState.voting_system) {
            currentUser.votingSystem = roomState.voting_system;
            const votingSystemInput = document.getElementById('votingSystemInput');
            if (votingSystemInput) {
                votingSystemInput.value = roomState.voting_system;
                votingSystemInput.disabled = true;
                votingSystemInput.title = "You can't change the voting system when joining an existing room";
            }
            // Render voting cards based on room's voting system
            renderVotingCards(roomState.voting_system);
        }
        
        // Update admin status from room state
        if (roomState.users && Array.isArray(roomState.users)) {
            const currentUserData = roomState.users.find(u => u.id === currentUser.id);
            if (currentUserData) {
                currentUser.is_admin = currentUserData.is_admin || false;
                const adminBadge = document.getElementById('adminBadge');
                if (adminBadge) {
                    adminBadge.style.display = currentUser.is_admin ? 'inline-block' : 'none';
                }
            }
        }
        
        updateUI();
    });

    socket.on('user_left', (state) => {
        Object.assign(roomState, state);
        updateUI();
    });

    socket.on('user_removed', (data) => {
        showError(data.message);
        setTimeout(() => {
            location.reload();
        }, 2000);
    });

    socket.on('error', (data) => {
        showError(data.message);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

/**
 * Generate random 6-character alphanumeric room ID
 */
function generateRandomRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Handle login form submission
 */
function handleLogin(event) {
    event.preventDefault();

    const nameInput = document.getElementById('nameInput').value.trim();
    let roomInput = document.getElementById('roomInput').value.trim();
    const avatar = document.getElementById('selectedAvatar').value || currentUser.avatar;
    const votingSystem = document.getElementById('votingSystemInput').value;

    if (!nameInput) {
        showError('Please enter your name');
        return;
    }

    // Generate room ID if not provided
    if (!roomInput) {
        roomInput = generateRandomRoomId();
        document.getElementById('roomInput').value = roomInput;
    }

    currentUser.name = nameInput;
    currentUser.room = roomInput;
    currentUser.avatar = avatar;
    currentUser.votingSystem = votingSystem;

    // Save to localStorage
    localStorage.setItem('planningPokerSession', JSON.stringify({
        name: nameInput,
        room: roomInput,
        avatar: avatar,
        votingSystem: votingSystem
    }));

    // Join room
    socket.emit('join_room', {
        name: nameInput,
        room_id: roomInput,
        avatar: avatar,
        voting_system: votingSystem
    });

    // Switch screens
    setTimeout(() => {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('roomScreen').classList.add('active');
        document.getElementById('userTooltip').textContent = nameInput;
        document.getElementById('roomId').textContent = roomInput;
        renderVotingCards(votingSystem);
    }, 200);
}

/**
 * Render voting cards based on selected voting system
 */
function renderVotingCards(votingSystem) {
    const cardsContainer = document.getElementById('votingCards');
    const cards = votingSystems[votingSystem] || votingSystems.fibonacci;
    
    cardsContainer.innerHTML = '';
    
    cards.forEach((card) => {
        const button = document.createElement('button');
        button.className = 'vote-card';
        button.textContent = card;
        button.onclick = () => handleVote(card);
        cardsContainer.appendChild(button);
    });
}

/**
 * Handle vote casting
 */
function handleVote(value) {
    if (!currentUser.room) return;

    currentUser.vote = value;

    // Update UI immediately
    document.querySelectorAll('.vote-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.classList.add('selected');

    // Send vote to server
    socket.emit('vote', {
        vote: value
    });
}

/**
 * Handle remove user (admin only)
 */
function handleRemoveUser(userName) {
    if (!currentUser.is_admin) {
        showError('Only admin can remove users');
        return;
    }
    
    if (confirm(`Are you sure you want to remove ${userName} from the room?`)) {
        socket.emit('remove_user', {
            user_name: userName
        });
    }
}

/**
 * Handle reveal votes
 */
function handleReveal() {
    socket.emit('reveal_votes');
}

/**
 * Handle reset round
 */
function handleReset() {
    currentUser.vote = null;
    document.querySelectorAll('.vote-card').forEach(card => {
        card.classList.remove('selected');
    });
    socket.emit('reset_round');
}

/**
 * Handle add story
 */
function handleAddStory() {
    const storyInput = document.getElementById('storyInput');
    const story = storyInput.value.trim();

    if (!story) {
        showError('Please enter a story');
        return;
    }

    socket.emit('set_story', {
        story: story
    });

    storyInput.value = '';
}

/**
 * Handle leave room
 */
function handleLeave() {
    if (confirm('Are you sure you want to leave the room?')) {
        localStorage.removeItem('planningPokerSession');
        location.reload();
    }
}

/**
 * Update UI based on room state
 */
function updateUI() {
    updateStory();
    updateUserLists();
    updateVotesDisplay();
    updateVotingCards();
    updateActionButtons();
}

/**
 * Update story display
 */
function updateStory() {
    const storyContent = document.getElementById('storyContent');
    if (storyContent) {
        if (roomState.current_story) {
            storyContent.innerHTML = `<h2>${escapeHtml(roomState.current_story)}</h2>`;
        } else {
            storyContent.innerHTML = '';
        }
    }
}

/**
 * Update user lists (waiting and voted)
 */
function updateUserLists() {
    const waitingList = document.getElementById('waitingList');
    const votedList = document.getElementById('votedList');

    waitingList.innerHTML = '';
    votedList.innerHTML = '';

    roomState.users.forEach(user => {
        const userEl = createUserElement(user);
        if (user.voted) {
            votedList.appendChild(userEl);
        } else {
            waitingList.appendChild(userEl);
        }
    });
}

/**
 * Create user element for sidebar
 */
function createUserElement(user) {
    const div = document.createElement('div');
    div.className = 'user-item';
    const adminBadge = user.is_admin ? ' <span class="admin-label">👑</span>' : '';
    
    // Only show remove button for admin if this is not the admin user
    let removeButton = '';
    if (currentUser.is_admin && !user.is_admin) {
        removeButton = `<button class="btn-remove-user" onclick="handleRemoveUser('${user.name}')" title="Remove user">✕</button>`;
    }
    
    div.innerHTML = `
        <div class="user-avatar">${user.avatar_emoji}</div>
        <div class="user-info">
            <div class="user-name-item">${escapeHtml(user.name)}${adminBadge}</div>
            <div class="user-status">${user.voted ? '✓ Voted' : 'Waiting...'}</div>
        </div>
        ${removeButton}
    `;
    return div;
}

/**
 * Update votes display (avatars with votes)
 */
function updateVotesDisplay() {
    const votesDisplay = document.getElementById('votesDisplay');
    votesDisplay.innerHTML = '';

    if (roomState.users.length === 0) return;

    // Sort users: voted first, then waiting
    const sortedUsers = [...roomState.users].sort((a, b) => {
        if (a.voted === b.voted) return 0;
        return a.voted ? -1 : 1;
    });

    sortedUsers.forEach(user => {
        const voteEl = createVoteAvatarElement(user);
        votesDisplay.appendChild(voteEl);
    });
}

/**
 * Create vote avatar element
 */
function createVoteAvatarElement(user) {
    const div = document.createElement('div');
    div.className = 'vote-avatar';

    let voteValueHTML = '';
    if (user.voted) {
        if (roomState.votes_revealed && user.vote_value && user.vote_value !== '👍') {
            voteValueHTML = `<div class="vote-value revealed">${user.vote_value}</div>`;
        } else if (user.voted) {
            voteValueHTML = `<div class="vote-value empty">${user.vote_value || '👍'}</div>`;
        }
    } else {
        voteValueHTML = `<div class="vote-value empty">-</div>`;
    }

    div.innerHTML = `
        <div class="avatar-circle">${user.avatar_emoji}</div>
        ${voteValueHTML}
        <div class="vote-name">${escapeHtml(user.name)}</div>
    `;
    return div;
}

/**
 * Update voting cards - highlight selected card
 */
function updateVotingCards() {
    document.querySelectorAll('.vote-card').forEach(card => {
        card.classList.remove('selected');
        if (card.textContent.trim() == currentUser.vote) {
            card.classList.add('selected');
        }
    });
}

/**
 * Update action buttons visibility
 */
function updateActionButtons() {
    const revealSection = document.getElementById('revealSection');
    const resetSection = document.getElementById('resetSection');

    // Show reveal button if: all have voted and votes not revealed
    const allVoted = roomState.users.length > 0 && roomState.voted_count === roomState.users.length;
    if (allVoted && !roomState.votes_revealed) {
        revealSection.style.display = 'block';
    } else {
        revealSection.style.display = 'none';
    }

    // Show reset button if: votes are revealed
    if (roomState.votes_revealed) {
        resetSection.style.display = 'block';
    } else {
        resetSection.style.display = 'none';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';

    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Initialize avatar gallery on page load
 */
function initializeAvatarGallery() {
    const gallery = document.getElementById('avatarGallery');
    const preview = document.getElementById('avatarPreview');
    
    // Set default selected avatar
    currentUser.avatar = avatarDatabase['male'][0];
    document.getElementById('selectedAvatar').value = currentUser.avatar;
    preview.textContent = currentUser.avatar;

    renderAvatarGallery('male');
}

/**
 * Render avatar gallery for selected tab
 */
function renderAvatarGallery(tab) {
    const gallery = document.getElementById('avatarGallery');
    gallery.innerHTML = '';

    const avatars = avatarDatabase[tab] || [];
    
    avatars.forEach(avatar => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'avatar-option';
        if (avatar === currentUser.avatar) {
            button.classList.add('selected');
        }
        button.textContent = avatar;
        button.onclick = () => selectAvatar(avatar);
        gallery.appendChild(button);
    });
}

/**
 * Switch avatar tab
 */
function switchAvatarTab(tab) {
    currentAvatarTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Render new gallery
    renderAvatarGallery(tab);
}

/**
 * Select avatar
 */
function selectAvatar(avatar) {
    currentUser.avatar = avatar;
    document.getElementById('selectedAvatar').value = avatar;
    document.getElementById('avatarPreview').textContent = avatar;

    // Update selected state
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.classList.remove('selected');
        if (option.textContent === avatar) {
            option.classList.add('selected');
        }
    });
}

/**
 * Shuffle avatar - pick random from current tab
 */
function shuffleAvatar() {
    const avatars = avatarDatabase[currentAvatarTab];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    selectAvatar(randomAvatar);
}

/**
 * Toggle customize (placeholder for future custom avatar maker)
 */
function toggleCustomize() {
    // This could open a modal or custom avatar editor in the future
    showError('Custom avatars coming soon!');
}

/**
 * Restore session from localStorage
 */
function restoreSession() {
    const sessionData = localStorage.getItem('planningPokerSession');
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            currentUser.name = session.name;
            currentUser.room = session.room;
            currentUser.avatar = session.avatar;
            currentUser.votingSystem = session.votingSystem;

            // Auto-rejoin the room
            socket.emit('join_room', {
                name: session.name,
                room_id: session.room,
                avatar: session.avatar,
                voting_system: session.votingSystem
            });

            // Switch to room screen
            setTimeout(() => {
                document.getElementById('loginScreen').classList.remove('active');
                document.getElementById('roomScreen').classList.add('active');
                document.getElementById('userTooltip').textContent = session.name;
                document.getElementById('roomId').textContent = session.room;
                renderVotingCards(session.votingSystem);
            }, 200);

            return true;
        } catch (e) {
            console.error('Failed to restore session:', e);
            localStorage.removeItem('planningPokerSession');
            return false;
        }
    }
    return false;
}

/**
 * Initialize on page load
 */
/**
 * Load parameters from URL query string
 * Supports: roomId, votingSystem
 */
function loadUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    
    const roomId = params.get('roomId');
    const votingSystem = params.get('votingSystem');
    
    if (roomId) {
        const roomInput = document.getElementById('roomInput');
        roomInput.value = roomId;
    }
    
    if (votingSystem) {
        const votingSystemInput = document.getElementById('votingSystemInput');
        // Check if the voting system is valid
        if (votingSystems[votingSystem]) {
            votingSystemInput.value = votingSystem;
            currentUser.votingSystem = votingSystem;
        }
    }
}

/**
 * Apply theme by adding/removing theme class on root element
 */
function applyTheme(themeName) {
    // Remove all theme classes
    document.documentElement.classList.remove('theme-purple', 'theme-yellow', 'theme-red', 'theme-dark');
    
    // Add the new theme class
    if (themeName && themeName !== 'purple') {
        document.documentElement.classList.add(`theme-${themeName}`);
    }
    
    // Save theme preference to localStorage
    localStorage.setItem('planningPokerTheme', themeName);
    
    // Close theme menu after selection
    const themeMenu = document.getElementById('themeMenu');
    if (themeMenu) {
        themeMenu.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    initializeAvatarGallery();
    
    // Load parameters from URL (for invite links)
    loadUrlParameters();

    // Try to restore session from localStorage
    const sessionRestored = restoreSession();

    // Allow Enter key in login form
    document.getElementById('loginForm').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });
    
    // Add listener to voting system dropdown to warn when joining existing room
    const votingSystemInput = document.getElementById('votingSystemInput');
    if (votingSystemInput) {
        votingSystemInput.addEventListener('change', (e) => {
            if (!roomState.is_new_room && !e.target.disabled) {
                showError("You can't change the voting system when joining an existing room");
                // Reset to original value
                e.target.value = currentUser.votingSystem;
            }
        });
    }
    
    // Add theme toggle listener
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const themeMenu = document.getElementById('themeMenu');
            themeMenu.style.display = themeMenu.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    // Close theme menu when clicking outside
    document.addEventListener('click', () => {
        const themeMenu = document.getElementById('themeMenu');
        if (themeMenu) {
            themeMenu.style.display = 'none';
        }
    });
    
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('planningPokerTheme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }
});

// Invite Modal Functions
function openInviteModal() {
    const modal = document.getElementById('inviteModal');
    modal.style.display = 'flex';
    
    // Generate invite URL with room ID and voting system
    const inviteUrl = `${window.location.origin}?roomId=${encodeURIComponent(currentUser.room)}&votingSystem=${encodeURIComponent(currentUser.votingSystem)}`;
    
    // Set the invite link input value
    const inviteLinkInput = document.getElementById('inviteLink');
    inviteLinkInput.value = inviteUrl;
    
    // Auto-select the entire URL text
    setTimeout(() => {
        inviteLinkInput.select();
    }, 100);
    
    // Generate QR code
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = ''; // Clear previous QR code
    
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
            text: inviteUrl,
            width: 200,
            height: 200,
            colorDark: '#7c3aed',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        qrContainer.innerHTML = '<p style="text-align: center; color: #999;">QR Code not available</p>';
    }
}

function closeInviteModal() {
    const modal = document.getElementById('inviteModal');
    modal.style.display = 'none';
    
    // Clear QR code
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = '';
}

function copyInviteLink() {
    const inviteLinkInput = document.getElementById('inviteLink');
    const copyButton = document.querySelector('.btn-primary[onclick="copyInviteLink()"]');
    
    // Copy to clipboard
    navigator.clipboard.writeText(inviteLinkInput.value).then(() => {
        // Show success message
        const originalText = copyButton.textContent;
        copyButton.textContent = '✅ Copied!';
        
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 2000);
    }).catch(err => {
        // Fallback for older browsers
        inviteLinkInput.select();
        document.execCommand('copy');
        
        const originalText = copyButton.textContent;
        copyButton.textContent = '✅ Copied!';
        
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 2000);
    });
}

function downloadQRCode() {
    const canvas = document.querySelector('#qrCode canvas');
    if (!canvas) {
        showError('QR code not generated yet');
        return;
    }
    
    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `planning-poker-invite-${currentUser.room}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });
}