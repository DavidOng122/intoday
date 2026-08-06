export const timeBlocks = [
  { id: 'Morning', key: 'morning', start: '06:00', end: '12:00', color: '#FFE3B4', axisColor: '#DBCBB233', textColor: '#000000', strokeColor: '#F59E0B', accentColor: '#ED1F1F' },
  { id: 'Afternoon', key: 'afternoon', start: '12:00', end: '18:00', color: '#B6DEF3', axisColor: '#E7F3FA33', textColor: '#000000', strokeColor: '#0284C7', accentColor: '#0284C7' },
  { id: 'Evening', key: 'evening', start: '18:00', end: '22:00', color: '#EDE6FF', axisColor: '#CBB3E233', textColor: '#000000', strokeColor: '#A855F7', accentColor: '#A855F7' },
  { id: 'Night', key: 'night', start: '22:00', end: '00:00', color: '#E1E7F2', axisColor: '#B9C6DC33', textColor: '#000000', strokeColor: '#B8C1CC', accentColor: '#B8C1CC' },
  { id: 'Midnight', key: 'midnight', start: '00:00', end: '06:00', color: '#648BD2', axisColor: '#7F9CD033', textColor: '#000000', strokeColor: '#BFDCFF', accentColor: '#648BD2' },
];

export const MOBILE_BLOCK_STYLES = Object.fromEntries(timeBlocks.map((block) => [block.id, block]));

export const DAY_TASK_TIME_ORDER = ['Morning', 'Afternoon', 'Evening', 'Night', 'Midnight'];

export const sections = [
  {
    id: 'morning',
    mobileId: 'Morning',
    labelKey: 'morning',
    start: '06:00',
    end: '12:00',
    pillBg: '#f7d8a5',
    pillColor: '#6b3f06',
    darkPillBg: MOBILE_BLOCK_STYLES.Morning.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Morning.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Morning.strokeColor,
  },
  {
    id: 'afternoon',
    mobileId: 'Afternoon',
    labelKey: 'afternoon',
    start: '12:00',
    end: '18:00',
    pillBg: '#bfe3fb',
    pillColor: '#0d4c82',
    darkPillBg: MOBILE_BLOCK_STYLES.Afternoon.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Afternoon.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Afternoon.strokeColor,
  },
  {
    id: 'evening',
    mobileId: 'Evening',
    labelKey: 'evening',
    start: '18:00',
    end: '22:00',
    pillBg: '#eadffd',
    pillColor: '#5f2d90',
    darkPillBg: MOBILE_BLOCK_STYLES.Evening.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Evening.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Evening.strokeColor,
  },
  {
    id: 'night',
    mobileId: 'Night',
    labelKey: 'night',
    start: '22:00',
    end: '06:00',
    pillBg: '#dfe6ef',
    pillColor: '#213243',
    darkPillBg: MOBILE_BLOCK_STYLES.Night.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Night.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Night.strokeColor,
  },
];
