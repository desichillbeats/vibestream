const API_URL = 'https://vibestream-rsum.onrender.com/api';
// DOM Elements
const searchInput = document.getElementById('search-input');
const suggestionsContainer = document.getElementById('suggestions-container');
const playlistContainer = document.getElementById('playlist-container');
const playPauseBtn = document.getElementById('play-pause');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const shuffleBtn = document.getElementById('shuffle');
const repeatBtn = document.getElementById('repeat');
const progressBar = document.querySelector('.progress-bar');
const progressFill = document.getElementById('progress-fill');
const currentTimeEl = document.getElementById('current-time');
const totalDurationEl = document.getElementById('total-duration');
const volumeSlider = document.querySelector('.volume-slider');
const currentTitle = document.getElementById('current-title');
const currentArtist = document.getElementById('current-artist');
const trackArt = document.querySelector('.track-art');

// State
let currentAudio = null;
let isPlaying = false;
let playlist = [];
let currentIndex = 0;
let isShuffle = false;
let isRepeat = false;

// --- Toast Notification System ---
function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        background: ${type === 'error' ? '#ff4444' : 'rgba(15, 12, 41, 0.95)'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
        min-width: 250px;
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Add styles for toast animations
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}
`;
document.head.appendChild(styleSheet);

// --- Stream API (Local Backend) ---

async function getStreamUrl(videoId) {
    try {
        showToast('Fetching audio stream...', 'info');

        // Fetch stream data from local backend
        const response = await fetch(`${API_URL}/stream?videoId=${videoId}`);

        if (!response.ok) {
            throw new Error(`Backend Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        if (!data.streamUrl) {
            throw new Error('No stream URL returned');
        }

        return data.streamUrl;

    } catch (error) {
        console.error('Stream fetch error:', error);
        showToast(`Stream Error: ${error.message}`, 'error');
        return null;
    }
}

// --- Player Logic ---

async function loadSong(song) {
    console.log("Loading song:", song);
    updateMetadata(song);

    // Reset state
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    isPlaying = false;
    updatePlayPauseIcon();
    progressFill.style.width = '0%';
    currentTimeEl.innerText = '0:00';
    totalDurationEl.innerText = 'Loading...';

    try {
        const streamUrl = await getStreamUrl(song.videoId);

        if (!streamUrl) {
            showToast('Failed to load song. Please try another.', 'error');
            return;
        }

        currentAudio = new Audio(streamUrl);
        currentAudio.volume = volumeSlider.value / 100;

        // Event Listeners
        currentAudio.addEventListener('canplay', () => {
            showToast(`Playing: ${song.title}`, 'info');
            currentAudio.play().then(() => {
                isPlaying = true;
                updatePlayPauseIcon();
            }).catch(err => {
                console.error("Playback failed:", err);
                showToast("Playback blocked. Click play to start.", 'error');
            });
        });

        currentAudio.addEventListener('timeupdate', updateProgress);

        currentAudio.addEventListener('ended', () => {
            if (isRepeat) {
                currentAudio.currentTime = 0;
                currentAudio.play();
            } else {
                playNext();
            }
        });

        currentAudio.addEventListener('loadedmetadata', () => {
            totalDurationEl.innerText = formatTime(currentAudio.duration);
        });

        currentAudio.addEventListener('error', (e) => {
            console.error("Audio error:", e);
            showToast("Error playing audio file.", 'error');
        });

    } catch (error) {
        console.error('Error loading song:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

function updateMetadata(song) {
    currentTitle.innerText = song.title;
    currentArtist.innerText = song.artist;
    trackArt.innerHTML = `<img src="${song.cover}" alt="${song.title}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist,
            album: song.album,
            artwork: [{ src: song.cover, sizes: '300x300', type: 'image/jpeg' }]
        });

        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
}

function togglePlay() {
    if (!currentAudio) {
        if (playlist.length > 0) {
            loadSong(playlist[currentIndex]);
        } else {
            showToast("Search for a song first!", 'info');
        }
        return;
    }

    if (isPlaying) {
        currentAudio.pause();
        isPlaying = false;
    } else {
        currentAudio.play();
        isPlaying = true;
    }
    updatePlayPauseIcon();
}

function updatePlayPauseIcon() {
    playPauseBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
}

function playNext() {
    if (playlist.length === 0) return;

    if (isShuffle) {
        currentIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentIndex = (currentIndex + 1) % playlist.length;
    }
    loadSong(playlist[currentIndex]);
}

function playPrev() {
    if (playlist.length === 0) return;

    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    loadSong(playlist[currentIndex]);
}

function updateProgress() {
    if (!currentAudio) return;
    const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
    progressFill.style.width = `${progress}%`;
    currentTimeEl.innerText = formatTime(currentAudio.currentTime);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// --- Event Listeners ---

playPauseBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', playNext);
prevBtn.addEventListener('click', playPrev);

shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    shuffleBtn.style.color = isShuffle ? 'var(--primary-color)' : 'var(--text-secondary)';
    showToast(`Shuffle ${isShuffle ? 'On' : 'Off'}`);
});

repeatBtn.addEventListener('click', () => {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle('active', isRepeat);
    repeatBtn.style.color = isRepeat ? 'var(--primary-color)' : 'var(--text-secondary)';
    showToast(`Repeat ${isRepeat ? 'On' : 'Off'}`);
});

progressBar.addEventListener('click', (e) => {
    if (!currentAudio) return;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    currentAudio.currentTime = percent * currentAudio.duration;
});

volumeSlider.addEventListener('input', (e) => {
    const value = e.target.value / 100;
    if (currentAudio) {
        currentAudio.volume = value;
    }
});

// --- Search & Suggestions ---

let debounceTimer;
searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

    if (query.length > 0) {
        debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
    } else {
        suggestionsContainer.innerHTML = '';
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            searchSongs(query);
            suggestionsContainer.innerHTML = '';
        }
    }
});

async function fetchSuggestions(query) {
    try {
        const response = await fetch(`${API_URL}/suggestions?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Server error');
        const suggestions = await response.json();

        suggestionsContainer.innerHTML = '';
        suggestions.forEach(suggestion => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = suggestion;
            div.onclick = () => {
                searchInput.value = suggestion;
                suggestionsContainer.innerHTML = '';
                searchSongs(suggestion);
            };
            suggestionsContainer.appendChild(div);
        });
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        // Don't toast on suggestion errors to avoid spam
    }
}

async function searchSongs(query) {
    try {
        showToast(`Searching for "${query}"...`);
        const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search failed');
        const results = await response.json();

        if (results.length === 0) {
            showToast('No results found.', 'info');
        } else {
            playlist = results;
            renderPlaylist(results);
            showToast(`Found ${results.length} songs.`);
        }
    } catch (error) {
        console.error('Error searching songs:', error);
        showToast('Failed to search. Is the server running?', 'error');
    }
}

function renderPlaylist(songs) {
    playlistContainer.innerHTML = '';
    songs.forEach((song, index) => {
        const card = document.createElement('div');
        card.className = 'card music-card'; // Added music-card class for styling
        card.innerHTML = `
            <div class="card-image">
                <img src="${song.cover}" alt="${song.title}">
                <div class="play-overlay">
                    <i class="fa-solid fa-play"></i>
                </div>
            </div>
            <div class="card-info">
                <h3>${song.title}</h3>
                <p>${song.artist}</p>
            </div>
        `;

        card.addEventListener('click', () => {
            currentIndex = index;
            loadSong(song);
        });

        playlistContainer.appendChild(card);
    });
}

// Initial setup
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) {
        suggestionsContainer.innerHTML = '';
    }
});

