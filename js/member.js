/**
 * @file Helper functions for membership validation.
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