/**
 * Retrieves the IUCN status for a given species from the local cache.
 *
 * On the first call, if the in-memory cache is empty, the function attempts to read and parse
 * a local "IUCNcache.json" file based on the current window's location to populate the cache.
 * It then returns the cached IUCN status corresponding to the provided species name.
 *
 * Note: Legacy code for fetching data from the IUCN API is present after the cache retrieval
 * logic but is not executed in the packaged application.
 *
 * @param {string} [sname="Anser anser"] - The scientific name of the species.
 * @returns {*} The cached IUCN status data for the species, or undefined if no data exists.
 */
async function getIUCNStatus(sname = "Anser anser") {
  if (!Object.keys(STATE.IUCNcache).length) {
    //const path = p.join(appPath, 'IUCNcache.json');
    const path = window.location.pathname
      .replace(/^\/(\w:)/, "$1")
      .replace("index.html", "IUCNcache.json");
    if (fs.existsSync(path)) {
      const data = await fs.promises.readFile(path, "utf8").catch((err) => {});
      STATE.IUCNcache = JSON.parse(data);
    } else {
      STATE.IUCNcache = {};
    }
  }
  return STATE.IUCNcache[sname];

  /* The following code should not be called in the packaged app */

  const [genus, species] = sname.split(" ");

  const headers = {
    Accept: "application/json",
    Authorization: "API_KEY", // Replace with the actual API key
    keepalive: true,
  };

  try {
    const response = await fetch(
      `https://api.iucnredlist.org/api/v4/taxa/scientific_name?genus_name=${genus}&species_name=${species}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(
        `Network error: code ${response.status} fetching IUCN data.`
      );
    }

    const data = await response.json();

    // Filter out all but the latest assessments
    const filteredAssessments = data.assessments.filter(
      (assessment) => assessment.latest
    );
    const speciesData = { sname, scopes: [] };

    // Fetch all the assessments concurrently
    const assessmentResults = await Promise.all(
      filteredAssessments.map(async (item) => {
        const response = await fetch(
          `https://api.iucnredlist.org/api/v4/assessment/${item.assessment_id}`,
          { headers }
        );
        if (!response.ok) {
          throw new Error(
            `Network error: code ${response.status} fetching IUCN data.`
          );
        }
        const data = await response.json();
        await new Promise((resolve) => setTimeout(resolve, 500));
        return data;
      })
    );

    // Process each result
    for (let item of assessmentResults) {
      const scope = item.scopes?.[0]?.description?.en || "Unknown";
      const status = item.red_list_category?.code || "Unknown";
      const url = item.url || "No URL provided";

      speciesData.scopes.push({ scope, status, url });
    }

    console.log(speciesData);
    STATE.IUCNcache[sname] = speciesData;
    updatePrefs("IUCNcache.json", STATE.IUCNcache);
    return true; // Optionally return the data if you need to use it elsewhere
  } catch (error) {
    if (error.message.includes("404")) {
      generateToast({
        message: "noIUCNRecord",
        variables: { sname: sname },
        type: "warning",
      });
      STATE.IUCNcache[sname] = {
        scopes: [{ scope: "Global", status: "NA", url: null }],
      };
      updatePrefs("IUCNcache.json", STATE.IUCNcache);
      return true;
    }
    console.error("Error fetching IUCN data:", error.message);
    return false;
  }
}