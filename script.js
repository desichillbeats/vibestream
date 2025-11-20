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
let currentSong = null;
let playlist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffleOn = false;
let repeatMode = 0; // 0: off, 1: repeat all, 2: repeat one
let player = null;
let playerReady = false;

// YouTube IFrame API
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '1',
        width: '1',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    playerReady = true;
    console.log('YouTube Player Ready');
    // Set initial volume
    player.setVolume(parseInt(volumeSlider.value));
    // Start progress updater
    setInterval(updateProgress, 1000);
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        isPlaying = true;
        playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else if (event.data == YT.PlayerState.PAUSED) {
        isPlaying = false;
        playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    } else if (event.data == YT.PlayerState.ENDED) {
        handleSongEnd();
    }
}

// Search
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    searchTimeout = setTimeout(() => searchSongs(query), 500);
});

async function searchSongs(query) {
    try {
        const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        
        if (results.length > 0) {
            displaySuggestions(results.slice(0, 5));
            displayPlaylist(results);
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

function displaySuggestions(songs) {
    suggestionsContainer.innerHTML = songs.map(song => `
        <div class="suggestion-item" data-video-id="${song.videoId}">
            <img src="${song.cover}" alt="${song.title}">
            <div>
                <strong>${song.title}</strong>
                <span>${song.artist}</span>
            </div>
        </div>
    `).join('');
    
    suggestionsContainer.style.display = 'block';
    
    document.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            const videoId = item.dataset.videoId;
            const song = songs.find(s => s.videoId === videoId);
            if (song) {
                playSong(song);
                suggestionsContainer.style.display = 'none';
            }
        });
    });
}

function displayPlaylist(songs) {
    playlist = songs;
    playlistContainer.innerHTML = songs.map((song, index) => `
        <div class="card" data-index="${index}">
            <img src="${song.cover}" alt="${song.title}">
            <h3>${song.title}</h3>
            <p>${song.artist}</p>
            <button class="btn-play"><i class="fa-solid fa-play"></i></button>
        </div>
    `).join('');
    
    document.querySelectorAll('.card').forEach(card => {
        const playBtn = card.querySelector('.btn-play');
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(card.dataset.index);
            currentIndex = index;
            playSong(playlist[index]);
        });
    });
}

function playSong(song) {
    if (!playerReady) {
        console.error('Player not ready yet');
        return;
    }
    
    currentSong = song;
    currentTitle.textContent = song.title;
    currentArtist.textContent = song.artist;
    trackArt.innerHTML = `<img src="${song.cover}" alt="${song.title}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
    
    try {
        player.loadVideoById(song.videoId);
        player.playVideo();
    } catch (error) {
        console.error('Playback error:', error);
        alert('Failed to play song. Please try another.');
    }
}

function handleSongEnd() {
    if (repeatMode === 2) {
        player.seekTo(0);
        player.playVideo();
    } else {
        playNext();
    }
}

// Player Controls
playPauseBtn.addEventListener('click', () => {
    if (!playerReady || !currentSong) return;
    
    if (isPlaying) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
});

prevBtn.addEventListener('click', () => playPrevious());
nextBtn.addEventListener('click', () => playNext());

function playNext() {
    if (playlist.length === 0) return;
    
    if (isShuffleOn) {
        currentIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentIndex = (currentIndex + 1) % playlist.length;
    }
    
    playSong(playlist[currentIndex]);
}

function playPrevious() {
    if (playlist.length === 0) return;
    
    if (isShuffleOn) {
        currentIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    }
    
    playSong(playlist[currentIndex]);
}

shuffleBtn.addEventListener('click', () => {
    isShuffleOn = !isShuffleOn;
    shuffleBtn.classList.toggle('active', isShuffleOn);
});

repeatBtn.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.classList.toggle('active', repeatMode > 0);
    if (repeatMode === 2) {
        repeatBtn.innerHTML = '<i class="fa-solid fa-repeat-1"></i>';
    } else {
        repeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
    }
});

// Progress Bar
progressBar.addEventListener('click', (e) => {
    if (!playerReady || !currentSong) return;
    
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const duration = player.getDuration();
    player.seekTo(duration * percent);
});

function updateProgress() {
    if (!playerReady || !currentSong) return;
    
    try {
        const currentTime = player.getCurrentTime();
        const duration = player.getDuration();
        
        if (duration > 0) {
            const percent = (currentTime / duration) * 100;
            progressFill.style.width = percent + '%';
            currentTimeEl.textContent = formatTime(currentTime);
            totalDurationEl.textContent = formatTime(duration);
        }
    } catch (error) {
        // Ignore errors during update
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Volume
volumeSlider.addEventListener('input', (e) => {
    if (playerReady) {
        player.setVolume(parseInt(e.target.value));
    }
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) {
        suggestionsContainer.style.display = 'none';
    }
});

// Load default songs on page load
window.addEventListener('load', () => {
    searchSongs('trending music 2024');
});
