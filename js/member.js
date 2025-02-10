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
  
      console.log(`Is member: ${isMember}`);
      return isMember;
    } catch (error) {
      console.error('Error checking membership:', error);
      return false; // Default to false if there's an error.
    }
  }
  
  export {checkMembership}