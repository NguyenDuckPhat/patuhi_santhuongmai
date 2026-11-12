const searchInput = document.getElementById("__inputItemProps");
const suggestions = document.querySelector("#search-suggestions-panel");
const locationButton = document.getElementById("ct-aw-location-button");
const locationPopover = document.getElementById("location-popover");
const regionTrigger = document.getElementById("region-trigger");
const regionValue = document.getElementById("region-value");
const regionOptions = document.getElementById("region-options");
const areaTrigger = document.getElementById("area-trigger");
const areaValue = document.getElementById("area-value");
const areaOptions = document.getElementById("area-options");
const areaField = document.getElementById("area-field");
const locationStatus = document.getElementById("location-status");
const nearbyLocation = document.getElementById("nearby-location");
const applyLocation = document.getElementById("location-apply");
const clearLocation = document.getElementById("location-clear");

if (locationButton && locationPopover) {
  let provinces = [];
  let wards = [];
  let selectedProvince = null;
  const selectedWards = new Map();

  const setLocationStatus = (message = "") => {
    if (!locationStatus) return;
    locationStatus.textContent = message;
    locationStatus.hidden = !message;
  };

  const resetArea = (message = "Chọn phường xã") => {
    wards = [];
    selectedWards.clear();
    if (areaOptions) areaOptions.replaceChildren();
    if (areaValue) areaValue.textContent = message;
    if (areaTrigger) {
      areaTrigger.disabled = true;
      areaTrigger.setAttribute("aria-expanded", "false");
    }
    if (areaOptions) areaOptions.hidden = true;
    areaField?.classList.add("is-disabled");
  };

  const closeOptionLists = () => {
    for (const [trigger, list] of [[regionTrigger, regionOptions], [areaTrigger, areaOptions]]) {
      if (list) list.hidden = true;
      trigger?.setAttribute("aria-expanded", "false");
    }
  };

  const renderOptions = (container, items, selected, onSelect) => {
    if (!container) return;
    container.replaceChildren(...items.map((item) => {
      const label = document.createElement("label");
      label.className = "location-option";
      label.setAttribute("role", "option");
      label.dataset.code = String(item.code);
      label.tabIndex = 0;
      label.setAttribute("aria-selected", String(selected.has(String(item.code))));
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selected.has(String(item.code));
      checkbox.tabIndex = -1;
      const name = document.createElement("span");
      name.className = "location-option__name";
      name.textContent = item.name;
      label.append(checkbox, name);
      label.addEventListener("click", (event) => {
        event.preventDefault();
        onSelect(item);
      });
      label.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item);
        }
      });
      return label;
    }));
  };

  const loadProvinces = async () => {
    if (provinces.length || !regionOptions) return;
    setLocationStatus("Đang tải tỉnh/thành...");
    try {
      const response = await fetch("/api/provinces");
      if (!response.ok) throw new Error("Province request failed");
      provinces = await response.json();
      renderOptions(regionOptions, [...provinces, { code: "toan-quoc", name: "Toàn quốc" }], new Set(selectedProvince ? [String(selectedProvince.code)] : []), async (province) => {
        selectedProvince = province;
        regionOptions.querySelectorAll(".location-option").forEach((option) => {
          const checked = option.dataset.code === String(province.code);
          option.setAttribute("aria-selected", String(checked));
          option.querySelector("input").checked = checked;
        });
        if (regionValue) regionValue.textContent = province.name;
        closeOptionLists();
        resetArea();
        if (province.code === "toan-quoc") return;
        setLocationStatus("Đang tải phường/xã...");
        try {
          const wardsResponse = await fetch(`/api/provinces/${encodeURIComponent(province.code)}/wards`);
          if (!wardsResponse.ok) throw new Error("Ward request failed");
          const result = await wardsResponse.json();
          if (selectedProvince?.code !== province.code) return;
          wards = result;
          areaTrigger.disabled = false;
          areaField?.classList.remove("is-disabled");
          renderOptions(areaOptions, wards, selectedWards, toggleWard);
          setLocationStatus(wards.length ? "" : "Tỉnh/thành này chưa có dữ liệu phường/xã.");
        } catch {
          if (selectedProvince?.code === province.code) setLocationStatus("Không tải được phường/xã. Vui lòng thử lại.");
        }
      });
      setLocationStatus();
    } catch {
      setLocationStatus("Không tải được danh sách tỉnh/thành. Vui lòng thử lại.");
    }
  };

  const toggleWard = (ward) => {
    const code = String(ward.code);
    if (selectedWards.has(code)) selectedWards.delete(code);
    else selectedWards.set(code, ward);
    renderOptions(areaOptions, wards, selectedWards, toggleWard);
    updateAreaValue();
  };

  const updateAreaValue = () => {
    if (!areaValue) return;
    const names = [...selectedWards.values()].map(({ name }) => name);
    areaValue.textContent = names.length
      ? names.length === 1 ? names[0] : `${names.length} phường/xã đã chọn`
      : "Chọn phường xã";
  };

  regionTrigger?.addEventListener("click", () => {
    const open = regionOptions.hidden;
    closeOptionLists();
    regionOptions.hidden = !open;
    regionTrigger.setAttribute("aria-expanded", String(open));
  });

  areaTrigger?.addEventListener("click", () => {
    if (areaTrigger.disabled) return;
    const open = areaOptions.hidden;
    closeOptionLists();
    areaOptions.hidden = !open;
    areaTrigger.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#region-field")) {
      if (regionOptions) regionOptions.hidden = true;
      regionTrigger?.setAttribute("aria-expanded", "false");
    }
    if (!event.target.closest("#area-field")) {
      if (areaOptions) areaOptions.hidden = true;
      areaTrigger?.setAttribute("aria-expanded", "false");
    }
  });

  const setLocationOpen = (open) => {
    locationPopover.hidden = !open;
    locationButton.setAttribute("aria-expanded", String(open));
    if (open) loadProvinces();
  };

  locationButton.addEventListener("click", () => {
    const open = locationPopover.hidden;
    if (open && suggestions) {
      suggestions.hidden = true;
      searchInput?.setAttribute("aria-expanded", "false");
    }
    setLocationOpen(open);
  });

  applyLocation?.addEventListener("click", () => {
    const selectedLabel = selectedProvince?.name;
    const selectedArea = [...selectedWards.values()].map(({ name }) => name);
    const nearbyLabel = nearbyLocation?.value.trim();
    const label = selectedLabel
      ? selectedArea.length ? `${selectedArea.length === 1 ? selectedArea[0] : `${selectedArea.length} phường/xã`}, ${selectedLabel}` : selectedLabel
      : nearbyLabel || "Chọn khu vực";
    const labelNode = locationButton.querySelector(".location-label");
    if (labelNode) labelNode.textContent = label;
    setLocationOpen(false);
  });

  clearLocation?.addEventListener("click", () => {
    selectedProvince = null;
    if (regionValue) regionValue.textContent = "Chọn tỉnh thành";
    if (regionOptions) regionOptions.replaceChildren();
    closeOptionLists();
    resetArea();
    provinces = [];
    if (nearbyLocation) nearbyLocation.value = "";
    setLocationStatus();
    const labelNode = locationButton.querySelector(".location-label");
    if (labelNode) labelNode.textContent = "Chọn khu vực";
    setLocationOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !locationPopover.hidden) {
      setLocationOpen(false);
      locationButton.focus();
    }
  });
}

if (searchInput && suggestions) {
  const setSuggestionsVisible = (visible) => {
    suggestions.hidden = !visible;
    searchInput.setAttribute("aria-expanded", String(visible));
  };

  searchInput.addEventListener("focus", () => setSuggestionsVisible(true));
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-box")) {
      setSuggestionsVisible(false);
      if (locationPopover && locationButton) {
        locationPopover.hidden = true;
        locationButton.setAttribute("aria-expanded", "false");
      }
    }
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSuggestionsVisible(false);
      searchInput.blur();
    }
  });
}

const categoryStrip = document.getElementById("category-strip");
const categoryNext = document.getElementById("category-next");
const categoryPrev = document.getElementById("category-prev");

if (categoryStrip && categoryNext && categoryPrev) {
  const updateCategoryArrows = () => {
    categoryPrev.disabled = categoryStrip.scrollLeft <= 0;
    categoryNext.disabled = categoryStrip.scrollLeft + categoryStrip.clientWidth >= categoryStrip.scrollWidth - 1;
  };

  categoryNext.addEventListener("click", () => {
    categoryStrip.scrollBy({ left: categoryStrip.clientWidth * 0.75, behavior: "smooth" });
  });
  categoryPrev.addEventListener("click", () => {
    categoryStrip.scrollBy({ left: -categoryStrip.clientWidth * 0.75, behavior: "smooth" });
  });
  categoryStrip.addEventListener("scroll", updateCategoryArrows, { passive: true });
  window.addEventListener("load", updateCategoryArrows, { once: true });
  updateCategoryArrows();
}

const appHeader = document.querySelector(".ct-appwrapper");

if (appHeader) {
  const updateHeaderBackground = () => {
    appHeader.classList.toggle("is-scrolled", window.scrollY > 0);
  };

  window.addEventListener("scroll", updateHeaderBackground, { passive: true });
  updateHeaderBackground();
}
