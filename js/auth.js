(function (global) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  
global.esc = esc;

  function SafeUrl(v) {
    try {
      const u = new URL(v, location.href);
      return ["http:", "https:", "data:", "blob:"].includes(u.protocol) ? u.href : "#";
    } catch (_) { return "#"; }
  }
global.SafeUrl = SafeUrl; 

  if (!global.CATCHCATCH_API_BASE_URL) {
    global.CATCHCATCH_API_BASE_URL =
      location.protocol === "file:" || location.port === "5500"
        ? "http://localhost:8080/api/v1"
        : "/api/v1";
  }

  const KEY_FLAG = "catchcatch.loggedIn";
  const KEY_TOKEN = "catchcatch.accessToken";
  const KEY_REFRESH = "catchcatch.refreshToken";

  function readToken() {
    return sessionStorage.getItem(KEY_TOKEN) || localStorage.getItem(KEY_TOKEN);
  }

  const CatchAuth = {
    isLoggedIn() {
      return (
        sessionStorage.getItem(KEY_FLAG) === "true" ||
        Boolean(sessionStorage.getItem(KEY_TOKEN)) ||
        Boolean(localStorage.getItem(KEY_TOKEN))
      );
    },

    getToken() {
      return readToken();
    },

    async requireRole(role) {
      const token = this.getToken();
      const base = global.CATCHCATCH_API_BASE_URL || "/api/v1";
      const me = token
        ? await fetch(base + "/users/me")
            .then(r => r.ok ? r.json() : null)
            .then(j => (j && j.data) ? j.data : null)
            .catch(() => null)
        : null;
      if (!me) {
        const here = location.pathname.split("/").pop() + location.search;
        location.href = "login.html?redirect=" + encodeURIComponent(here);
        return false;
      }
      if (role && me.role !== role) { location.href = "index.html"; return false; }
      return true;
    },

    safeRedirect(fallback) {
      const v = new URLSearchParams(location.search).get("redirect");
      return v && /^[a-z0-9_-]+\.html(?:\?[^#]*)?$/i.test(v) ? v : (fallback || "index.html");
    },

    saveTokens(data) {
      if (!data) return;
      if (data.accessToken) localStorage.setItem(KEY_TOKEN, data.accessToken);
      if (data.refreshToken) localStorage.setItem(KEY_REFRESH, data.refreshToken);
      sessionStorage.setItem(KEY_FLAG, "true");
    },

    requireLogin() {
      if (!this.isLoggedIn()) {
        const here = location.pathname.split("/").pop() + location.search;
        location.href = "login.html?redirect=" + encodeURIComponent(here);
        return false;
      }
      this.requireRole();
      return true;
    },

    logout() {
      sessionStorage.removeItem(KEY_FLAG);
      sessionStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_REFRESH);
      location.href = "index.html";
    },
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const opts = init ? { ...init } : {};
    let url = "";
    try {
      url = typeof input === "string" ? input : (input && input.url) || "";
    } catch (_) { /* noop */ }

    let isApiCall = false;
    try {
      const abs = new URL(url, location.href);
      const apiBase = new URL(global.CATCHCATCH_API_BASE_URL || "/api/v1", location.href);
      isApiCall = abs.origin === apiBase.origin && abs.pathname.indexOf("/api/v1/") === 0;
    } catch (_) { /* noop */ }
    const token = readToken();

    if (isApiCall && token && typeof input === "string") {
      const headers = new Headers(opts.headers || {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", "Bearer " + token);
        opts.headers = headers;
        return originalFetch(input, opts);
      }
    }
    return originalFetch(input, init);
  };

  // 헤더 공통 처리: 페이지 로드 시 자동 실행
  document.addEventListener("DOMContentLoaded", async () => {
    const base = global.CATCHCATCH_API_BASE_URL || "/api/v1";
    const me = CatchAuth.getToken()
      ? await fetch(base + "/users/me")
          .then(r => r.ok ? r.json() : null)
          .then(j => (j && j.data) ? j.data : null)
          .catch(() => null)
      : null; 
    const loggedIn = !!me;

    const mypageLink = document.getElementById("mypageLink");
    if (mypageLink) {
      mypageLink.addEventListener("click", (e) => {
        if (!loggedIn) {
          e.preventDefault();
          location.href = "login.html?redirect=mypage.html";
        }
      });
    }

    // 상단 로그인/회원가입 ↔ 로그아웃 전환 (CSS가 body 클래스로 처리)
    if (loggedIn) document.body.classList.add("is-member");

    // 상단 유틸리티 메뉴: 비회원은 로그인/회원가입, 회원은 마이페이지/로그아웃을 표시
    document.querySelectorAll("[data-auth-guest]").forEach((el) => {
      el.hidden = loggedIn;
    });
    document.querySelectorAll("[data-auth-member]").forEach((el) => {
      el.hidden = !loggedIn;
    });

    // 판매자로 로그인했을 때만 상단 카테고리에 '판매 관리' 노출
    const isSeller = !!me && me.role === "SELLER";
    document.querySelectorAll("[data-seller-only]").forEach((el) => {
      el.hidden = !isSeller;
    });

    // 로그아웃 버튼(있으면) 연결
    document.querySelectorAll("[data-logout]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        CatchAuth.logout();
      });
    });
  });

  global.CatchAuth = CatchAuth;
})(window);
