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

function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

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