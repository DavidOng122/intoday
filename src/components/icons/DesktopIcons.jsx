import React from 'react';

export const PlusIcon = ({ size = 26 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor" style={{ width: size, height: size }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

export const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

export const PackSelectIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 12.5 8.5 16.5 19.5 6.5" />
    <path d="M9.5 12.5 13.5 16.5" opacity="0.42" />
  </svg>
);

export const PackExportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4.75v10" />
    <path d="M8.25 8.75 12 5l3.75 3.75" />
    <path d="M5.5 13.75v3.5a1.25 1.25 0 0 0 1.25 1.25h10.5a1.25 1.25 0 0 0 1.25-1.25v-3.5" />
  </svg>
);

export const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 18, height: 18 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

export const OpenFullViewIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
    <path d="M6.1 2.25H13.75V9.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.25 2.75L8.85 7.15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.9 13.75H2.25V6.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.75 13.25L7.15 8.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ArrowUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" style={{ width: 18, height: 18 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
  </svg>
);

export const AttachFileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ width: 16, height: 16 }}>
    <path d="M6.75 10.25 11.5 5.5a2.5 2.5 0 1 1 3.54 3.54l-6.1 6.1a3.75 3.75 0 1 1-5.3-5.3l6.36-6.36" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ConvertUploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 22, height: 22 }}>
    <path d="M12 7.25v7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m8.75 10.5 3.25-3.25 3.25 3.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.25 15.75H6A1.75 1.75 0 0 1 4.25 14V6A1.75 1.75 0 0 1 6 4.25h8.1a1.75 1.75 0 0 1 1.24.51l2.15 2.15c.33.33.51.78.51 1.24V10.5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.5 19.75h4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const HeaderChevronIcon = ({ direction = 'left' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16 }}>
    <path
      d={direction === 'left' ? 'M9.75 3.5L5.25 8L9.75 12.5' : 'M6.25 3.5L10.75 8L6.25 12.5'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
    <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.5 3.5C17.3284 2.67157 18.6716 2.67157 19.5 3.5C20.3284 4.32843 20.3284 5.67157 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LinkGlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <path d="M10 2.5C5.858 2.5 2.5 5.858 2.5 10C2.5 14.142 5.858 17.5 10 17.5C14.142 17.5 17.5 14.142 17.5 10C17.5 5.858 14.142 2.5 10 2.5Z" stroke="currentColor" strokeWidth="1.45" />
    <path d="M2.917 8H17.083M2.917 12H17.083M10 2.917C11.563 4.63 12.451 6.855 12.5 9.167C12.451 11.478 11.563 13.703 10 15.417C8.437 13.703 7.549 11.478 7.5 9.167C7.549 6.855 8.437 4.63 10 2.917Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DocumentTextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <path d="M6 3.5H11.5L14.5 6.5V15.5C14.5 16.052 14.052 16.5 13.5 16.5H6.5C5.948 16.5 5.5 16.052 5.5 15.5V4.5C5.5 3.948 5.948 3.5 6.5 3.5H6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M11.25 3.75V6.75H14.25M7.75 9H12.25M7.75 11.75H12.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const VideoGlyphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <rect x="3.5" y="5.25" width="9.75" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M9 8L11.75 10L9 12V8Z" fill="currentColor" />
    <path d="M13.25 8L16 6.5V13.5L13.25 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SparkRosetteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <path d="M10 3.25L11.85 6.15L15.25 6.85L13.1 9.5L13.35 12.95L10 11.7L6.65 12.95L6.9 9.5L4.75 6.85L8.15 6.15L10 3.25Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="1.1" fill="currentColor" />
  </svg>
);

export const NotionGlyphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <rect x="4" y="4" width="12" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 13V7L12.6 13V7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GithubGlyphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <path d="M7.75 15.25V12.9C6.25 13.35 5.25 12.65 4.75 11.5M15.25 13.5C16.05 12.75 16.5 11.65 16.5 10.25C16.5 7.15 13.95 4.75 10 4.75C6.05 4.75 3.5 7.15 3.5 10.25C3.5 11.65 3.95 12.75 4.75 13.5C5.3 14 6.05 14.45 7 14.75M13 14.75C13.95 14.45 14.7 14 15.25 13.5M8 15.25C8.75 15.55 9.35 15.65 10 15.65C10.65 15.65 11.25 15.55 12 15.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7.4" cy="9.2" r="0.7" fill="currentColor" />
    <circle cx="12.6" cy="9.2" r="0.7" fill="currentColor" />
  </svg>
);

export const YouTubeGlyphIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
    <rect x="3.25" y="5.75" width="13.5" height="8.5" rx="2.8" stroke="currentColor" strokeWidth="1.35" />
    <path d="M9 8.35L11.95 10L9 11.65V8.35Z" fill="currentColor" />
  </svg>
);

export const ZoomChevronIcon = ({ open = false, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" style={{ width: 12, height: 12, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}>
    <path d="M3 4.5L6 7.5L9 4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const WorkspaceChevronIcon = ({ open = false }) => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d={open ? 'M5 12.5 10 7.5 15 12.5' : 'M5 7.5 10 12.5 15 7.5'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WorkspaceMoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="5" cy="10" r="1.2" fill="currentColor" />
    <circle cx="10" cy="10" r="1.2" fill="currentColor" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" />
  </svg>
);

export const WorkspacePlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
