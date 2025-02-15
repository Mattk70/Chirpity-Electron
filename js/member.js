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

async function checkMembership(uuid) {
    try {
      const response = await fetch('https://subscriber.mattkirkland.co.uk/check-uuid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uuid }),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const {result} = await response.json();
      const isMember = result === true; // Assuming the API sends true/false as a boolean.
      return isMember;
    } catch (error) {
      console.error('Error checking membership:', error);
      throw new Error(error); // Default to false if there's an error.
    }
  }
  
  export {checkMembership}