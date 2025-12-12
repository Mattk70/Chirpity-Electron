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
  * Check membership status for the given UUID by calling the membership API.
  *
  * @param {string} uuid - UUID to validate and check.
  * @param {string} MEMBERSHIP_API_ENDPOINT - Membership API endpoint URL to POST the UUID to.
  * @returns {[boolean, string|false, number|undefined]} `true` if the UUID is a member, otherwise `false`; the membership level as a string or `false` when not a member; and the number of days until expiration if provided.
  * @throws {Error} If the UUID is invalid, the HTTP response is not ok, the request times out, or the response JSON cannot be parsed.
  */
 export async function checkMembership(uuid, MEMBERSHIP_API_ENDPOINT) {
   try {
    if (!isValidUUID(uuid)) {
      throw new Error('Invalid UUID format');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(`Request timed out after ${REQUEST_TIMEOUT_MS} ms`), REQUEST_TIMEOUT_MS);

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
     const outcome = await response.json();
     const { result: isMember, ExpiresIn: expiresInDays } = outcome;
     const level = outcome.level ?? (isMember && 'bronze')
     return [isMember, level, expiresInDays];
   } catch (error) {
    console.error('Error checking membership:', error);
    throw error; // Preserve original error stack trace
   }
 }