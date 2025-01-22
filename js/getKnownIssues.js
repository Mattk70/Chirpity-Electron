async function fetchIssuesByLabel(labelList) {
    const owner = "Mattk70";
    const repo = "Chirpity-Electron";
    try {
        const results = await Promise.all(
            labelList.map(label =>
                fetch(`https://api.github.com/repos/${owner}/${repo}/issues?labels=${label}`)
                    .then(res => res.json())
            )
        );
        
        // Merge results and remove duplicates based on issue ID
        const uniqueIssues = new Map();
        results.flat().forEach(issue => uniqueIssues.set(issue.id, issue));

        const issues = Array.from(uniqueIssues.values());
        // Process issues to return only the required fields
        const processedIssues = issues.map(issue => ({
            title: issue.title,
            url: issue.html_url,
            state: issue.state,
        }));

        return processedIssues;

    } catch (error) {
        console.error("Error fetching issues:", error.message);
        throw error;
    }
}
function renderIssuesInModal(issues, VERSION) {
    // Ensure the modal exists in the DOM
    if (!document.querySelector("#issuesModal")) {
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
                        .map(issue => {
                            const stateClass = issue.state === "open" ? "bg-purple" : "bg-success";
                            const stateText = issue.state === "open" ? "Open" : "Fixed in new version";
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


export {fetchIssuesByLabel, renderIssuesInModal}
