// custom-select.js
class CustomSelect extends HTMLElement {
    // Shared list of labels and colors across all instances.
    static instances = [];
    static sharedLabels = null;
    static sharedColors = null;
  
    constructor({ labels = [], colors = [], preselectedLabel = null, theme = 'dark', i18n = {} } = {}) {
      super();
      this.attachShadow({ mode: "open" });
        // Internationalisation options with defaults
        this._i18n = {
            selectLabel: "Select a label",
            addLabel: "Add Label",
            enterNewLabel: "Enter new label",
            ...i18n // Merge with user-provided i18n options
      };
      // Initialize shared labels/colors if not already set.
    if (!CustomSelect.sharedLabels) {
        CustomSelect.sharedLabels = labels.length ? labels : [
          "Nocmig", "Local"
        ];
      }

      if (!CustomSelect.sharedColors) {
        CustomSelect.sharedColors = colors.length ? colors : ["dark","success","warning","info","secondary","danger", "primary"]
      }
      this.preselectedLabel = preselectedLabel;

      this.theme = theme === 'dark'
        ? ['dark', 'light', 'white', '#f8d7da', '#ffc107'] 
        : ['light', 'dark', 'black', 'rgb(56, 46, 47)', 'rgb(61, 58, 48)'];
    
      CustomSelect.instances.push(this);
      // Generate a unique radio group name for this instance.
      this.radioGroup = "label-" + Math.random().toString(36).substr(2, 9);
    }
  
    // Allow getting/setting a custom list of labels.
    get labels() {
      return CustomSelect.sharedLabels;
    }
    set labels(newLabels) {
      if (Array.isArray(newLabels)) {
        CustomSelect.sharedLabels = newLabels;
        // Optionally, you could update colors here as well.
        CustomSelect.updateAllInstances();
      }
    }
  
    get selectedValue() {
        const selectedInput = this.shadowRoot.querySelector("input[type='radio']:checked");
        return selectedInput ? selectedInput.value : null;
      }

    connectedCallback() {
      // Register instance.
      CustomSelect.instances.push(this);
      this.render();
      // Hide dropdown if clicking outside.
      document.addEventListener("click", (e) => {
        if (!this.contains(e.target)) {
          this.hideDropdown();
        }
      });
    }
  
    disconnectedCallback() {
      // Remove instance if disconnected.
      const index = CustomSelect.instances.indexOf(this);
      if (index !== -1) {
        CustomSelect.instances.splice(index, 1);
      }
    }
  
  // Update the label list on all instances and dispatch a single global event.
  static updateAllInstances(deleted) {
    CustomSelect.instances.forEach((instance) => instance.renderLabels());
    document.dispatchEvent(
      new CustomEvent("labelsUpdated", {
        detail: {
          deleted: deleted,
          tags: CustomSelect.sharedLabels,
          colors: CustomSelect.sharedColors,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  
    render() {
      // Clear any existing content.
      this.shadowRoot.innerHTML = "";
  
      // Inject Bootstrap stylesheet from node_modules.
      const bootstrapLink = document.createElement("link");
      bootstrapLink.setAttribute("rel", "stylesheet");
      bootstrapLink.setAttribute(
        "href",
        "./node_modules/bootstrap/dist/css/bootstrap.min.css"
      );
      this.shadowRoot.appendChild(bootstrapLink);
  
      // Component-specific styles.
      const style = document.createElement("style");
      style.textContent = `
        :host {
          display: inline-block;
          font-family: sans-serif;
        }

        /* Track */
        ::-webkit-scrollbar-track {
            border-radius: 0.25em;
        }

        /* Handle */
        ::-webkit-scrollbar-thumb {
            background: slategray;
            border-radius: 0.25em;
        }

        /* Handle on hover */
        ::-webkit-scrollbar-thumb:hover {
            background: orangered;
        }
        .dropdown-container {
          position: relative;
          padding: 0px;
          border-radius: 5px;
          width: 185px;
        }
        .selected-label {
          width: 100%;
        }
        .dropdown-list {
          position: absolute;
          border: 1px solid #555;
          padding: 8px;
          border-radius: 5px;
          box-shadow: 0px 4px 6px rgba(0,0,0,0.4);
          display: none;
          z-index: 1000;
          width: 100%;
          max-height: 300px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .dropdown-list label {
          display: block;
          cursor: pointer;
          margin-bottom: 5px;
        }
        .dropdown-list input[type="radio"] {
          display: none;
        }
        .label-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .add-label-container {
          position:sticky;
          bottom: 0;
          padding-top: 8px;
          text-align: center;
          width: 100%;
          background: inherit;
        }
        .add-label-container input {
          width: 100%;
          padding: 5px;
          border-radius: 5px;
          border: 1px solid #777;
          background: #222;
          color: ${this.theme[2]};
        }
        .remove-btn,
        .rename-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 0 5px;
          font-size: 0.9rem;
        }
        .remove-btn { color: ${this.theme[3]}; }
        .rename-btn { color: ${this.theme[4]}; }

        
        .d-none { display: none; }
        .w-100 { width: 100%; }
        .mt-2 { margin-top: 0.5rem; }
        .ms-2 { margin-left: 0.5rem; }
      `;
      this.shadowRoot.appendChild(style);
  
      // Build the component markup.
      const container = document.createElement("div");
      container.className = `dropdown-container bg-${this.theme[0]}`;
      container.innerHTML = `
        <button class="btn btn-sm btn-outline-${this.theme[1]} selected-label">${this._i18n.selectLabel}</button>
        <div class="dropdown-list bg-${this.theme[0]}">
          <div class="label-options"></div>
          <div class="add-label-container">
            <button class="btn btn-sm btn-outline-${this.theme[1]} add-label-btn w-100">+ ${this._i18n.addLabel}</button>
            <input type="text" class="form-control form-control-sm mt-2 new-label-input d-none" placeholder="${this._i18n.enterNewLabel}">
          </div>
        </div>
      `;
      this.shadowRoot.appendChild(container);
  
      // Cache element references.
      this.selectedLabelBtn = this.shadowRoot.querySelector(".selected-label");
      this.dropdownList = this.shadowRoot.querySelector(".dropdown-list");
      this.labelOptions = this.shadowRoot.querySelector(".label-options");
      this.addLabelBtn = this.shadowRoot.querySelector(".add-label-btn");
      this.newLabelInput = this.shadowRoot.querySelector(".new-label-input");
  
      // Set up event listeners.
      this.selectedLabelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
      this.addLabelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showLabelInput();
      });
      this.newLabelInput.addEventListener("keydown", (e) => this.handleNewLabel(e));
      this.newLabelInput.addEventListener("blur", () => {
        this.newLabelInput.classList.add("d-none");
        this.addLabelBtn.classList.remove("d-none");
        this.newLabelInput.value = "";
      });
  
      this.renderLabels();
    }
  
    renderLabels() {
        this.labelOptions.innerHTML = "";
        CustomSelect.sharedLabels.forEach((label, index) => {
          const colorClass = `text-bg-${CustomSelect.sharedColors[index % CustomSelect.sharedColors.length]}`;
          const itemContainer = document.createElement("div");
          itemContainer.className = "label-item";
      
          // Remove button (moved before the label pill)
          const removeBtn = document.createElement("button");
          removeBtn.className = "remove-btn";
          removeBtn.textContent = "x";
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.removeLabel(index);
          });
      
          // Create the label element with hidden radio input
          const labelEl = document.createElement("label");
          labelEl.className = `badge ${colorClass} rounded-pill flex-grow-1`;
          labelEl.style.cursor = "pointer";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = this.radioGroup;
          input.value = label;
      
          if (this.preselectedLabel === label) {
            input.checked = true;
            this.selectedLabelBtn.textContent = label;
            this.selectedLabelBtn.className = `btn btn-sm ${colorClass} rounded-pill w-100`;
          }
      
          input.addEventListener("change", () => this.selectLabel(label, colorClass));
          labelEl.appendChild(input);
          labelEl.appendChild(document.createTextNode(" " + label));
      
          // Rename button
          const renameBtn = document.createElement("button");
          renameBtn.className = "rename-btn";
          renameBtn.textContent = "✎";
          renameBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showRenameInput(index, labelEl);
          });
      
          // Append elements in the new order
          itemContainer.appendChild(removeBtn);  // Delete icon first
          itemContainer.appendChild(labelEl);
          itemContainer.appendChild(renameBtn);
          
          this.labelOptions.appendChild(itemContainer);
        });
      }
  
    toggleDropdown() {
      if (this.dropdownList.style.display === "block") {
        this.dropdownList.style.display = "none";
      } else {
        this.newLabelInput.classList.add("d-none");
        this.addLabelBtn.classList.remove("d-none");
        this.dropdownList.style.display = "block";
      }
    }
  
    selectLabel(label, colorClass) {
      this.selectedLabelBtn.textContent = label;
      this.selectedLabelBtn.className = `btn btn-sm ${colorClass} rounded-pill w-100 selected-label`;
      this.dropdownList.style.display = "none";
      this.dispatchEvent(new CustomEvent("change", {
        detail: { value: this.selectedValue },
        bubbles: true, // Allows the event to propagate
        composed: true // Allows crossing the shadow DOM boundary
      }));
    }
  
    showLabelInput() {
      this.newLabelInput.classList.remove("d-none");
      this.newLabelInput.focus();
      this.addLabelBtn.classList.add("d-none");
    }
  
    handleNewLabel(event) {
      if (event.key === "Enter") {
        const newLabel = this.newLabelInput.value.trim();
        if (newLabel && !CustomSelect.sharedLabels.includes(newLabel)) {
          CustomSelect.sharedLabels.push(newLabel);
          CustomSelect.updateAllInstances();
        }
        this.newLabelInput.value = "";
        this.newLabelInput.classList.add("d-none");
        this.addLabelBtn.classList.remove("d-none");
      }
    }
  
    removeLabel(index) {
      const removedLabel = CustomSelect.sharedLabels.splice(index, 1)[0];
      if (this.selectedLabelBtn.textContent === removedLabel) {
        this.selectedLabelBtn.textContent = this._i18n.selectLabel;
        this.selectedLabelBtn.className = `btn btn-outline-${this.theme[1]} w-100 selected-label`;
      }
      CustomSelect.updateAllInstances(removedLabel);
    }
  
    showRenameInput(index, labelEl) {
      if (labelEl.querySelector("input[type='text']")) return;
      const radioInput = labelEl.querySelector("input[type='radio']");
      const currentLabel = CustomSelect.sharedLabels[index];
      labelEl.innerHTML = "";
      labelEl.appendChild(radioInput);
      const renameInput = document.createElement("input");
      // Updated styling per your request:
      renameInput.className = "form-control form-control-sm d-inline-block";
      renameInput.style.width = "90%";
      renameInput.type = "text";
      renameInput.value = currentLabel;
      labelEl.appendChild(renameInput);
      renameInput.focus();
      renameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.commitRename(index, labelEl, renameInput.value.trim());
        }
      });
      renameInput.addEventListener("blur", () => {
        this.commitRename(index, labelEl, renameInput.value.trim());
      });
    }
  
    commitRename(index, labelEl, newName) {
        newName = newName.trim();
        const selectedIndex = CustomSelect.sharedLabels.indexOf(this.selectedLabelBtn.textContent)
        if (newName && !CustomSelect.sharedLabels.includes(newName)) {
          CustomSelect.sharedLabels[index] = newName;
        }
        const radioInput = labelEl.querySelector("input[type='radio']");
        radioInput.value = CustomSelect.sharedLabels[index];
        labelEl.innerHTML = "";
        labelEl.appendChild(radioInput);
        labelEl.appendChild(document.createTextNode(" " + CustomSelect.sharedLabels[index]));
        if (selectedIndex === index) {
          this.selectedLabelBtn.textContent = CustomSelect.sharedLabels[index];
        }
        CustomSelect.updateAllInstances();
      }
    hideDropdown() {
      this.dropdownList.style.display = "none";
    }
  }
  
  customElements.define("custom-select", CustomSelect);
  
  // Optionally export the class if needed.
  export { CustomSelect };
  