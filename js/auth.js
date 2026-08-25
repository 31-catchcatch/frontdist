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

  global.CATCHCATCH_API_BASE_URL = global.CATCHCATCH_API_BASE_URL || "/api/v1";

  if (!global.CatchHttp) {
    console.error("[auth] 초기화 실패 (E-INIT-01)");
  }

  const KEY_FLAG = "catchcatch.loggedIn";
  const KEY_TYPE = "catchcatch.loginType";

  const LEGACY_TOKEN_KEYS = ["catchcatch.accessToken", "catchcatch.refreshToken"];

  const KEY_ADMIN_FLAG = "catchcatch.adminLoggedIn";

  function readStored(key) {
    let v = null;
    try { v = localStorage.getItem(key); } catch (_) {  }
    if (v) return v;
    try { v = sessionStorage.getItem(key); } catch (_) {  }
    return v;
  }

  function writeStored(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {  }
  }

  function removeStored(key) {
    try { localStorage.removeItem(key); } catch (_) {  }
    try { sessionStorage.removeItem(key); } catch (_) {  }
  }

  LEGACY_TOKEN_KEYS.forEach(removeStored);

  let meValue = null;
  let meLoaded = false;
  let mePromise = null;

  function resetMe() {
    meValue = null;
    meLoaded = false;
    mePromise = null;
  }

  const CatchAuth = {
    isLoggedIn() {
      return readStored(KEY_FLAG) === "true";
    },

    loginType() {
      return readStored(KEY_TYPE);
    },

    async me() {
      if (meLoaded) return meValue;
      if (!this.isLoggedIn()) {
        meLoaded = true;
        meValue = null;
        return null;
      }
      if (!mePromise) {
        const base = global.CATCHCATCH_API_BASE_URL || "/api/v1";
        mePromise = fetch(base + "/users/me")
          .then(r => r.ok ? r.json() : null)
          .then(j => (j && j.data) ? j.data : null)
          .catch(() => null)
          .then(v => {
            meValue = v;
            meLoaded = true;
            mePromise = null;
            return v;
          });
      }
      return mePromise;
    },

    async requireRole(role) {
      const me = await this.me();
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

    startSession(loginType) {
      writeStored(KEY_FLAG, "true");
      if (loginType) writeStored(KEY_TYPE, loginType);
      resetMe();
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


    clearSession() {
      removeStored(KEY_FLAG);
      removeStored(KEY_TYPE);
      removeStored(KEY_ADMIN_FLAG);
      LEGACY_TOKEN_KEYS.forEach(removeStored);
      resetMe();
    },

    async logout() {
      if (this.isLoggedIn()) {
        try {
          await fetch(global.CATCHCATCH_API_BASE_URL + "/auth/user/logout", {
            method: "POST",
            skipAuthRetry: true,
          });
        } catch (_) {  }
      }
      this.clearSession();
      location.href = "index.html";
    },
  };


  document.addEventListener("DOMContentLoaded", async () => {
    const me = await CatchAuth.me();
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


    if (loggedIn) document.body.classList.add("is-member");


    document.querySelectorAll("[data-auth-guest]").forEach((el) => {
      el.hidden = loggedIn;
    });
    document.querySelectorAll("[data-auth-member]").forEach((el) => {
      el.hidden = !loggedIn;
    });


    const isSeller = !!me && me.role === "SELLER";
    document.querySelectorAll("[data-seller-only]").forEach((el) => {
      el.hidden = !isSeller;
    });


    document.querySelectorAll("[data-logout]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        CatchAuth.logout();
      });
    });
  });

  global.CatchAuth = CatchAuth;
})(window);
