import { Platform } from 'react-native';

export const theme = {
  colors: {
    bg: '#2c2c2c',
    bgDark: '#1a1a1a',
    stone: '#7d7d7d',
    stoneDark: '#5a5a5a',
    dirt: '#866043',
    dirtDark: '#5c3a21',
    nether: '#4a1515',
    obsidian: '#15101a',
    text: '#ffffff',
    textSecondary: '#aaaaaa',
    gold: '#ffaa00',
    diamond: '#55ffff',
    emerald: '#55ff55',
    emeraldDark: '#00aa00',
    redstone: '#ff5555',
    lapis: '#5555ff',
    xp: '#a3fc58',
    borderLight: '#9d9d9d',
    borderDark: '#3a3a3a',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  font: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
  media: {
    stone: 'https://static.prod-images.emergentagent.com/jobs/810b6ffd-8ec2-40e5-b61e-9d229caff012/images/c718a33bd6ff5b948dadae9c441d484f27f67fd14f92548db958dc865565fa5c.png',
    dirtGrass: 'https://static.prod-images.emergentagent.com/jobs/810b6ffd-8ec2-40e5-b61e-9d229caff012/images/467b78ce41c3731a50284db211dd109714f1cbbc29b527c53a403e658647e4b9.png',
    mace: require('../assets/images/mace_enchanted.png'),
    book: 'https://static.prod-images.emergentagent.com/jobs/810b6ffd-8ec2-40e5-b61e-9d229caff012/images/14a95b1fe2ccc074baa0a5eee611b5d571ae268e5452404fe8a23d6e6ed0c2d0.png',
    diamond: 'https://static.prod-images.emergentagent.com/jobs/810b6ffd-8ec2-40e5-b61e-9d229caff012/images/f7cbef28761d8ff29d20be5bd0c9acdb857a5e492c320e9bd91e3af7f30a45d2.png',
  },
};

export const API_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
