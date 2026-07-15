(() => {
  "use strict";

  const stores = {
    seongsu: {
      name: "캐치캐치 성수점",
      address: "서울특별시 성동구 연무장길 00",
      hours: "매일 11:00–21:00",
      closed: "설날·추석 당일",
      phone: "02-000-0001",
      phoneHref: "tel:020000001",
      parking: "인근 유료 주차장 이용",
      mapUrl: "#"
    },
    hongdae: {
      name: "캐치캐치 홍대점",
      address: "서울특별시 마포구 양화로 00",
      hours: "매일 11:30–22:00",
      closed: "연중무휴",
      phone: "02-000-0002",
      phoneHref: "tel:020000002",
      parking: "건물 내 유료 주차",
      mapUrl: "#"
    },
    suwon: {
      name: "캐치캐치 수원점",
      address: "경기도 수원시 팔달구 덕영대로 00",
      hours: "매일 10:30–20:30",
      closed: "백화점 휴점일",
      phone: "031-000-0003",
      phoneHref: "tel:0310000003",
      parking: "구매 금액별 무료 주차",
      mapUrl: "#"
    }
  };

  const cards = document.querySelectorAll("[data-store-id]");
  const mapStoreName = document.getElementById("mapStoreName");
  const mapAddress = document.getElementById("mapAddress");
  const detailStoreName = document.getElementById("detailStoreName");
  const detailAddress = document.getElementById("detailAddress");
  const detailHours = document.getElementById("detailHours");
  const detailClosed = document.getElementById("detailClosed");
  const detailPhone = document.getElementById("detailPhone");
  const detailParking = document.getElementById("detailParking");
  const phoneLink = document.getElementById("phoneLink");
  const mapLink = document.getElementById("mapLink");

  function selectStore(storeId) {
    const store = stores[storeId];
    if (!store) return;

    cards.forEach((card) => {
      card.classList.toggle("on", card.dataset.storeId === storeId);
    });

    mapStoreName.textContent = store.name;
    mapAddress.textContent = store.address;
    detailStoreName.textContent = store.name;
    detailAddress.textContent = store.address;
    detailHours.textContent = store.hours;
    detailClosed.textContent = store.closed;
    detailPhone.textContent = store.phone;
    detailParking.textContent = store.parking;
    phoneLink.href = store.phoneHref;
    mapLink.href = store.mapUrl;
  }

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      selectStore(card.dataset.storeId);
    });
  });
})();
