import { ImageSourcePropType } from 'react-native';

const ashokAc = require('../assets/images/ashok_ac.jpeg');
const ashokNonac = require('../assets/images/ashok_nonac.jpg');
const tataAc = require('../assets/images/tata_ac.jpg');
const tataNonac = require('../assets/images/tata_nonac.jpg');
const rosa = require('../assets/images/rosa.jpg');

export function getBusImage(brand: string, amenities: string[]): ImageSourcePropType | null {
  const b = brand.toLowerCase();
  const isAc = amenities.some((a) => a.toLowerCase() === 'ac');

  if (b.includes('rosa')) return rosa;
  if (b.includes('ashok')) return isAc ? ashokAc : ashokNonac;
  if (b.includes('tata')) return isAc ? tataAc : tataNonac;

  return null;
}
