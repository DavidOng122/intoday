import { CARD_TYPES } from './cardTypeDetection.js';



export const cardTypeConfig = {
  [CARD_TYPES.PHOTO]: {
    icon: '/photo.svg',
    bg: '#DDE8FF',
  },
  [CARD_TYPES.MUSIC]: {
    icon: '/music.svg',
    bg: '#E1DEFF',
  },
  [CARD_TYPES.LINK]: {
    icon: '/link.svg',
    bg: '#E0E4FF',
  },
  [CARD_TYPES.VIDEO]: {
    icon: '/play.png', // 替换为你原本想要的彩色图标路径
    bg: '#FFD9D9',
  },
  [CARD_TYPES.PODCAST]: {
    icon: '/podcast.svg',
    bg: '#DBF4EF',
  },
  [CARD_TYPES.PLACE]: {
    icon: '/map.png',     // 使用不变色的实景地图 SVG
    bg: '#A9F1A2',
  },
  [CARD_TYPES.TEXT]: {
    icon: '/text.png',
    bg: '#FFE5B9',
  },
  [CARD_TYPES.DOCUMENT]: {
    icon: '/document01.png',
    bg: '#E7CFFF',
  },
  [CARD_TYPES.MEETING]: {
    icon: '/video.png',
    bg: '#DCEAFB',
  },
  [CARD_TYPES.SOCIAL]: {
    icon: '/social.svg',
    bg: '#F5DFEB',
  },
  [CARD_TYPES.SHOPPING]: {
    icon: '/shopping.svg',
    bg: '#F3CFB8',
  },
  [CARD_TYPES.FINANCIAL]: {
    icon: '/financial.svg',
    bg: '#B6C2D1',
  },
  [CARD_TYPES.AI_TOOL]: {
    icon: '/ai_tool.svg',
    bg: '#E1E5EE',
  },
};

export const cardTypeLabels = {
  [CARD_TYPES.PHOTO]: 'Photo',
  [CARD_TYPES.MUSIC]: 'Music',
  [CARD_TYPES.LINK]: 'Link',
  [CARD_TYPES.VIDEO]: 'Video',
  [CARD_TYPES.PODCAST]: 'Podcast',
  [CARD_TYPES.PLACE]: 'Place',
  [CARD_TYPES.TEXT]: 'Text',
  [CARD_TYPES.DOCUMENT]: 'Document',
  [CARD_TYPES.MEETING]: 'Meeting',
  [CARD_TYPES.SOCIAL]: 'Social',
  [CARD_TYPES.SHOPPING]: 'Shopping',
  [CARD_TYPES.FINANCIAL]: 'Financial',
  [CARD_TYPES.AI_TOOL]: 'AI Tool',
};
