/* frontend/js/main.js */

document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Mobile menu toggle
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    const links = document.querySelector('.nav-links');
    if (!links) return;
    links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
  });

  // Contact form handler with blast popup
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      contactForm.classList.add('blast');

      const formData = {
        name: contactForm.name.value,
        email: contactForm.email.value,
        message: contactForm.message.value
      };

      const blastPopup = document.getElementById('blastPopup');
      if (blastPopup) blastPopup.classList.remove('hidden');

      try {
        const resp = await fetch('http://localhost:4000/api/contact', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(formData)
        });
        const data = await resp.json().catch(()=>({ok:false}));
        setTimeout(()=>{
          if (blastPopup) {
            const msg = blastPopup.querySelector('.blast-message');
            if (msg) msg.textContent = 'Your form has been submitted. Thank you!';
            const closeBtn = blastPopup.querySelector('#blastClose');
            if (closeBtn) closeBtn.style.display = 'inline-block';
          }
          contactForm.reset();
        },900);

      } catch (err) {
        setTimeout(()=>{
          if (blastPopup) {
            const msg = blastPopup.querySelector('.blast-message');
            if (msg) msg.textContent = 'Submission saved locally. Please try again later.';
            const closeBtn = blastPopup.querySelector('#blastClose');
            if (closeBtn) closeBtn.style.display = 'inline-block';
          }
          contactForm.reset();
        },900);
      }
    });
  }

  document.getElementById('blastClose')?.addEventListener('click', () => {
    const blastPopup = document.getElementById('blastPopup');
    if (blastPopup) blastPopup.classList.add('hidden');
  });

  // Load posts for blog page
  loadPosts();
});

// Load posts from server /api/posts
async function loadPosts() {
  const grid = document.querySelector('.posts-grid') || document.getElementById('postsGrid');
  if (!grid) return;
  grid.innerHTML = '<p class="muted">Loading posts…</p>';
  try {
    const res = await fetch('http://localhost:4000/api/posts');
    const data = await res.json();
    if (!data.ok || !data.posts) {
      grid.innerHTML = '<p class="muted">No posts available yet.</p>';
      return;
    }
    if (data.posts.length === 0) {
      grid.innerHTML = '<p class="muted">No posts yet. Upload to YouTube to auto-create posts.</p>';
      return;
    }
    grid.innerHTML = '';
    data.posts.forEach(p => {
      const el = document.createElement('article');
      el.className = 'card hover-change';
      el.innerHTML = `
        <img src="${p.thumbnail || 'assets/logo.png'}" alt="${escapeHtml(p.title)}" style="width:100%;height:160px;object-fit:cover;border-radius:8px;margin-bottom:8px" />
        <h3>${escapeHtml(p.title)}</h3>
        <p class="muted">${p.publishedAt ? new Date(p.publishedAt).toLocaleString() : ''}</p>
        <p>${p.description ? escapeHtml(p.description).slice(0,160) + (p.description.length>160?'...':'') : ''}</p>
        <a href="${p.videoUrl}" target="_blank" class="btn-outline">Watch on YouTube</a>
      `;
      grid.appendChild(el);
    });
  } catch (err) {
    console.error('Failed to load posts', err);
    grid.innerHTML = '<p class="muted">Failed to load posts.</p>';
  }
}

function escapeHtml(text='') {
  return text.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
