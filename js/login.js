(() => {
  const apiMap = {
    user: "/api/v1/auth/user/login",
    seller: "/api/v1/auth/seller/login"
  };

  const tabs = document.querySelectorAll(".login-tab");
  const loginType = document.getElementById("loginType");
  const loginNotice = document.getElementById("loginNotice");
  const signupText = document.getElementById("signupText");
  const signupLink = document.getElementById("signupLink");
  const findAccountLink = document.getElementById("findAccountLink");
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const usernameError = document.getElementById("usernameError");
  const passwordError = document.getElementById("passwordError");
  const loginMessage = document.getElementById("loginMessage");
  const passwordToggle = document.getElementById("passwordToggle");

  function setType(type) {
    loginType.value = type;
    tabs.forEach(tab => tab.classList.toggle("on", tab.dataset.type === type));

    if (type === "seller") {
      loginNotice.textContent = "판매자 계정으로 로그인합니다.";
      signupText.textContent = "아직 캐치캐치 판매자가 아니신가요?";
      signupLink.href = "seller-signup.html";
      findAccountLink.href = "find-account.html?type=seller";
    } else {
      loginNotice.textContent = "일반 사용자 계정으로 로그인합니다.";
      signupText.textContent = "아직 캐치캐치 회원이 아니신가요?";
      signupLink.href = "signup.html";
      findAccountLink.href = "find-account.html?type=user";
    }

    usernameError.textContent = "";
    passwordError.textContent = "";
    loginMessage.classList.remove("show");
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => setType(tab.dataset.type));
  });

  passwordToggle.addEventListener("click", () => {
    const visible = password.type === "text";
    password.type = visible ? "password" : "text";
    passwordToggle.textContent = visible ? "보기" : "숨기기";
  });

  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    usernameError.textContent = "";
    passwordError.textContent = "";
    loginMessage.classList.remove("show");

    if (!username.value.trim()) usernameError.textContent = "아이디를 입력해 주세요.";
    if (!password.value) passwordError.textContent = "비밀번호를 입력해 주세요.";
    if (!username.value.trim() || !password.value) return;

    try {
      const response = await fetch(apiMap[loginType.value], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.value.trim(),
          password: password.value
        })
      });

      if (!response.ok) {
        let message = "아이디 또는 비밀번호를 확인해 주세요.";
        try {
          const data = await response.json();
          message = data.message || message;
        } catch (_) {}
        throw new Error(message);
      }

      // 로그인 성공 상태 저장
      sessionStorage.setItem("catchcatch.loggedIn", "true");
      sessionStorage.setItem("catchcatch.loginType", loginType.value);

      const requestedRedirect =
        new URLSearchParams(location.search).get("redirect");

      location.href = loginType.value === "seller"
        ? "seller-dashboard.html"
        : (requestedRedirect || "index.html");
    } catch (error) {
      loginMessage.textContent =
        error instanceof TypeError
          ? "로그인 서버에 연결할 수 없습니다. WEB/WAS 서버 상태를 확인해 주세요."
          : error.message;
      loginMessage.classList.add("show");
    }
  });

  const queryType = new URLSearchParams(location.search).get("type");
  setType(queryType === "seller" ? "seller" : "user");
})();
