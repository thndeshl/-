document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(signupForm);
      const payload = Object.fromEntries(formData.entries());
      const errorMsg = document.getElementById("error-msg");
      errorMsg.textContent = "";

      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          window.location.href = "/login";
        } else {
          const err = await res.json();
          errorMsg.textContent = err.detail || "회원가입에 실패했습니다.";
        }
      } catch {
        errorMsg.textContent = "서버 통신 중 오류가 발생했습니다.";
      }
    });
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const payload = Object.fromEntries(formData.entries());
      const errorMsg = document.getElementById("error-msg");
      errorMsg.textContent = "";

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          window.location.href = "/dashboard";
        } else {
          const err = await res.json();
          errorMsg.textContent = err.detail || "이메일 또는 비밀번호가 올바르지 않습니다.";
        }
      } catch {
        errorMsg.textContent = "서버 통신 중 오류가 발생했습니다.";
      }
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      } catch (err) {
        console.error("로그아웃 오류:", err);
      }
    });
  }
});