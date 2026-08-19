(function (global) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

global.esc = esc;

  function safeUrl(v) {
    try {
      const u = new URL(v, location.href);
      return ["http:", "https:", "data:", "blob:"].includes(u.protocol) ? u.href : "#";
    } catch (_) { return "#"; }
  }

  const KEY_TOKEN = "catchcatch.adminToken";
  const KEY_FLAG = "catchcatch.adminLoggedIn";
  const LOGIN_PAGE = "admin-login.html";

  function currentPage() {
    return location.pathname.split("/").pop() + location.search;
  }

  const AdminAuth = {
    isLoggedIn() {
      return Boolean(sessionStorage.getItem(KEY_TOKEN));
    },

    getToken() {
      return sessionStorage.getItem(KEY_TOKEN);
    },

    setSession(token) {
      if (typeof token !== "string" || !token.trim()) {
        throw new Error("관리자 인증 토큰이 없습니다.");
      }
      sessionStorage.setItem(KEY_TOKEN, token);
      sessionStorage.setItem(KEY_FLAG, "true");
    },

    clearSession() {
      sessionStorage.removeItem(KEY_TOKEN);
      sessionStorage.removeItem(KEY_FLAG);
    },

    requireLogin() {
      if (!this.isLoggedIn()) { location.replace(LOGIN_PAGE + "?redirect=" + encodeURIComponent(currentPage())); return false; }
      fetch((window.CATCHCATCH_API_BASE_URL || "/api/v1") + "/admin/users?page=0&size=1",
            { headers: this.authorizationHeader() })
        .then((r) => { if (r.status === 401 || r.status === 403) { this.clearSession(); location.replace(LOGIN_PAGE); } })
        .catch(() => {});
      return true;
    },

    logout() {
      this.clearSession();
      location.replace(LOGIN_PAGE);
    },

    authorizationHeader() {
      const token = this.getToken();
      return token ? { Authorization: "Bearer " + token } : {};
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-admin-logout]").forEach((element) => {
      element.addEventListener("click", (event) => {
        event.preventDefault();
        AdminAuth.logout();
      });
    });
  });

  global.AdminAuth = AdminAuth;
})(window);
