document.addEventListener("DOMContentLoaded", () => {
  const tabs = [...document.querySelectorAll(".tab-btn")];
  const contents = [...document.querySelectorAll(".tab-content")];

  const currency = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  });

  const activateTab = (tabId) => {
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === tabId);
    });

    contents.forEach((content) => {
      content.classList.toggle("active", content.id === tabId);
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
    });
  });

  const validatePeriod = (start, end, message) => {
    if (!start.value || !end.value) {
      message.textContent =
        "조회 시작일과 종료일을 모두 선택해주세요.";
      return false;
    }

    if (start.value > end.value) {
      message.textContent =
        "조회 시작일은 종료일보다 늦을 수 없습니다.";
      return false;
    }

    message.textContent = "";
    return true;
  };

  const escapeHtml = (value) => {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const renderSalesSummary = (data) => {
    const totalSalesAmount = Number(data.totalSalesAmount ?? 0);
    const orderCount = Number(data.orderCount ?? 0);
    const totalSoldQuantity = Number(data.totalSoldQuantity ?? 0);

    document.getElementById("salesTotal").textContent =
      currency.format(totalSalesAmount);

    document.getElementById("salesOrderCount").textContent =
      `${orderCount.toLocaleString("ko-KR")}건`;

    document.getElementById("salesSoldQuantity").textContent =
      `${totalSoldQuantity.toLocaleString("ko-KR")}개`;
  };

  const renderProductSales = (productSales = []) => {
    const tbody = document.getElementById("salesTableBody");

    if (!tbody) {
      console.error('id="salesTableBody"인 tbody가 없습니다.');
      return;
    }

    if (!Array.isArray(productSales) || productSales.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4">조회된 매출 내역이 없습니다.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = productSales
      .map((item) => {
        const productName = item.productName ?? "-";
        const orderCount = Number(item.orderCount ?? 0);
        const soldQuantity = Number(item.soldQuantity ?? 0);
        const salesAmount = Number(item.salesAmount ?? 0);

        return `
          <tr data-product-id="${item.productId ?? ""}">
            <td>${escapeHtml(productName)}</td>
            <td>${orderCount.toLocaleString("ko-KR")}건</td>
            <td>${soldQuantity.toLocaleString("ko-KR")}개</td>
            <td>${currency.format(salesAmount)}</td>
          </tr>
        `;
      })
      .join("");
  };

  const fetchSales = async (startDate = "", endDate = "") => {
    const startInput =
      document.getElementById("salesStartDate");

    const endInput =
      document.getElementById("salesEndDate");

    const message =
      document.getElementById("salesFilterMessage");

    const period =
      document.getElementById("salesPeriod");

    const tbody =
      document.getElementById("salesTableBody");

    const params = new URLSearchParams();

    if (startDate) {
      params.set("startDate", startDate);
    }

    if (endDate) {
      params.set("endDate", endDate);
    }

    const queryString = params.toString();

    const url = queryString
      ? `/api/v1/seller/sales?${queryString}`
      : "/api/v1/seller/sales";

    if (message) {
      message.textContent =
        "매출 데이터를 조회하고 있습니다.";
    }

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4">매출 데이터를 불러오는 중입니다.</td>
        </tr>
      `;
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          `매출 조회에 실패했습니다. (${response.status})`
        );
      }

      const result = await response.json();
      const data = result.data ?? result;

      renderSalesSummary(data);
      renderProductSales(data.productSales ?? []);

      const responseStartDate =
        data.startDate ?? startDate;

      const responseEndDate =
        data.endDate ?? endDate;

      if (startInput && responseStartDate) {
        startInput.value = responseStartDate;
      }

      if (endInput && responseEndDate) {
        endInput.value = responseEndDate;
      }

      if (period && responseStartDate && responseEndDate) {
        period.hidden = false;
        period.textContent =
          `조회 기간: ${responseStartDate} ~ ${responseEndDate}`;
      }

      const productCount = Array.isArray(data.productSales)
        ? data.productSales.length
        : 0;

      if (message) {
        message.textContent =
          `${responseStartDate} ~ ${responseEndDate} 기간의 ` +
          `상품별 매출 ${productCount}건을 조회했습니다.`;
      }
    } catch (error) {
      console.error("매출 조회 오류:", error);

      if (message) {
        message.textContent =
          "매출 데이터를 불러오지 못했습니다.";
      }

      if (period) {
        period.hidden = true;
      }

      renderSalesSummary({
        totalSalesAmount: 0,
        orderCount: 0,
        totalSoldQuantity: 0
      });

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4">매출 조회 중 오류가 발생했습니다.</td>
          </tr>
        `;
      }
    }
  };

  const renderSettlementSummary = (data) => {
    const expectedSettlementAmount =
      Number(data.expectedSettlementAmount ?? 0);

    const completedSettlementAmount =
      Number(data.completedSettlementAmount ?? 0);

    const commissionAmount =
      Number(data.commissionAmount ?? 0);

    const totalSalesAmount =
      Number(data.totalSalesAmount ?? 0);

    const expectedElement =
      document.getElementById("expectedSettlementAmount");

    const completedElement =
      document.getElementById("completedSettlementAmount");

    const commissionElement =
      document.getElementById("commissionAmount");

    const tbody =
      document.getElementById("settlementTableBody");

    if (expectedElement) {
      expectedElement.textContent =
        currency.format(expectedSettlementAmount);
    }

    if (completedElement) {
      completedElement.textContent =
        currency.format(completedSettlementAmount);
    }

    if (commissionElement) {
      commissionElement.textContent =
        currency.format(commissionAmount);
    }

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td>${currency.format(totalSalesAmount)}</td>
          <td>${currency.format(commissionAmount)}</td>
          <td>${currency.format(expectedSettlementAmount)}</td>
          <td>${currency.format(completedSettlementAmount)}</td>
        </tr>
      `;
    }
  };

  const fetchSettlements = async (
    startDate = "",
    endDate = ""
  ) => {
    const startInput =
      document.getElementById("settlementStartDate");

    const endInput =
      document.getElementById("settlementEndDate");

    const message =
      document.getElementById("settlementFilterMessage");

    const period =
      document.getElementById("settlementPeriod");

    const tbody =
      document.getElementById("settlementTableBody");

    const params = new URLSearchParams();

    if (startDate) {
      params.set("startDate", startDate);
    }

    if (endDate) {
      params.set("endDate", endDate);
    }

    const queryString = params.toString();

    const url = queryString
      ? `/api/v1/seller/settlements?${queryString}`
      : "/api/v1/seller/settlements";

    if (message) {
      message.textContent =
        "정산 데이터를 조회하고 있습니다.";
    }

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4">정산 데이터를 불러오는 중입니다.</td>
        </tr>
      `;
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          `정산 조회에 실패했습니다. (${response.status})`
        );
      }

      const result = await response.json();
      const data = result.data ?? result;

      renderSettlementSummary(data);

      const responseStartDate =
        data.startDate ?? startDate;

      const responseEndDate =
        data.endDate ?? endDate;

      if (startInput && responseStartDate) {
        startInput.value = responseStartDate;
      }

      if (endInput && responseEndDate) {
        endInput.value = responseEndDate;
      }

      if (period && responseStartDate && responseEndDate) {
        period.hidden = false;
        period.textContent =
          `조회 기간: ${responseStartDate} ~ ${responseEndDate}`;
      }

      if (message) {
        message.textContent =
          `${responseStartDate} ~ ${responseEndDate} 기간의 ` +
          `정산 내역을 조회했습니다.`;
      }
    } catch (error) {
      console.error("정산 조회 오류:", error);

      if (message) {
        message.textContent =
          "정산 데이터를 불러오지 못했습니다.";
      }

      if (period) {
        period.hidden = true;
      }

      renderSettlementSummary({
        totalSalesAmount: 0,
        commissionAmount: 0,
        expectedSettlementAmount: 0,
        completedSettlementAmount: 0
      });

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4">정산 조회 중 오류가 발생했습니다.</td>
          </tr>
        `;
      }
    }
  };

  document
    .querySelectorAll("[data-search-target]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.searchTarget;

        if (target === "sales") {
          const start =
            document.getElementById("salesStartDate");

          const end =
            document.getElementById("salesEndDate");

          const message =
            document.getElementById("salesFilterMessage");

          if (!validatePeriod(start, end, message)) {
            return;
          }

          fetchSales(start.value, end.value);
          return;
        }

        if (target === "settlement") {
          const start =
            document.getElementById("settlementStartDate");

          const end =
            document.getElementById("settlementEndDate");

          const message =
            document.getElementById("settlementFilterMessage");

          if (!validatePeriod(start, end, message)) {
            return;
          }

          fetchSettlements(start.value, end.value);
        }
      });
    });

  const requestedTab =
    new URLSearchParams(window.location.search).get("tab");

  if (["sales", "settlement"].includes(requestedTab)) {
    activateTab(requestedTab);
  }

  fetchSales();
  fetchSettlements();
});