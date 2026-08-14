/**
 * Returns the exact local images used in the Admin Web.
 */
export const getBusImage = (brand: string, amenities: string[]) => {
  const isAc = amenities.some(a => a.toLowerCase() === 'ac');
  const b = brand.toLowerCase();

  if (b.includes("rosa")) {
    return require("../assets/buses/rosa.jpg");
  }
  
  if (b.includes("ashok")) {
    return isAc ? require("../assets/buses/ashok_ac.jpeg") : require("../assets/buses/ashok_nonac.jpg");
  }

  if (b.includes("tata")) {
    return isAc ? require("../assets/buses/tata_ac.jpg") : require("../assets/buses/tata_nonac.jpg");
  }

  // Fallback
  return require("../assets/buses/rosa.jpg");
};
