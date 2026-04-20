import { timeBlocks } from './timeBlocks';

export const SHARED_SELECTED_DATE_KEY = 'shared_selected_date';

export const DESKTOP_LANGUAGE_KEY = 'desktop_profile_language';

export const DESKTOP_APPEARANCE_KEY = 'desktop_profile_appearance';

export const DESKTOP_WORKSPACES_KEY = 'desktop_workspace_items';

export const DESKTOP_ACTIVE_WORKSPACE_KEY = 'desktop_active_workspace';

export const DEFAULT_DESKTOP_WORKSPACE_ID = 'workspace-untitled';

export const MAX_DESKTOP_WORKSPACES = 3;

export const LEGACY_SAMPLE_WORKSPACE_IDS = new Set(['workspace-personal-projects', 'workspace-work-setup']);

export const DEFAULT_DESKTOP_WORKSPACES = [
  {
    id: DEFAULT_DESKTOP_WORKSPACE_ID,
    name: 'Untitled',
    iconType: 'dot',
  },
];

export const LANGUAGE_LOCALES = {
  EN: 'en-US',
  ZH: 'zh-CN',
  MS: 'ms-MY',
  JA: 'ja-JP',
  TH: 'th-TH',
};

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

export const DESKTOP_DRAG_START_DISTANCE = 8;

export const DESKTOP_DRAG_DAY_EDGE_HOLD_MS = 380;

export const DESKTOP_DRAG_DAY_FLIP_COOLDOWN_MS = 700;

export const DESKTOP_DRAG_DAY_FLIP_ZONE_PX = 56;

export const DESKTOP_DRAG_DAY_ARM_DISTANCE_PX = 10;

export const DESKTOP_DRAG_DAY_CONFIRM_DISTANCE_PX = 28;

export const DESKTOP_DRAG_DAY_CANCEL_DISTANCE_PX = 16;

export const DESKTOP_GROUP_OVERLAP_THRESHOLD = 0.5;

export const DESKTOP_MAIN_CONTENT_MAX_WIDTH = 1008;

export const DESKTOP_MAIN_CONTENT_HORIZONTAL_PADDING = 72;

export const DESKTOP_BASE_SLOT_COUNT = 4;

export const DESKTOP_CANVAS_DEFAULT_ZOOM = 0.8;

export const DESKTOP_CANVAS_MIN_SCALE = 0.15;

export const DESKTOP_CANVAS_MAX_SCALE = 2;

export const DESKTOP_CANVAS_SCALE_STEP = 0.12;

export const DESKTOP_CANVAS_CARD_WIDTH = 336;

export const DESKTOP_CANVAS_CARD_HEIGHT = 92;

export const DESKTOP_PHOTO_CARD_HEIGHT = 236;

export const DESKTOP_CANVAS_CARD_GAP = 20;

export const DESKTOP_IMAGE_DROP_MAX_EDGE = 1600;

export const DESKTOP_IMAGE_DROP_QUALITY = 0.88;

export const UPLOADED_FILE_SOURCE_LABEL = 'Uploaded file';

export const SUPPORTED_UPLOAD_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

export const SUPPORTED_UPLOAD_WORD_EXTENSIONS = ['doc', 'docx'];

export const SUPPORTED_UPLOAD_PDF_EXTENSIONS = ['pdf'];

export const SUPPORTED_UPLOAD_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const SUPPORTED_CONVERT_ACCEPT = '.pdf,.docx,.html,.htm,.txt,.md,.csv,.tsv,.xml,text/plain,text/html,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const DESKTOP_CANVAS_MIN_HEIGHT = 560;

export const DESKTOP_GROUP_CARD_MIN_HEIGHT = 176;

export const DESKTOP_GROUP_CARD_ITEM_HEIGHT = 60;

export const DESKTOP_GROUP_CARD_VISIBLE_ITEMS = 3;

export const DESKTOP_GROUP_CARD_EXPANDED_VISIBLE_ITEMS = 5;

export const DESKTOP_APP_WINDOW_SCALE = 0.8;
