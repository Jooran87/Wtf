import { Location } from '../api/types';

export const LOCATIONS: Location[] = [
  {
    id: 'rovaniemi-lentokentta',
    name: 'Rovaniemi lentoasema AWOS',
    displayName: 'Rovaniemi lentokenttä',
    apiPlace: 'Rovaniemi lentoasema',
    fmisid: '137190',
    lat: 66.5647,
    lon: 25.8308,
  },
  {
    id: 'helsinki-malmi',
    name: 'Helsinki Malmi lentokenttä',
    displayName: 'Helsinki Malmi',
    apiPlace: 'Helsinki Malmi',
    fmisid: '101009',
    lat: 60.2546,
    lon: 25.0429,
  },
  {
    id: 'heinola',
    name: 'Heinola Asemantaus',
    displayName: 'Heinola',
    apiPlace: 'Heinola',
    fmisid: '101196',
    lat: 61.2028,
    lon: 26.0390,
  },
];
