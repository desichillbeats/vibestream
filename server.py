from flask import Flask, request, jsonify
from flask_cors import CORS
from ytmusicapi import YTMusic
import logging
import yt_dlp
import os

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

yt = YTMusic()

# Configure yt-dlp
ydl_opts = {
    'format': 'bestaudio/best',
    'quiet': True,
    'no_warnings': True,
    'extract_flat': True,
}


@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    try:
        logger.info(f"Searching for: {query}")
        results = yt.search(query, filter='songs')
        formatted_results = []
        
        for song in results:
            # Safely extract artist names
            artists_list = song.get('artists', [])
            if artists_list:
                artists = ", ".join([artist.get('name', 'Unknown') for artist in artists_list])
            else:
                artists = "Unknown Artist"
            
            # Safely extract thumbnail
            thumbnails = song.get('thumbnails', [])
            thumbnail = thumbnails[-1]['url'] if thumbnails else 'https://via.placeholder.com/300?text=No+Image'
            
            # Safely extract album
            album_data = song.get('album')
            album = album_data.get('name', 'Single') if album_data else 'Single'
            
            formatted_results.append({
                'title': song.get('title', 'Unknown Title'),
                'artist': artists,
                'album': album,
                'cover': thumbnail,
                'videoId': song.get('videoId', ''),
                'duration': song.get('duration', '0:00')
            })
            
        logger.info(f"Found {len(formatted_results)} results")
        return jsonify(formatted_results)
    
    except Exception as e:
        logger.error(f"Error searching: {e}")
        return jsonify({'error': str(e)}), 500
from flask import Flask, request, jsonify
from flask_cors import CORS
from ytmusicapi import YTMusic
import logging
import yt_dlp

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

yt = YTMusic()

# Configure yt-dlp
ydl_opts = {
    'format': 'bestaudio/best',
    'quiet': True,
    'no_warnings': True,
    'extract_flat': True,
}


@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    try:
        logger.info(f"Searching for: {query}")
        results = yt.search(query, filter='songs')
        formatted_results = []
        
        for song in results:
            # Safely extract artist names
            artists_list = song.get('artists', [])
            if artists_list:
                artists = ", ".join([artist.get('name', 'Unknown') for artist in artists_list])
            else:
                artists = "Unknown Artist"
            
            # Safely extract thumbnail
            thumbnails = song.get('thumbnails', [])
            thumbnail = thumbnails[-1]['url'] if thumbnails else 'https://via.placeholder.com/300?text=No+Image'
            
            # Safely extract album
            album_data = song.get('album')
            album = album_data.get('name', 'Single') if album_data else 'Single'
            
            formatted_results.append({
                'title': song.get('title', 'Unknown Title'),
                'artist': artists,
                'album': album,
                'cover': thumbnail,
                'videoId': song.get('videoId', ''),
                'duration': song.get('duration', '0:00')
            })
            
        logger.info(f"Found {len(formatted_results)} results")
        return jsonify(formatted_results)
    
    except Exception as e:
        logger.error(f"Error searching: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/suggestions', methods=['GET'])
def suggestions():
    query = request.args.get('q')
    if not query:
        return jsonify([])

    try:
        suggestions = yt.get_search_suggestions(query)
        return jsonify(suggestions)
    except Exception as e:
        logger.error(f"Suggestion error: {e}")
        return jsonify([])

@app.route('/api/stream', methods=['GET'])
def stream():
    video_id = request.args.get('videoId')
    if not video_id:
        return jsonify({'error': 'No videoId provided'}), 400

    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            # Find best audio format
            formats = info.get('formats', [])
            audio_url = None
            for f in formats:
                if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                    audio_url = f.get('url')
                    break # Get the first available audio
            
            if not audio_url:
                 # Fallback to any url if specific audio-only not found (unlikely)
                 audio_url = info.get('url')

            if audio_url:
                return jsonify({'streamUrl': audio_url})
            else:
                return jsonify({'error': 'No stream found'}), 404

    except Exception as e:
        logger.error(f"Stream error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run on port 5001 to avoid conflicts
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
