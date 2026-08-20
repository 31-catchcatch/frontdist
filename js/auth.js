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

  // [5-1 조치] 배포본에 개발 환경 주소(localhost:8080)를 남기지 않는다.
  //            로컬 개발은 이 스크립트보다 먼저 window.CATCHCATCH_API_BASE_URL 을 주입할 것.
  global.CATCHCATCH_API_BASE_URL = global.CATCHCATCH_API_BASE_URL || "/api/v1";

  const KEY_FLAG = "catchcatch.loggedIn";
  const KEY_TYPE = "catchcatch.loginType";
  const KEY_TOKEN = "catchcatch.accessToken";
  const KEY_REFRESH = "catchcatch.refreshToken";   // 저장하지 않는다. 과거 저장분 정리에만 쓴다.

  // [4-1 조치] 프론트는 재발급(/auth/refresh)을 호출하지 않아 refreshToken 을 보관할 이유가 없다.
  //            저장을 멈추는 것만으로는 이미 저장된 값이 남으므로 로드 시 1회 정리한다.
  try { localStorage.removeItem(KEY_REFRESH); } catch (_) { /* 스토리지 차단 환경 */ }

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
      // [4-1 조치] refreshToken 은 저장하지 않는다 (사용처 없는 자격증명 보관 금지).
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

    /** [5-1 조치] 화면 이동 없이 로그인 상태만 정리한다. 각 화면의 clearLoginState() 가 이걸 쓴다. */
    clearSession() {
      sessionStorage.removeItem(KEY_FLAG);
      sessionStorage.removeItem(KEY_TYPE);
      sessionStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_REFRESH);
    },

    /**
     * [4-2 조치] 서버에 로그아웃을 알린 뒤 로컬 상태를 정리한다.
     *
     * 종전에는 스토리지만 비워서, 서버는 그 토큰을 남은 유효기간 동안 계속 유효로 봤다.
     * 서버 호출이 실패해도(오프라인·서버 오류) 로컬 정리와 화면 이동은 그대로 진행한다.
     */
    async logout() {
      const token = readToken();
      if (token) {
        try {
          await originalFetch(global.CATCHCATCH_API_BASE_URL + "/auth/user/logout", {
            method: "POST",
            headers: { Authorization: "Bearer " + token },
          });
        } catch (_) { /* 통신 실패해도 로컬 정리는 진행 */ }
      }
      this.clearSession();
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
