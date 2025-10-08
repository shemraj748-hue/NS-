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

  // Contact form handler with blast popup and loading state (Formspree)
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;
      }

      const formData = {
        name: contactForm.name.value.trim(),
        email: contactForm.email.value.trim(),
        message: contactForm.message.value.trim()
      };

      const blastPopup = document.getElementById('blastPopup');
      if (blastPopup) blastPopup.classList.remove('hidden');

      try {
        const resp = await fetch('https://formspree.io/f/manpddpq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (resp.ok) {
          setTimeout(() => {
            if (blastPopup) {
              const msg = blastPopup.querySelector('.blast-message');
              if (msg) msg.textContent = '✅ Your form has been submitted. We will contact you soon!';
              const closeBtn = blastPopup.querySelector('#blastClose');
              if (closeBtn) closeBtn.style.display = 'inline-block';
            }
            contactForm.reset();
          }, 900);
        } else {
          throw new Error('Form submission failed');
        }

      } catch (err) {
        console.error('Form submission failed:', err);
        setTimeout(() => {
          if (blastPopup) {
            const msg = blastPopup.querySelector('.blast-message');
            if (msg) msg.textContent = '⚠️ Submission could not be sent. Please try again later.';
            const closeBtn = blastPopup.querySelector('#blastClose');
            if (closeBtn) closeBtn.style.display = 'inline-block';
          }
        }, 900);
      } finally {
        if (submitBtn) {
          submitBtn.textContent = originalBtnText || 'Submit';
          submitBtn.disabled = false;
        }
      }
    });
  }

  // Close blast popup
  document.getElementById('blastClose')?.addEventListener('click', () => {
    const blastPopup = document.getElementById('blastPopup');
    if (blastPopup) blastPopup.classList.add('hidden');
  });

  // Load posts for blog page
  loadPosts();
});

// Load posts from backend
async function loadPosts() {
  const grid =
    document.querySelector('.posts-grid') || document.getElementById('postsGrid');
  if (!grid) return;

  grid.innerHTML = '<p class="muted">Loading posts…</p>';

  try {
    const res = await fetch('https://ns-kc6b.onrender.com/api/posts');
    const data = await res.json();

    if (!data.ok || !data.posts || data.posts.length === 0) {
      grid.innerHTML = '<p class="muted">No posts yet. Upload to YouTube to auto-create posts.</p>';
      return;
    }

    grid.innerHTML = '';
    data.posts.forEach((p) => {
      const el = document.createElement('article');
      el.className = 'card hover-change';
      el.innerHTML = `
        <img src="${p.thumbnail || 'assets/logo.png'}" 
             alt="${escapeHtml(p.title)}" 
             style="width:100%;height:160px;object-fit:cover;
                    border-radius:8px;margin-bottom:8px" />
        <h3>${escapeHtml(p.title)}</h3>
        <p class="muted">${
          p.publishedAt ? new Date(p.publishedAt).toLocaleString() : ''
        }</p>
        <p>${
          p.description
            ? escapeHtml(p.description).slice(0, 160) +
              (p.description.length > 160 ? '...' : '')
            : ''
        }</p>
        <a href="${p.videoUrl}" target="_blank" class="btn-outline">Watch on YouTube</a>
      `;
      grid.appendChild(el);
    });
  } catch (err) {
    console.error('Failed to load posts', err);
    grid.innerHTML = '<p class="muted">Failed to load posts.</p>';
  }
}

// Escape HTML safely
function escapeHtml(text = '') {
  return text.replace(/[&<>"']/g, (m) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}
