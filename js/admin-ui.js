/* =========================================================
   캐치캐치 admin-ui.js — 관리자 페이지 공용 UI 헬퍼
   ---------------------------------------------------------
   - AdminUI.escape(s)         : XSS 방지용 HTML 이스케이프
   - AdminUI.num(n) / won(n)   : 숫자 · 금액 포맷
   - AdminUI.confirm({...})    : 확인 모달 → Promise<boolean>
   - AdminUI.form({...})       : 입력 모달 → Promise<객체|null>
   - AdminUI.toast(msg)        : 하단 알림
   ※ 실제 처리 로직은 각 페이지에서 API 연동 시 채웁니다(현재는 화면 미리보기).
   ========================================================= */
(function (global) {
  "use strict";

  const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => MAP[c]);

  function fieldHtml(f) {
    const label = `<label>${escape(f.label)}</label>`;
    if (f.type === "select") {
      const opts = f.options
        .map((o) => `<option value="${escape(o.value)}"${o.value === f.value ? " selected" : ""}>${escape(o.label)}</option>`)
        .join("");
      return `<div class="field">${label}<select name="${escape(f.name)}">${opts}</select></div>`;
    }
    if (f.type === "textarea") {
      return `<div class="field">${label}<textarea name="${escape(f.name)}" placeholder="${escape(f.placeholder || "")}">${escape(f.value || "")}</textarea></div>`;
    }
    return `<div class="field">${label}<input name="${escape(f.name)}" type="${escape(f.type || "text")}" value="${escape(f.value ?? "")}" placeholder="${escape(f.placeholder || "")}"></div>`;
  }

  const AdminUI = {
    createListController({ pager, render, pageSize = 5 }) {
      let items = [];
      let currentPage = 1;

      function drawPager(totalPages) {
        if (!pager) return;
        pager.hidden = totalPages <= 1;
        if (pager.hidden) {
          pager.innerHTML = "";
          return;
        }

        const pageButtons = Array.from({ length: totalPages }, (_, index) => {
          const page = index + 1;
          const current = page === currentPage;
          return `<button type="button" class="${current ? "on" : ""}" data-page="${page}"${current ? ' aria-current="page"' : ""}>${page}</button>`;
        }).join("");

        pager.innerHTML = `
          <button type="button" data-page="prev" aria-label="이전 페이지"${currentPage === 1 ? " disabled" : ""}>‹</button>
          ${pageButtons}
          <button type="button" data-page="next" aria-label="다음 페이지"${currentPage === totalPages ? " disabled" : ""}>›</button>`;
      }

      function draw() {
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
        currentPage = Math.min(currentPage, totalPages);
        const start = (currentPage - 1) * pageSize;
        render(items.slice(start, start + pageSize), items.length);
        drawPager(totalPages);
      }

      pager?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-page]");
        if (!button || button.disabled) return;
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
        const target = button.dataset.page;
        const nextPage = target === "prev" ? currentPage - 1 : target === "next" ? currentPage + 1 : Number(target);
        if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
        currentPage = nextPage;
        draw();
      });

      return {
        setItems(nextItems) {
          items = Array.isArray(nextItems) ? nextItems : [];
          currentPage = 1;
          draw();
        },
        refresh() { draw(); },
      };
    },
    escape,
    num: (n) => Number(n).toLocaleString("ko-KR"),
    won: (n) => Number(n).toLocaleString("ko-KR") + "원",

    // 확인 모달 → Promise<boolean>
    confirm(opts = {}) {
      return new Promise((resolve) => {
        const bd = document.createElement("div");
        bd.className = "modal-backdrop open";
        bd.innerHTML = `<div class="modal">
          <h3>${escape(opts.title || "확인")}</h3>
          <p>${escape(opts.message || "")}</p>
          <div class="modal-actions">
            <button type="button" class="btn" data-cancel>취소</button>
            <button type="button" class="btn ${opts.danger ? "danger" : "primary"}" data-ok>${escape(opts.okText || "확인")}</button>
          </div>
        </div>`;
        document.body.appendChild(bd);
        const done = (v) => { bd.remove(); resolve(v); };
        bd.querySelector("[data-ok]").addEventListener("click", () => done(true));
        bd.querySelector("[data-cancel]").addEventListener("click", () => done(false));
        bd.addEventListener("click", (e) => { if (e.target === bd) done(false); });
      });
    },

    // 입력 모달 → Promise<객체|null>  (fields: [{name,label,type,value,options,placeholder}])
    form(opts = {}) {
      return new Promise((resolve) => {
        const bd = document.createElement("div");
        bd.className = "modal-backdrop open";
        bd.innerHTML = `<div class="modal">
          <h3>${escape(opts.title || "")}</h3>
          ${opts.message ? `<p>${escape(opts.message)}</p>` : ""}
          <form>
            ${(opts.fields || []).map(fieldHtml).join("")}
            <div class="modal-actions">
              <button type="button" class="btn" data-cancel>취소</button>
              <button type="submit" class="btn primary">${escape(opts.okText || "저장")}</button>
            </div>
          </form>
        </div>`;
        document.body.appendChild(bd);
        const form = bd.querySelector("form");
        const done = (v) => { bd.remove(); resolve(v); };
        bd.querySelector("[data-cancel]").addEventListener("click", () => done(null));
        bd.addEventListener("click", (e) => { if (e.target === bd) done(null); });
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const out = {};
          new FormData(form).forEach((v, k) => { out[k] = v; });
          done(out);
        });
      });
    },

    // 하단 토스트 알림
    toast(msg) {
      const t = document.createElement("div");
      t.textContent = msg;
      t.style.cssText =
        "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#151515;color:#fff;" +
        "padding:11px 18px;border-radius:6px;font-size:13px;font-weight:600;z-index:60;" +
        "box-shadow:0 6px 20px rgba(0,0,0,.25);opacity:0;transition:opacity .2s;";
      document.body.appendChild(t);
      requestAnimationFrame(() => (t.style.opacity = "1"));
      setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 250); }, 1800);
    },
  };

  global.AdminUI = AdminUI;
})(window);
