import { CARD_TYPES } from './cardTypeDetection';



export const cardTypeConfig = {
  [CARD_TYPES.PHOTO]: {
    icon: '/photo.svg',
    bg: '#DDE8FF',
    darkBg: '#2E4D82',
    darkStroke: '#4D74B8',
    darkIconColor: '#D7E4FF',
  },
  [CARD_TYPES.MUSIC]: {
    icon: '/music.svg',
    bg: '#E1DEFF',
    darkBg: '#2E286D',
    darkStroke: '#4436C8',
    darkIconColor: '#E1DEFF' // ✅ 这里已调亮，提升对比度
  },
  [CARD_TYPES.LINK]: {
    icon: '/link.svg',
    bg: '#E0E4FF',
    darkBg: '#3C4CB7',       // 完全对齐你的规范
    darkStroke: '#5265E9',
    darkIconColor: '#A6AEF4'
  },
  [CARD_TYPES.VIDEO]: {
    icon: '/play.png', // 替换为你原本想要的彩色图标路径
    bg: '#FFD9D9',
    darkBg: '#5C2727',       // 移除 B3，变纯色
    darkStroke: '#8E4E4E'
    // 不加 darkIconColor，保持原图色彩
  },
  [CARD_TYPES.PODCAST]: {
    icon: '/podcast.svg',
    bg: '#DBF4EF',
    darkBg: '#39B79E',       // 完全对齐你的规范
    darkStroke: '#44E1C2',
    darkIconColor: '#CCFFF6'
  },
  [CARD_TYPES.PLACE]: {
    icon: '/map.png',     // 使用不变色的实景地图 SVG
    bg: '#A9F1A2',
    darkBg: '#437A3F',       // 移除 B3
    darkStroke: '#64C15E'
    // 不加 darkIconColor，保持原图色彩
  },
  [CARD_TYPES.TEXT]: {
    icon: '/text.png',
    bg: '#FFE5B9',
    darkBg: '#8B622A',       // 移除 B3
    darkStroke: '#BF8A30'
  },
  [CARD_TYPES.DOCUMENT]: {
    icon: '/document01.png',
    bg: '#E7CFFF',
    darkBg: '#57307E',       // 移除 B3
    darkStroke: '#715A87'
  },
  [CARD_TYPES.MEETING]: {
    icon: '/video.png',
    bg: '#DCEAFB',
    darkBg: '#276F94',       // 移除 B3
    darkStroke: '#7698C2'
  },
  [CARD_TYPES.SOCIAL]: {
    icon: '/social.svg',
    bg: '#F5DFEB',
    darkBg: '#A93E78',
    darkStroke: '#F266B2',
    darkIconColor: '#F8C9E1'
  },
  [CARD_TYPES.SHOPPING]: {
    icon: '/shopping.svg',
    bg: '#F3CFB8',
    darkBg: '#A05A2E',
    darkStroke: '#E1854A',
    darkIconColor: '#ED711F'
  },
  [CARD_TYPES.FINANCIAL]: {
    icon: '/financial.svg',
    bg: '#B6C2D1',
    darkBg: '#7C91AC',
    darkStroke: '#276BC2',
    darkIconColor: '#182A3F'
  },
  [CARD_TYPES.AI_TOOL]: {
    icon: '/ai_tool.svg',
    bg: '#E1E5EE',
    darkBg: '#3A548F',
    darkStroke: '#3261CB',
    darkIconColor: '#BDC6D9'
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
