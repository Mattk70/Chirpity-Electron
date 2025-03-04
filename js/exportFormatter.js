// exportFormatter.js

class ExportFormatter {
    constructor(state) {
      this.state = state;
    }
  
    // Helper method to retrieve location info from the database.
    async getLocation(file) {
      const result = await this.state.db.getAsync(
        `
        SELECT lat, lon, place 
        FROM files 
        JOIN locations ON locations.id = files.locationID 
        WHERE files.name = ?
        `,
        file
      );
      return {
        latitude: result?.lat || this.state.lat,
        longitude: result?.lon || this.state.lon,
        place: result?.place || this.state.place,
      };
    }
  
    // Helper method to process the common name when using the chirpity model.
    processChirpityCommonName(modifiedObj, assignCallType = false) {
      if (this.state.model === "chirpity") {
        const regex = /\(([^)]+)\)/;
        // Split the input based on the regex match.
        const [name, callType] = modifiedObj.cname.split(regex);
        modifiedObj.cname = name.trim();
        if (assignCallType) {
          // Only assign call type if requested.
          modifiedObj.comment ??= callType;
        }
      }
    }
  
    // Date formatting method.
    formatDate(timestamp) {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  
    // Converts seconds to a HH:MM:SS format.
    secondsToHHMMSS(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }
  
    // Formats values for the CSV export.
    async formatCSVValues(obj) {
      const modifiedObj = { ...obj };
      const { latitude, longitude, place } = await this.getLocation(modifiedObj.file);
  
      // Adjust score and compute new end time.
      modifiedObj.score /= 1000;
      modifiedObj.score = modifiedObj.score.toString().replace(/^2$/, "confirmed");
      modifiedObj.end = (modifiedObj.end - modifiedObj.position) * 1000 + modifiedObj.timestamp;
      modifiedObj.timestamp = this.formatDate(modifiedObj.timestamp);
      modifiedObj.end = this.formatDate(modifiedObj.end);
  
      return {
        "File": modifiedObj.file,
        "Detection start": modifiedObj.timestamp,
        "Detection end": modifiedObj.end,
        "Common name": modifiedObj.cname,
        "Latin name": modifiedObj.sname,
        "Confidence": modifiedObj.score,
        "Label": modifiedObj.label,
        "Comment": modifiedObj.comment,
        "Call count": modifiedObj.callCount,
        "File offset": this.secondsToHHMMSS(modifiedObj.position),
        "Start (s)": modifiedObj.position,
        "Latitude": latitude,
        "Longitude": longitude,
        "Place": place,
      };
    }
  
    // Formats values for the eBird export.
    async formateBirdValues(obj) {
      const modifiedObj = { ...obj };
      const { latitude, longitude, place } = await this.getLocation(modifiedObj.file);
  
      // Format the timestamp from the filestart property.
      modifiedObj.timestamp = this.formatDate(modifiedObj.filestart);
      let [date, time] = modifiedObj.timestamp.split(" ");
      const [year, month, day] = date.split("-");
      date = `${month}/${day}/${year}`;
      const [hours, minutes] = time.split(":");
      time = `${hours}:${minutes}`;
  
      // Process chirpity-specific adjustments.
      this.processChirpityCommonName(modifiedObj, true);
  
      // Split scientific name into genus and species.
      const [genus, species] = modifiedObj.sname.split(" ");
  
      return {
        "Common name": modifiedObj.cname,
        "Genus": genus,
        "Species": species,
        "Species Count": modifiedObj.callCount || 1,
        "Species Comments": modifiedObj.comment?.replace(/\r?\n/g, " "),
        "Location Name": place,
        "Latitude": latitude,
        "Longitude": longitude,
        "Date": date,
        "Start Time": time,
        "State/Province": "",
        "Country": "",
        "Protocol": "Stationary",
        "Number of observers": "1",
        "Duration": Math.ceil(modifiedObj.duration / 60),
        "All observations reported?": "N",
        "Distance covered": "",
        "Area covered": "",
        "Submission Comments": "Submission initially generated from Chirpity",
      };
    }
  
    // Formats values for the Raven export.
    formatRavenValues(obj) {
      const modifiedObj = { ...obj };
      this.processChirpityCommonName(modifiedObj);
  
      return {
        "Selection": modifiedObj.selection,
        "View": "Spectrogram 1",
        "Channel": 1,
        "Begin Time (s)": modifiedObj.position + modifiedObj.offset,
        "End Time (s)": modifiedObj.end + modifiedObj.offset,
        "Low Freq (Hz)": 0,
        "High Freq (Hz)": 15000,
        "Common Name": modifiedObj.cname,
        "Confidence": modifiedObj.score / 1000,
        "Begin Path": modifiedObj.file,
        "File Offset (s)": modifiedObj.position,
      };
    }
  }

  export default ExportFormatter;
  