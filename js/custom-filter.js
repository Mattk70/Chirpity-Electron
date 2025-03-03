

  export default function createFilterDropdown(e, labels, colors, currentFilters = [], i18n) {
    const element = e.target;
    const old = document.getElementById("filter-dropdown");
    old?.remove()
    const fragment = document.createDocumentFragment();
  
    const dropdownEl = Object.assign(document.createElement('div'), {
      className: 'filter-dropdown',
      id: 'filter-dropdown'
    });
  
    const listContainer = Object.assign(document.createElement('div'), {
      className: 'list-container'
    });
  
    const createCheckbox = (id, text) => {
      const label = Object.assign(document.createElement('label'), {
        className: 'd-block text-start text-dark'
      });
      const input = Object.assign(document.createElement('input'), {
        type: 'checkbox',
        id: id,
        className: 'm-2'
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(` ${text}`));
      return label;
    };
  
    listContainer.appendChild(createCheckbox('select-all', i18n.selectAll));
    listContainer.appendChild(createCheckbox('clear-all', i18n.clearAll));
    const rule = document.createElement('hr')
    rule.className = 'text-dark';
    listContainer.appendChild(rule);
    listContainer.appendChild(Object.assign(document.createElement('div'), { id: 'filter-labels' }));
  
    const footer = Object.assign(document.createElement('div'), {
      className: 'p-2 border-top text-end'
    });
    const applyBtnEl = Object.assign(document.createElement('button'), {
      className: 'btn btn-primary btn-sm',
      id: 'apply-btn',
      innerHTML: i18n.apply + ' (<span id="selected-count">0</span>)'
    });
  
    footer.appendChild(applyBtnEl);
    dropdownEl.appendChild(listContainer);
    dropdownEl.appendChild(footer);
    fragment.appendChild(dropdownEl);
  
    element.appendChild(fragment);
    const dropdown = document.getElementById("filter-dropdown");
    const labelsContainer = document.getElementById("filter-labels");
    const selectAll = document.getElementById("select-all");
    const clearAll = document.getElementById("clear-all");
    const selectedCount = document.getElementById("selected-count");
    const applyBtn = document.getElementById("apply-btn");
    let selected = new Set();

    function updateSelection(checkbox, id) {
      if (checkbox.checked) {
        selected.add(id);
      } else {
        selected.delete(id);
      }
      selectedCount.textContent = selected.size;
      selectAll.indeterminate = selected.size > 0 && selected.size < labels.length;
      selectAll.checked = selected.size === labels.length;
      clearAll.checked = !selected.size;
    }
  
    labels.forEach((label, index) => {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = label.id;
      checkbox.checked = currentFilters.includes(label.id);
      checkbox.tabIndex = 0;
      checkbox.addEventListener("change", () => updateSelection(checkbox, label.id));
      updateSelection(checkbox, label.id)
      const labelEl = document.createElement("label");
      labelEl.className = "d-flex p-2 border-bottom" ;
      labelEl.appendChild(checkbox);
      const badge = document.createElement('span')
      badge.textContent = label.name;
      badge.className = `ms-2 badge rounded-pill text-bg-${colors[index % colors.length]}`
      labelEl.appendChild(badge);
      labelEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          checkbox.checked = !checkbox.checked;
          updateSelection(checkbox, label.id);
        }
      });
      labelsContainer.appendChild(labelEl);
    });
  
    selectAll.addEventListener("change", () => {
      const checkboxes = labelsContainer.querySelectorAll("input[type='checkbox']");
      if (selectAll.checked) {
        selected = new Set();
        checkboxes.forEach(cb => {cb.checked = true; selected.add(parseInt(cb.value))});
        selectedCount.textContent = checkboxes.length;
        clearAll.checked = false;
      }
    });
  
    clearAll.addEventListener("change", () => {
      if (clearAll.checked) {
        const checkboxes = labelsContainer.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(cb => cb.checked = false);
        selected = new Set();
        selectAll.checked = false;
        selectAll.indeterminate = false;
        selectedCount.textContent = 0;
      }
    });
  
  
    applyBtn.addEventListener("click", () => {
      const event = new CustomEvent('filter-labels', {
        detail: { filters: Array.from(selected) }
      });
      document.dispatchEvent(event);
      dropdown.remove();

    });
  
    labelsContainer.addEventListener("keydown", (e) => {
      const focusable = Array.from(labelsContainer.querySelectorAll("input[type='checkbox']"));
      const index = focusable.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && index < focusable.length - 1) {
        focusable[index + 1].focus();
      } else if (e.key === "ArrowUp" && index > 0) {
        focusable[index - 1].focus();
      }
    });
  }