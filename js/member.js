/**
   * Validates membership status for the provided UUID.
   *
   * This asynchronous function sends a POST request to the membership validation endpoint at 
   * "https://subscriber.mattkirkland.co.uk/check-uuid" with the given UUID in the request body. It 
   * expects a JSON response containing a boolean property "result" that indicates membership status.
   * If the HTTP response status is not successful (i.e., not in the 200-299 range) or if an error 
   * occurs during the fetch or response parsing, the function logs the error and throws a new Error.
   *
   * @param {string} uuid - The UUID to validate against the membership database.
   * @returns {Promise<boolean>} A promise that resolves to true if the membership is confirmed, otherwise false.
   * @throws {Error} If the HTTP request fails or an error occurs during response handling.
   *
   * @example
   * checkMembership('123e4567-e89b-12d3-a456-426614174000')
   *   .then(isMember => {
   *     if (isMember) {
   *       console.log('User is a member');
   *     } else {
   *       console.log('User is not a member');
   *     }
   *   })
   *   .catch(error => console.error('Error checking membership:', error));
   */


const REQUEST_TIMEOUT_MS = 5000;

/**
 * Validates that a given string conforms to the version 4 UUID format.
 *
 * Checks the string against the pattern: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx,
 * where the UUID is case-insensitive.
 *
 * @param {string} uuid - The UUID string to validate.
 * @returns {boolean} True if the string is a valid version 4 UUID; otherwise, false.
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

 /**
  * Validates the UUID format and checks membership status by posting to a membership API.
  *
  * The function verifies that the provided `uuid` is in a valid format using an auxiliary check. It then
  * initiates a POST request to the specified `MEMBERSHIP_API_ENDPOINT` with the UUID in the JSON-formatted request body.
  * An `AbortController` enforces a timeout (using `REQUEST_TIMEOUT_MS`) to cancel the request if it takes too long.
  * If the HTTP response is not successful, an error detailing the response status is thrown.
  * On a successful response, the JSON payload is parsed to determine membership status, returning `true` if the
  * `result` is `true` and `false` otherwise.
  *
  * @example
  * // Example usage:
  * checkMembership("123e4567-e89b-12d3-a456-426614174000", "https://api.example.com/membership")
  *   .then(isMember => console.log("Membership status:", isMember))
  *   .catch(error => console.error("Error:", error));
  *
  * @param {string} uuid - The user's UUID string. Must conform to a valid UUID format.
  * @param {string} MEMBERSHIP_API_ENDPOINT - The URL of the membership validation API endpoint.
  * @returns {Promise<boolean>} Promise resolving to `true` if the user is a member, `false` otherwise.
  *
  * @throws {Error} If the UUID format is invalid, the HTTP request fails, or the response status is not OK.
  */
 export async function checkMembership(uuid, MEMBERSHIP_API_ENDPOINT) {
   try {
    if (!isValidUUID(uuid)) {
      throw new Error('Invalid UUID format');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(MEMBERSHIP_API_ENDPOINT, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ uuid }),
      signal: controller.signal,
     });
    clearTimeout(timeoutId);
 
     if (!response.ok) {
       throw new Error(`HTTP error! status: ${response.status}`);
     }
 
     const {result} = await response.json();
     const isMember = result === true; // Assuming the API sends true/false as a boolean.
     return isMember;
   } catch (error) {
    console.error('Error checking membership:', error);
    throw error; // Preserve original error stack trace
   }
 }