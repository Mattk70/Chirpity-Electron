export class Pagination {
  constructor(container, getState, getConfig, getWorker, handlers) {
    this.container = container;
    this.getState = getState; // Function to get the current state
    this.getConfig = getConfig; // Function to get the current config
    this.getWorker = getWorker;
    this.handlers = handlers; // { isSpeciesViewFiltered, filterResults, resetResults }
  }

  init() {
    this.container.addEventListener("click", (e) => this.handleClick(e));
  }

  handleClick(e) {
    const state = this.getState(); // Get the latest state
    const config = this.getConfig(); // Get the latest config

    if (!state.analysisDone || e.target.tagName !== "A") return;

    let clicked = e.target.textContent;
    const activeElement = this.container.querySelector(".active");
    let currentPage = activeElement ? parseInt(activeElement.textContent) : 1;

    if (clicked === "Previous") {
      clicked = currentPage - 1;
    } else if (clicked === "Next") {
      clicked = currentPage + 1;
    } else {
      clicked = parseInt(clicked);
    }

    const limit = config.limit;
    const offset = (clicked - 1) * limit;
    const species = this.handlers.isSpeciesViewFiltered(true);

    const message = species
      ? { action: "update-state", filteredOffset: { [species]: offset } }
      : { action: "update-state", globalOffset: offset };

    const worker = this.getWorker();
    worker.postMessage(message);
    this.handlers.filterResults({ offset, limit, updateSummary: false });
    this.handlers.resetResults({
      clearSummary: false,
      clearPagination: false,
      clearResults: false,
    });
  }

  add(total, offset) {
    const config = this.getConfig(); // Get the latest config
    const limit = config.limit;
    const pages = Math.ceil(total / limit);
    const currentPage = offset / limit + 1;
    let list = "";

    // Previous button
    list +=
      currentPage === 1
        ? `<li class="page-item disabled"><a class="page-link" href="#">Previous</a></li>`
        : `<li class="page-item"><a class="page-link" href="#">Previous</a></li>`;

    // Page number buttons
    for (let i = 1; i <= pages; i++) {
      if (
        i <= 2 ||
        i > pages - 2 ||
        (i >= currentPage - 2 && i <= currentPage + 2)
      ) {
        list +=
          i === currentPage
            ? `<li class="page-item active" aria-current="page"><a class="page-link" href="#">${i}</a></li>`
            : `<li class="page-item"><a class="page-link" href="#">${i}</a></li>`;
      } else if (i === 3 || i === pages - 2) {
        list += `<li class="page-item disabled"><a class="page-link" href="#">...</a></li>`;
      }
    }

    // Next button
    list +=
      currentPage === pages
        ? `<li class="page-item disabled"><a class="page-link" href="#">Next</a></li>`
        : `<li class="page-item"><a class="page-link" href="#">Next</a></li>`;

    // Update the container's content (assuming container is a single element)
    this.container.classList.remove("d-none");
    this.container.innerHTML = list;
  }

  // New method to hide the pagination (supports multiple)
  hide() {
    if (this.container instanceof NodeList || Array.isArray(this.container)) {
      this.container.forEach((item) => item.classList.add("d-none"));
    } else {
      this.container.classList.add("d-none");
    }
  }
  getCurrentPage(){
    let currentPage = this.container.querySelector('.active');
    return currentPage ? parseInt(currentPage.textContent) : 1;
  }
}
