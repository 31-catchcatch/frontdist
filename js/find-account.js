document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector) => document.querySelector(selector);

  const API_BASE = (
    window.CATCHCATCH_API_BASE_URL || "/api/v1"
  ).replace(/\/$/, "");

  const tabButtons = [...document.querySelectorAll("[data-tab]")];
  const panels = [...document.querySelectorAll("[data-panel]")];

  const findIdForm = $("#findIdForm");
  const findPwForm = $("#findPwForm");

  const idResult = $('[data-role="id-result"]');
  const idValue = $('[data-role="id-value"]');
  const idMessage = $('[data-role="id-message"]');
  const idSubmit = $('[data-role="id-submit"]');

  const pwResult = $('[data-role="pw-result"]');
  const pwResultMessage = $('[data-role="pw-result-message"]');
  const pwMessage = $('[data-role="pw-message"]');
  const pwSubmit = $('[data-role="pw-submit"]');

  function showTab(tab) {
    tabButtons.forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.tab === tab
      );
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab;
    });
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showTab(button.dataset.tab);
    });
  });

  const goPwButton = $('[data-action="go-pw"]');
  if (goPwButton) {
    goPwButton.addEventListener("click", () => showTab("pw"));
  }

  function getFindAccountUrl() {
    return `${API_BASE}/auth/user/find-account`;
  }

  function setMessage(element, text = "", type = "") {
    if (!element) return;

    element.textContent = text;
    element.className = "form-message";

    if (type) {
      element.classList.add(type);
    }
  }

  function setLoading(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "처리 중..." : originalText;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function requestFindAccount(payload) {
    const response = await fetch(getFindAccountUrl(), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    let result = {};

    try {
      result = await response.json();
    } catch (_) {
      result = {};
    }

    if (!response.ok) {
      const message =
        result.message ||
        result.error ||
        result.data?.message ||
        `요청 처리에 실패했습니다. (${response.status})`;

      throw new Error(message);
    }

    return result.data ?? result;
  }

  findIdForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = $("#idName").value.trim();
    const email = $("#idEmail").value.trim();

    setMessage(idMessage);

    if (!name) {
      setMessage(idMessage, "이름을 입력해 주세요.", "error");
      $("#idName").focus();
      return;
    }

    if (!email) {
      setMessage(idMessage, "이메일을 입력해 주세요.", "error");
      $("#idEmail").focus();
      return;
    }

    if (!isValidEmail(email)) {
      setMessage(
        idMessage,
        "이메일 형식을 확인해 주세요.",
        "error"
      );
      $("#idEmail").focus();
      return;
    }

    setLoading(idSubmit, true, "아이디 찾기");

    try {
      const data = await requestFindAccount({
        type: "ID",
        name,
        username: null,
        email
      });

      const maskedUsername =
        data.maskedUsername ??
        data.username ??
        data.maskedId;

      if (!maskedUsername) {
        throw new Error(
          data.message ||
          "아이디 조회 결과를 확인하지 못했습니다."
        );
      }

      idValue.textContent = maskedUsername;
      findIdForm.hidden = true;
      idResult.hidden = false;
    } catch (error) {
      console.error("아이디 찾기 실패:", error);
      setMessage(idMessage, error.message, "error");
    } finally {
      setLoading(idSubmit, false, "아이디 찾기");
    }
  });

  const resetPwForm = $("#resetPwForm");
  const pwAccountSummary = $('[data-role="pw-account-summary"]');
  const pw2Message = $('[data-role="pw2-message"]');
  const pw2Submit = $('[data-role="pw2-submit"]');
  const pwBackButton = $('[data-action="pw-back"]');

  // 1단계에서 확인이 끝난 계정. 2단계 요청에 그대로 쓴다.
  let verifiedAccount = null;

  function showPwStep(step) {
    const onPassword = step === "password";
    findPwForm.hidden = onPassword;
    resetPwForm.hidden = !onPassword;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function verifyAccount(username, email) {
    const response = await fetch(`${API_BASE}/auth/verify-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, email })
    });

    let result = {};
    try {
      result = await response.json();
    } catch (_) {
      result = {};
    }

    if (!response.ok) {
      throw new Error(result.message || "존재하지 않는 사용자입니다.");
    }
  }

  pwBackButton.addEventListener("click", () => {
    setMessage(pw2Message);
    $("#pwNew").value = "";
    $("#pwNewConfirm").value = "";
    verifiedAccount = null;
    showPwStep("account");
    $("#pwUsername").focus();
  });

  // --- 1단계 : 계정 확인 ---
  findPwForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = $("#pwUsername").value.trim();
    const email = $("#pwEmail").value.trim();

    setMessage(pwMessage);

    if (!username) {
      setMessage(pwMessage, "아이디를 입력해 주세요.", "error");
      $("#pwUsername").focus();
      return;
    }

    if (!email) {
      setMessage(pwMessage, "이메일을 입력해 주세요.", "error");
      $("#pwEmail").focus();
      return;
    }

    if (!isValidEmail(email)) {
      setMessage(pwMessage, "이메일 형식을 확인해 주세요.", "error");
      $("#pwEmail").focus();
      return;
    }

    setLoading(pwSubmit, true, "비밀번호 재설정");

    try {
      await verifyAccount(username, email);

      verifiedAccount = { username, email };
      pwAccountSummary.textContent = `${username} (${email}) 계정의 새 비밀번호를 설정합니다.`;
      setMessage(pw2Message);
      $("#pwNew").value = "";
      $("#pwNewConfirm").value = "";

      showPwStep("password");
      $("#pwNew").focus();
    } catch (error) {
      console.error("계정 확인 실패:", error);
      setMessage(pwMessage, error.message, "error");
    } finally {
      setLoading(pwSubmit, false, "비밀번호 재설정");
    }
  });

  // --- 2단계 : 새 비밀번호 설정 ---
  resetPwForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!verifiedAccount) {
      showPwStep("account");
      setMessage(pwMessage, "계정 확인을 먼저 진행해 주세요.", "error");
      return;
    }

    const newPassword = $("#pwNew").value;
    const confirmPassword = $("#pwNewConfirm").value;

    setMessage(pw2Message);

    if (newPassword.length < 8) {
      setMessage(pw2Message, "새 비밀번호는 8자 이상이어야 합니다.", "error");
      $("#pwNew").focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(pw2Message, "새 비밀번호가 서로 일치하지 않습니다.", "error");
      $("#pwNewConfirm").focus();
      return;
    }

    setLoading(pw2Submit, true, "비밀번호 변경");

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          username: verifiedAccount.username,
          email: verifiedAccount.email,
          newPassword
        })
      });

      let result = {};
      try {
        result = await response.json();
      } catch (_) {
        result = {};
      }

      if (!response.ok) {
        // 확인 이후 계정이 사라진 경우 등. 1단계로 되돌려 다시 입력하게 한다.
        if (response.status === 404) {
          verifiedAccount = null;
          showPwStep("account");
          setMessage(pwMessage, result.message || "존재하지 않는 사용자입니다.", "error");
          return;
        }
        throw new Error(result.message || `비밀번호 변경에 실패했습니다. (${response.status})`);
      }

      pwResultMessage.textContent =
        result.message || "새 비밀번호로 변경되었습니다. 다시 로그인해 주세요.";
      verifiedAccount = null;
      resetPwForm.hidden = true;
      pwResult.hidden = false;
    } catch (error) {
      console.error("비밀번호 재설정 실패:", error);
      setMessage(pw2Message, error.message, "error");
    } finally {
      setLoading(pw2Submit, false, "비밀번호 변경");
    }
  });

  const requestedTab = new URLSearchParams(
    location.search
  ).get("tab");

  if (requestedTab === "pw") {
    showTab("pw");
  }
});
