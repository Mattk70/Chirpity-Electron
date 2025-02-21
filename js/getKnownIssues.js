/**
 * Asynchronously fetches GitHub issues filtered by provided labels.
 *
 * This function concurrently retrieves issues from the GitHub API for the repository
 * "Chirpity-Electron" owned by "Mattk70". It fetches issues (both open and closed) for each label
 * in the input list, merges the results, and removes duplicate issues based on their unique IDs.
 * The returned issues are processed to include only the title, URL, state, and an array of label names.
 *
 * @param {Array<string>} labelList - An array of label strings to filter issues by.
 * @returns {Promise<Array<{title: string, url: string, state: string, labels: Array<string>}>>} 
 *          A promise that resolves to an array of processed issue objects.
 * @throws Will log an error and rethrow it if any fetch operation fails.
 */

async function fetchIssuesByLabel(labelList) {
  const owner = "Mattk70";
  const repo = "Chirpity-Electron";
  try {
    const results = await Promise.all(
      labelList.map((label) =>
        fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues?state=all&labels=${label}`
        ).then((res) => res.json())
      )
    );

    // Merge results and remove duplicates based on issue ID
    const uniqueIssues = new Map();
    results.flat().forEach((issue) => uniqueIssues.set(issue.id, issue));

    const issues = Array.from(uniqueIssues.values());
    // Process issues to return only the required fields
    const processedIssues = issues.map((issue) => ({
      title: issue.title,
      url: issue.html_url,
      state: issue.state,
      labels: issue.labels.map((label) => label.name),
    }));

    return processedIssues;
  } catch (error) {
    console.error("Error fetching issues:", error.message);
    throw error;
  }
}
function renderIssuesInModal(issues, VERSION) {
  const currentVersion = parseSemVer(VERSION);
  // Filter issues
  issues = issues.filter((issue) => {
    const versionLabel = issue.labels.find((label) =>
      /^v\d+\.\d+\.\d+$/.test(label)
    );
    if (!versionLabel) return true; // Exclude issues without a version label
    if (issue.state === "closed") {
      const fixVersion = parseSemVer(versionLabel);
      const keep = isNewVersion(fixVersion, currentVersion); // Keep issues >= VERSION
      return keep;
    } else {
      return true;
    }
  });
  // Ensure the modal exists in the DOM
  if (!document.getElementById("issuesModal")) {
    const modalHtml = `
            <div class="modal fade" id="issuesModal" tabindex="-1" aria-labelledby="issuesModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="issuesModalLabel">Known Issues in Chirpity ${VERSION}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="issuesModalBody">
                            <!-- Content will be injected here -->
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <a href="https://github.com/Mattk70/Chirpity-Electron/issues" 
                               target="_blank" 
                               class="btn btn-primary">
                               Open a New Issue on GitHub
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  }

  // Populate the modal body
  const modalBody = document.querySelector("#issuesModalBody");

  if (issues.length === 0) {
    modalBody.innerHTML = `
            <p class="text-center text-muted">There are no known issues with Chirpity ${VERSION}.</p>
        `;
  } else {
    modalBody.innerHTML = `
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th scope="col">State</th>
                        <th scope="col">Title</th>
                    </tr>
                </thead>
                <tbody>
                    ${issues
                      .map((issue) => {
                        const versionLabel =
                          issue.labels.find((label) =>
                            /^v\d+\.\d+\.\d+$/.test(label)
                          ) || null;
                        const stateClass =
                          issue.state === "open" ? "bg-purple" : "bg-success";
                        const stateText =
                          issue.state === "open"
                            ? "Open"
                            : `Fixed ${versionLabel || ""}`;
                        return `
                                <tr>
                                    <td>
                                        <span class="badge ${stateClass} pb-2 text-light">${stateText}</span>
                                    </td>
                                    <td>
                                        <a href="${issue.url}" target="_blank" class="text-decoration-none">${issue.title}</a>
                                    </td>
                                </tr>
                            `;
                      })
                      .join("")}
                </tbody>
            </table>
        `;
  }

  // Show the modal
  const modal = new bootstrap.Modal(document.getElementById("issuesModal"));
  modal.show();
}

function parseSemVer(versionString) {
  const semVerRegex =
    /^[vV]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;
  const matches = versionString.match(semVerRegex);
  if (!matches) {
    throw new Error("Invalid SemVer version string");
  }

  const [, major, minor, patch, preRelease, buildMetadata] = matches;

  return {
    major: parseInt(major),
    minor: parseInt(minor),
    patch: parseInt(patch),
    preRelease: preRelease || null,
    buildMetadata: buildMetadata || null,
  };
}

function isNewVersion(latest, current) {
  if (latest.major > current.major) {
    return true;
  } else if (latest.major === current.major) {
    if (latest.minor > current.minor) {
      return true;
    } else if (latest.minor === current.minor) {
      if (latest.patch > current.patch) {
        return true;
      }
    }
  }
  return false;
}
export { fetchIssuesByLabel, renderIssuesInModal, parseSemVer, isNewVersion };
