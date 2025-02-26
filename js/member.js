/**
   * Validates membership status for the provided UUID.
   *
   * This asynchronous function sends a POST request to the membership validation endpoint 
   * with the given UUID in the request body. It 
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
  * Checks the membership status for a given UUID by sending a POST request to the membership API.
  *
  * The function first validates the UUID format. If the UUID is invalid, it throws an error.
  * It then sends a POST request to the specified API endpoint with the UUID in a JSON payload.
  * An AbortController enforces a timeout (REQUEST_TIMEOUT_MS) to cancel the request if it takes too long.
  * On a successful response, the JSON payload is parsed to extract:
  * - A boolean indicating membership status (mapped from the "result" property).
  * - A number representing the expiration days (mapped from the "ExpiresIn" property).
  * These values are returned as an array.
  *
  * @example
  * // Example usage:
  * checkMembership("123e4567-e89b-12d3-a456-426614174000", "https://api.example.com/membership")
  *   .then(([isMember, expiresInDays]) => {
  *     console.log("Membership status:", isMember);
  *     console.log("Expires in days:", expiresInDays);
  *   })
  *   .catch(error => console.error("Error:", error));
  *
  * @param {string} uuid - The user's UUID string to validate.
  * @param {string} MEMBERSHIP_API_ENDPOINT - The URL of the membership API endpoint.
  * @returns {Promise<[boolean, number]>} Promise resolving to an array where the first element is the membership status
  * and the second element is the number of days until expiration.
  *
  * @throws {Error} If the UUID is invalid, the HTTP request fails, or the response status is not successful.
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
 
     const { result: isMember, ExpiresIn: expiresInDays } = await response.json();
    //  const isMember = result === true; // Assuming the API sends true/false as a boolean.

     return [isMember, expiresInDays];
   } catch (error) {
    console.error('Error checking membership:', error);
    throw error; // Preserve original error stack trace
   }
 }