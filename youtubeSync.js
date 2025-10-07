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
    const r = await axios.get(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${youtubeApiKey}`);
    if (!r.data.items.length) throw new Error('Channel not found');
    return r.data.items[0].contentDetails.relatedPlaylists.uploads;
  }

  async function fetchLatestVideos(playlistId, maxResults = 10) {
    const r = await axios.get(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&key=${youtubeApiKey}`);
    return r.data.items || [];
  }

  const playlistId = await getUploadsPlaylistId();
  console.log('Uploads playlist id:', playlistId);

  async function pollOnce() {
    try {
      const state = await readState();
      const items = await fetchLatestVideos(playlistId, 10);
      if (!items.length) return;

      const newestVideoId = items[0].contentDetails.videoId;
      if (state.lastCheckedVideoId === newestVideoId) return;

      const newVideos = [];
      for (const it of items) {
        const vid = it.contentDetails.videoId;
        if (state.lastCheckedVideoId && vid === state.lastCheckedVideoId) break;
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

  await pollOnce();
  setInterval(pollOnce, 1000 * 60 * 5); // every 5 min
}

module.exports = { start };
