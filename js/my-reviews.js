/* ============================================================
 * 내 리뷰 (my-reviews) — 실제 백엔드 연동 버전
 * ------------------------------------------------------------
 * 기존 파일은 더미(하드코딩) 데이터를 뿌리고 있어서 DB에 리뷰를
 * 추가/수정/삭제해도 화면에 반영되지 않았습니다.
 * 이 파일은 orders.html(리더 완성본)과 동일한 규칙으로 실제 API를 호출합니다.
 *
 *  - 목록 조회 : GET    /api/v1/users/me/reviews?page=&size=
 *  - 리뷰 수정 : PUT    /api/v1/reviews/{reviewId}
 *  - 리뷰 삭제 : DELETE /api/v1/reviews/{reviewId}
 *
 * ※ API_BASE / getAccessToken() 은 auth.js 표준 방식(localStorage 'accessToken'
 *   + Authorization: Bearer)을 가정했습니다. auth.js가 다른 방식이면 이 두 곳만 고치면 됩니다.
 * ============================================================ */
(function () {
  'use strict';

  // Live Server(예: 5500)와 스프링부트(8080) 포트가 다르므로 절대 주소로 지정.
  // 배포 시엔 실제 도메인으로 바꾸면 됩니다.
  const API_BASE = 'http://localhost:8080/api/v1';
  const PAGE_SIZE = 20;

  function getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  function authHeaders() {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      location.href = 'login.html';
      throw new Error('로그인이 필요합니다.');
    }

    // 204(No Content) 등 바디가 없을 수 있음
    let body = null;
    const text = await res.text();
    if (text) {
      try { body = JSON.parse(text); } catch (_) { body = null; }
    }

    if (!res.ok || (body && body.success === false)) {
      throw new Error((body && body.message) || '요청 처리 중 오류가 발생했습니다.');
    }
    return body ? body.data : null;
  }

  /* ---------- DOM refs ---------- */
  const listEl = document.querySelector('[data-role="review-list"]');
  const emptyEl = document.querySelector('[data-role="review-empty"]');
  const totalEl = document.querySelector('[data-role="total"]');
  const dialog = document.getElementById('reviewEditDialog');
  const toastEl = document.getElementById('toast');

  if (!listEl) return; // my-reviews.html이 아니면 종료

  /* ---------- state ---------- */
  let page = 0;
  let last = true;
  let totalElements = 0;
  let loading = false;
  let editingId = null;
  let editingRating = 5;

  const numberFmt = new Intl.NumberFormat('ko-KR');

  /* ---------- helpers ---------- */
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(dateTimeStr) {
    if (!dateTimeStr) return '';
    return String(dateTimeStr).slice(0, 10).replaceAll('-', '.');
  }

  function stars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  }

  function showToast(msg) {
    if (!toastEl) { alert(msg); return; }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* ---------- render ---------- */
  function reviewItemHtml(review) {
    const thumb = review.productThumbnailUrl
      ? `<img src="${escapeHtml(review.productThumbnailUrl)}" alt="${escapeHtml(review.productName)}" loading="lazy">`
      : '<span class="myr-noimg" aria-hidden="true"></span>';

    const photo = review.imageUrl
      ? `<div class="myr-photo"><img src="${escapeHtml(review.imageUrl)}" alt="첨부 사진" loading="lazy"></div>`
      : '';

    return `
      <li class="myr-item" data-review-id="${review.reviewId}">
        <a class="myr-thumb" href="product-detail.html?id=${review.productId}" aria-label="${escapeHtml(review.productName)} 상세보기">${thumb}</a>
        <div class="myr-body">
          <div class="myr-top">
            <a class="myr-name" href="product-detail.html?id=${review.productId}">${escapeHtml(review.productName)}</a>
            <div class="myr-actions">
              <button type="button" class="myr-btn" data-action="edit" data-review-id="${review.reviewId}">수정</button>
              <button type="button" class="myr-btn myr-btn-danger" data-action="delete" data-review-id="${review.reviewId}">삭제</button>
            </div>
          </div>
          <div class="myr-meta">
            <span class="myr-stars" aria-label="별점 ${review.rating}점">${stars(review.rating)}</span>
            <span class="myr-date">${formatDate(review.createdAt)}</span>
          </div>
          <p class="myr-content">${escapeHtml(review.content)}</p>
          ${photo}
        </div>
      </li>`;
  }

  function render(reviews, { append } = { append: false }) {
    if (totalEl) totalEl.textContent = numberFmt.format(totalElements);

    if (!append) listEl.innerHTML = '';

    if (totalElements === 0) {
      listEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      removeMoreBtn();
      return;
    }

    listEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    listEl.insertAdjacentHTML('beforeend', reviews.map(reviewItemHtml).join(''));
    renderMoreBtn();
  }

  /* ---------- 더보기 버튼 ---------- */
  function removeMoreBtn() {
    const btn = document.getElementById('myrMoreBtn');
    if (btn) btn.remove();
  }

  function renderMoreBtn() {
    removeMoreBtn();
    if (last) return;
    const btn = document.createElement('button');
    btn.id = 'myrMoreBtn';
    btn.type = 'button';
    btn.className = 'myr-more';
    btn.textContent = '더보기';
    btn.addEventListener('click', () => loadReviews({ append: true }));
    listEl.insertAdjacentElement('afterend', btn);
  }

  /* ---------- 목록 로드 ---------- */
  async function loadReviews({ append } = { append: false }) {
    if (loading) return;
    loading = true;
    const nextPage = append ? page + 1 : 0;

    try {
      const data = await apiFetch(`/users/me/reviews?page=${nextPage}&size=${PAGE_SIZE}`);
      // PageResponse: { content, page, size, totalElements, totalPages, last }
      page = data.page;
      last = data.last;
      totalElements = data.totalElements;
      render(data.content || [], { append });
    } catch (err) {
      showToast(err.message);
      if (!append && totalElements === 0) {
        listEl.hidden = true;
        if (emptyEl) emptyEl.hidden = false;
      }
    } finally {
      loading = false;
    }
  }

  /* ---------- 삭제 ---------- */
  async function handleDelete(reviewId) {
    if (!confirm('이 리뷰를 삭제하시겠어요?')) return;
    try {
      await apiFetch(`/reviews/${reviewId}`, { method: 'DELETE' });
      showToast('리뷰가 삭제되었습니다.');
      await loadReviews({ append: false });
    } catch (err) {
      showToast(err.message);
    }
  }

  /* ---------- 수정 (dialog) ---------- */
  function setDialogStars(rating) {
    editingRating = Math.max(1, Math.min(5, Number(rating) || 1));
    if (!dialog) return;
    dialog.querySelectorAll('[data-star]').forEach((btn) => {
      const v = Number(btn.dataset.star);
      btn.classList.toggle('on', v <= editingRating);
      btn.textContent = v <= editingRating ? '★' : '☆';
    });
    const out = dialog.querySelector('[data-role="edit-rating-out"]');
    if (out) out.textContent = `${editingRating}점`;
  }

  function openEdit(reviewId) {
    if (!dialog) return;
    const li = listEl.querySelector(`.myr-item[data-review-id="${reviewId}"]`);
    if (!li) return;

    editingId = reviewId;
    const currentRating = (li.querySelector('.myr-stars')?.textContent || '').split('☆')[0].length || 5;
    const currentContent = li.querySelector('.myr-content')?.textContent || '';

    dialog.querySelector('[data-role="edit-content"]').value = currentContent;
    setDialogStars(currentRating);

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeEdit() {
    if (!dialog) return;
    editingId = null;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  async function submitEdit() {
    if (editingId == null) return;
    const content = (dialog.querySelector('[data-role="edit-content"]').value || '').trim();
    if (!content) { showToast('리뷰 내용을 입력해주세요.'); return; }

    try {
      await apiFetch(`/reviews/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ rating: editingRating, content, imageUrl: null }),
      });
      showToast('리뷰가 수정되었습니다.');
      closeEdit();
      await loadReviews({ append: false });
    } catch (err) {
      showToast(err.message);
    }
  }

  /* ---------- 이벤트 위임 ---------- */
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.reviewId;
    if (btn.dataset.action === 'edit') openEdit(id);
    if (btn.dataset.action === 'delete') handleDelete(id);
  });

  if (dialog) {
    dialog.addEventListener('click', (e) => {
      const star = e.target.closest('[data-star]');
      if (star) { setDialogStars(star.dataset.star); return; }
      if (e.target.closest('[data-role="edit-save"]')) { submitEdit(); return; }
      if (e.target.closest('[data-role="edit-cancel"]')) { closeEdit(); }
    });
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeEdit(); });
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', () => loadReviews({ append: false }));
  // DOMContentLoaded가 이미 지난 경우 대비
  if (document.readyState !== 'loading') loadReviews({ append: false });
})();
