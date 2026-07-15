document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("couponRequestForm");
  const message = document.getElementById("couponMessage");
  const pendingCount = document.getElementById("pendingCouponCount");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const requiredFields = ["couponName", "discount", "minPrice", "quantity", "startDate", "endDate", "reason"];
    const missingField = requiredFields.map((id) => document.getElementById(id)).find((field) => !field.value.trim());

    if (missingField) {
      message.textContent = "쿠폰 발행에 필요한 항목을 모두 입력해주세요.";
      missingField.focus();
      return;
    }

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    if (startDate > endDate) {
      message.textContent = "사용 시작일은 종료일보다 늦을 수 없습니다.";
      document.getElementById("endDate").focus();
      return;
    }

    const currentCount = Number.parseInt(pendingCount.textContent, 10) || 0;
    pendingCount.textContent = `${currentCount + 1}건`;
    message.textContent = "쿠폰 발행 승인 요청이 등록되었습니다. 승인 대기 건수에 반영했습니다.";
    form.reset();
  });
});
