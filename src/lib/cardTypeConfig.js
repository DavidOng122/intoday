import { CARD_TYPES } from './cardTypeDetection';

export const cardTypeConfig = {
  [CARD_TYPES.MUSIC]: { icon: '/play.png', bg: '#FFE0C2', darkBg: '#8F5832B3', darkStroke: '#B06F3A' },
  [CARD_TYPES.LINK]: { icon: '/text.png', bg: '#E8E1D7', darkBg: '#5B5148B3', darkStroke: '#7D7063' },
  [CARD_TYPES.VIDEO]: { icon: '/play.png', bg: '#FFD9D9', darkBg: '#5C2727B3', darkStroke: '#8E4E4E' },
  [CARD_TYPES.PODCAST]: { icon: '/play.png', bg: '#F5D8FF', darkBg: '#6E3E7EB3', darkStroke: '#9362A4' },
  [CARD_TYPES.PLACE]: { icon: '/map.png', bg: '#A9F1A2', darkBg: '#437A3FB3', darkStroke: '#64C15E' },
  [CARD_TYPES.TEXT]: { icon: '/text.png', bg: '#FFE5B9', darkBg: '#8B622AB3', darkStroke: '#BF8A30' },
  [CARD_TYPES.DOCUMENT]: { icon: '/document01.png', bg: '#E7CFFF', darkBg: '#57307EB3', darkStroke: '#715A87' },
  [CARD_TYPES.MEETING]: { icon: '/video.png', bg: '#DCEAFB', darkBg: '#276F94B3', darkStroke: '#7698C2' },
  [CARD_TYPES.SOCIAL]: { icon: '/text.png', bg: '#D9F1FF', darkBg: '#2E607DB3', darkStroke: '#5D8DA8' },
  [CARD_TYPES.SHOPPING]: { icon: '/text.png', bg: '#FFE7CC', darkBg: '#805A32B3', darkStroke: '#AD7A46' },
  [CARD_TYPES.FINANCIAL]: { icon: '/text.png', bg: '#D7F3E6', darkBg: '#316650B3', darkStroke: '#4D8A6C' },
};

export const cardTypeLabels = {
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
};
