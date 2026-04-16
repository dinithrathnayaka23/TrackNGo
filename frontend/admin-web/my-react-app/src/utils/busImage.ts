import ashokAc from "../assets/images/ashok_ac.jpeg";
import ashokNonac from "../assets/images/ashok_nonac.jpg";
import tataAc from "../assets/images/tata_ac.jpg";
import tataNonac from "../assets/images/tata_nonac.jpg";
import rosa from "../assets/images/rosa.jpg";

export function getBusImage(
  brand: string,
  amenities: string[],
): string | null {
  const b = brand.toLowerCase();
  const isAc = amenities.some((a) => a.toLowerCase() === "ac");

  if (b.includes("rosa")) return rosa;
  if (b.includes("ashok")) return isAc ? ashokAc : ashokNonac;
  if (b.includes("tata")) return isAc ? tataAc : tataNonac;

  return null;
}
