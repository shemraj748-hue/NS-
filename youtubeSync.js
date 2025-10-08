const axios = require('axios');
const fs = require('fs-extra');

async function start(opts = {}) {
  const { youtubeApiKey, channelId, postsFile, notifyOwner } = opts;
  if (!youtubeApiKey || !channelId) return console.warn('YouTube sync disabled.');

  async function readState() {
    return fs.pathExists(postsFile) ? fs.readJson(postsFile) : { posts: [], lastCheckedVideoId: null };
  }
  async function writeState(state) { await fs.writeJson(postsFile, state, { spaces: 2 }); }

  async function getUploadsPlaylistId() {
    const r = await axios.get(`https://www.googleapis.com/youtube/v3/channels`, {
      params: { part: 'contentDetails', id: channelId, key: youtubeApiKey }
    });
    if (!r.data.items.length) throw new Error('Channel not found');
    return r.data.items[0].contentDetails.relatedPlaylists.uploads;
  }

  // Fetch all videos from playlist with pagination
  async function fetchAllVideos(playlistId) {
    let allItems = [];
    let nextPageToken = '';
    do {
      const r = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
        params: {
          part: 'snippet,contentDetails',
          playlistId,
          maxResults: 50,
          pageToken: nextPageToken,
          key: youtubeApiKey
        }
      });
      allItems = allItems.concat(r.data.items || []);
      nextPageToken = r.data.nextPageToken;
    } while (nextPageToken);
    return allItems;
  }

  const playlistId = await getUploadsPlaylistId();
  console.log('Uploads playlist id:', playlistId);

  async function pollOnce() {
    try {
      const state = await readState();
      const items = await fetchAllVideos(playlistId);
      if (!items.length) return;

      const newestVideoId = items[0].contentDetails.videoId;
      const knownIds = new Set(state.posts.map(p => p.id));

      const newVideos = [];
      for (const it of items) {
        const vid = it.contentDetails.videoId;
        if (knownIds.has(vid)) continue; // Skip already saved videos
        const snippet = it.snippet || {};
        newVideos.push({
          id: vid,
          title: snippet.title,
          description: snippet.description,
          publishedAt: snippet.publishedAt,
          thumbnail: snippet.thumbnails?.high?.url || null,
          videoUrl: `https://www.youtube.com/watch?v=${vid}`
        });
      }

      if (newVideos.length) {
        state.posts = newVideos.concat(state.posts || []);
        state.lastCheckedVideoId = newestVideoId;
        await writeState(state);

        if (notifyOwner) {
          const titles = newVideos.map(v => `${v.title} (${v.videoUrl})`).join('\n\n');
          await notifyOwner('New YouTube Uploads Synced', `New videos auto-published as blog posts:\n\n${titles}`);
        }
      } else if (!state.lastCheckedVideoId) {
        state.lastCheckedVideoId = newestVideoId;
        await writeState(state);
      }
    } catch (err) { console.error('YouTube poll error:', err.message); }
  }

  // Initial poll
  await pollOnce();
  // Repeat every 5 minutes
  setInterval(pollOnce, 1000 * 60 * 5);
}

module.exports = { start };
