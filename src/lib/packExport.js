import { normalizeCardType, CARD_TYPES, extractPrimaryUrl } from '../taskCardUtils';
import { deriveTaskDisplaySubtitle, deriveTaskDisplayTitle } from './taskDisplayUtils';
import { getUploadedFileRecord } from './uploadedFileStorage';
import JSZip from 'jszip';

export const getPackItemPrimaryUrl = (task) => (
  task?.primaryUrl
  || task?.videoUrl
  || task?.mapUrl
  || task?.redirectUrl
  || extractPrimaryUrl(task?.text || '')
  || ''
);

export const getPackItemSourceMeta = (task, labels) => {
  const cardType = normalizeCardType(task?.cardType);
  const primaryUrl = getPackItemPrimaryUrl(task);
  const subtitle = deriveTaskDisplaySubtitle(task, labels) || 'Item';

  let host = '';
  let domain = '';
  try {
    if (primaryUrl) {
      const parsed = new URL(primaryUrl.startsWith('http') ? primaryUrl : `https://${primaryUrl}`);
      host = parsed.hostname.toLowerCase();
      domain = host.replace(/^www\./, '');
    }
  } catch {
    host = '';
    domain = '';
  }

  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    return { key: 'youtube', label: 'YouTube', domain: 'youtube.com' };
  }
  if (host.includes('chatgpt.com') || host.includes('openai.com')) {
    return { key: 'gpt', label: 'ChatGPT', domain: 'chatgpt.com' };
  }
  if (host.includes('notion.so') || host.includes('notion.site')) {
    return { key: 'notion', label: 'Notion', domain: 'notion.so' };
  }
  if (host.includes('github.com')) {
    return { key: 'github', label: 'GitHub', domain: 'github.com' };
  }
  if (host.includes('spotify.com') || host.includes('spoti.fi')) {
    return { key: 'spotify', label: 'Spotify', domain: 'spotify.com' };
  }
  if (host.includes('instagram.com')) {
    return { key: 'link', label: 'Instagram', domain: 'instagram.com' };
  }
  if (host.includes('twitter.com') || host.includes('x.com')) {
    return { key: 'link', label: 'X (Twitter)', domain: 'x.com' };
  }
  if (host.includes('tiktok.com')) {
    return { key: 'video', label: 'TikTok', domain: 'tiktok.com' };
  }
  if (host.includes('reddit.com')) {
    return { key: 'link', label: 'Reddit', domain: 'reddit.com' };
  }
  if (domain) {
    // generic website — use favicon
    return { key: 'link', label: domain, domain };
  }

  switch (cardType) {
    case 'photo':
      return { key: 'photo', label: labels?.photo || 'Photo', domain: null };
    case 'video':
      return { key: 'video', label: subtitle, domain: null };
    case 'document':
      return { key: 'document', label: subtitle, domain: null };
    case 'ai_tool':
      return { key: 'gpt', label: subtitle, domain: null };
    case 'text':
      return { key: 'text', label: subtitle, domain: null };
    default:
      return { key: 'link', label: subtitle, domain: null };
  }
};

export const PACK_EXPORT_SECTION_ORDER = [
  { role: 'Context', heading: 'Context' },
  { role: 'Code', heading: 'Tech' },
  { role: 'Notes', heading: 'Notes' },
  { role: 'Reference', heading: 'Reference' },
];

export const PACK_FILTER_ORDER = ['All', 'Context', 'Code', 'Notes', 'Reference'];

export const getPackRoleHeading = (role) => PACK_EXPORT_SECTION_ORDER.find((entry) => entry.role === role)?.heading || role;

export const getPackFilterLabel = (filter) => (filter === 'Code' ? 'Tech' : filter);

export const getPackTaskRoles = (task, labels) => {
  const q = (task?.text || '').toLowerCase();
  const title = (deriveTaskDisplayTitle(task) || '').toLowerCase();
  const sourceMeta = getPackItemSourceMeta(task, labels);
  const source = sourceMeta.key.toLowerCase();
  const sourceLabel = String(sourceMeta.label || '').toLowerCase();
  const sourceDomain = String(sourceMeta.domain || '').toLowerCase();
  const tags = Array.isArray(task?.tags) ? task.tags.map((tag) => String(tag).toLowerCase()) : [];
  const cardType = normalizeCardType(task?.cardType);
  const roles = [];

  if (
    ['gpt'].includes(source)
    || q.includes('chat.openai.com')
    || q.includes('chatgpt.com')
    || q.includes('gemini.google.com')
    || q.includes('claude.ai')
    || q.includes('perplexity.ai')
    || tags.some((tag) => ['context', 'prompt', 'ai'].includes(tag))
    || ['context', 'background', 'summary', 'description', 'prompt'].some((keyword) => q.includes(keyword) || title.includes(keyword))
  ) {
    roles.push('Context');
  }

  if (
    ['github'].includes(source)
    || sourceLabel.includes('github')
    || sourceDomain.includes('github.com')
    || q.includes('github.com')
    || title.includes('github')
    || q.includes('```')
    || tags.some((tag) => ['code', 'dev', 'api', 'technical'].includes(tag))
    || ['code', 'dev', 'api', 'implementation', 'technical'].some((keyword) => q.includes(keyword) || title.includes(keyword))
  ) {
    roles.push('Code');
  }

  if (
    cardType === CARD_TYPES.TEXT
    || tags.some((tag) => ['note', 'memo', 'reminder', 'thoughts'].includes(tag))
  ) {
    if (!roles.includes('Code') && !roles.includes('Context')) {
      roles.push('Notes');
    }
  }

  if (['link', 'video', 'shopping', 'social', 'financial', 'location', 'document', 'meeting', 'music', 'podcast', 'photo'].includes(cardType)) {
    if (!roles.includes('Code') && !roles.includes('Context')) {
      roles.push('Reference');
    }
  }

  if (roles.length === 0) {
    if (cardType === CARD_TYPES.LINK) roles.push('Reference');
    else roles.push('Notes');
  }

  return roles;
};

export const getPrimaryPackTaskRole = (task, labels) => {
  const roles = getPackTaskRoles(task, labels);
  return PACK_EXPORT_SECTION_ORDER.find(({ role }) => roles.includes(role))?.role || null;
};

export const getPackTasksByRole = (tasks, labels, role) => (
  tasks.filter((task) => getPrimaryPackTaskRole(task, labels) === role)
);

export const sanitizePackFilename = (value) => {
  const normalized = String(value || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized || 'untitled-pack';
};

const getPackExportBodyText = (task) => {
  const title = deriveTaskDisplayTitle(task).trim();
  const primaryUrl = getPackItemPrimaryUrl(task).trim();
  const candidates = [
    task?.content,
    task?.body,
    task?.previewText,
    task?.preview,
    task?.description,
    task?.summary,
    task?.note,
    task?.text,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (title && trimmed === title) continue;
    if (primaryUrl && trimmed === primaryUrl) continue;
    return trimmed;
  }

  return '';
};

const isCodeLikeContent = (value) => {
  const text = String(value || '').trim();
  if (!text) return false;
  if (text.includes('```')) return false;
  if (/[{};]/.test(text) && /\b(const|let|var|function|return|import|export|class|if|else|await|async)\b/.test(text)) return true;
  if (/<[A-Za-z][\s\S]*>/.test(text)) return true;
  if (/^\s{2,}\S/m.test(text)) return true;
  if (/=>/.test(text)) return true;
  return false;
};
const shouldIncludePackExportUrl = (value) => /^(https?:\/\/|www\.)/i.test(String(value || '').trim());
const isBundleExportableUploadedAsset = (task) => (
  Boolean(task?.uploadedFileStorageKey)
  && ['pdf', 'word', 'image'].includes(String(task?.uploadedFileType || '').toLowerCase())
);
const isDataUrl = (value) => /^data:/i.test(String(value || '').trim());
const dataUrlToBlob = async (value) => {
  const response = await fetch(value);
  return response.blob();
};
const sanitizeAssetFilename = (value, fallback = 'file') => {
  const trimmed = String(value || '').trim();
  const extensionMatch = /\.([a-z0-9]+)$/i.exec(trimmed);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : '';
  const baseName = (extension ? trimmed.slice(0, -extension.length) : trimmed) || fallback;
  const sanitizedBase = baseName
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || fallback;
  const sanitizedExtension = extension.replace(/[^.a-z0-9]+/gi, '').toLowerCase();
  return `${sanitizedBase}${sanitizedExtension}`.toLowerCase();
};

export const ensureUniqueAssetFilename = (fileName, usedNames) => {
  const extensionMatch = /(\.[a-z0-9]+)$/i.exec(fileName);
  const extension = extensionMatch ? extensionMatch[1] : '';
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  let candidate = fileName;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${baseName}-${suffix}${extension}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

export const collectPackAssets = async (tasks) => {
  const usedNames = new Set();
  const assetPathByStorageKey = new Map();
  const assetPathByTaskId = new Map();
  const assets = [];

  for (const task of tasks) {
    if (isBundleExportableUploadedAsset(task)) {
      const storageKey = task.uploadedFileStorageKey;
      if (assetPathByStorageKey.has(storageKey)) {
        assetPathByTaskId.set(task.id, assetPathByStorageKey.get(storageKey));
        continue;
      }

      try {
        const record = await getUploadedFileRecord(storageKey);
        if (!record?.blob) continue;

        const safeName = ensureUniqueAssetFilename(
          sanitizeAssetFilename(
            task.uploadedOriginalFileName
            || record.originalFileName
            || `${deriveTaskDisplayTitle(task) || 'file'}`
          ),
          usedNames,
        );
        const relativePath = `assets/${safeName}`;
        assetPathByStorageKey.set(storageKey, relativePath);
        assetPathByTaskId.set(task.id, relativePath);
        assets.push({
          storageKey,
          path: relativePath,
          blob: record.blob,
        });
      } catch (error) {
        console.error('Failed to collect uploaded asset for export bundle:', error);
      }
      continue;
    }

    if (normalizeCardType(task?.cardType) !== CARD_TYPES.PHOTO) continue;

    const photoReference = task?.photoDataUrl || task?.photoUrl || '';
    if (!isDataUrl(photoReference)) continue;

    try {
      const blob = await dataUrlToBlob(photoReference);
      const mimeType = blob.type || task?.photoMimeType || 'image/png';
      const extension = mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('webp') ? '.webp' : '.png';
      const safeName = ensureUniqueAssetFilename(
        sanitizeAssetFilename(
          task?.photoFileName || `${deriveTaskDisplayTitle(task) || 'image'}${extension}`
        ),
        usedNames,
      );
      const relativePath = `assets/${safeName}`;
      assetPathByTaskId.set(task.id, relativePath);
      assets.push({
        storageKey: null,
        path: relativePath,
        blob,
      });
    } catch (error) {
      console.error('Failed to collect legacy photo asset for export bundle:', error);
    }
  }

  return {
    assets,
    assetPathByStorageKey,
    assetPathByTaskId,
  };
};

export const buildPackExportItemMarkdown = (task, labels, role, options = {}) => {
  const title = deriveTaskDisplayTitle(task).trim() || task?.text?.trim() || 'Untitled item';
  const sourceMeta = getPackItemSourceMeta(task, labels);
  const primaryUrl = getPackItemPrimaryUrl(task).trim();
  const bodyText = getPackExportBodyText(task);
  const cardType = normalizeCardType(task?.cardType);
  const isPhotoCard = cardType === CARD_TYPES.PHOTO;
  const assetReferencePath = (
    (task?.uploadedFileStorageKey
      ? options.assetPathByStorageKey?.get(task.uploadedFileStorageKey)
      : null)
    || options.assetPathByTaskId?.get(task?.id)
    || null
  );
  const lines = [`### ${title}`];

  if (sourceMeta?.label) {
    lines.push('');
    lines.push(`Source: ${sourceMeta.label}`);
  }

  if (assetReferencePath && !isPhotoCard) {
    lines.push(`File: ${assetReferencePath}`);
  }

  if (shouldIncludePackExportUrl(primaryUrl)) {
    lines.push(`URL: ${primaryUrl}`);
  }

  if (bodyText) {
    lines.push('');
    if (role === 'Code' && isCodeLikeContent(bodyText)) {
      lines.push('```');
      lines.push(bodyText);
      lines.push('```');
    } else {
      lines.push(bodyText);
    }
  }

  return lines.join('\n');
};

export const buildPackSectionMarkdown = (tasks, labels, role, heading, options = {}) => {
  const sectionTasks = getPackTasksByRole(tasks, labels, role);
  if (!sectionTasks.length) return '';

  const lines = [`## ${heading}`, ''];
  sectionTasks.forEach((task, index) => {
    lines.push(buildPackExportItemMarkdown(task, labels, role, options));
    if (index < sectionTasks.length - 1) {
      lines.push('');
    }
    lines.push('');
  });

  return `${lines.join('\n').trim()}\n`;
};

export const buildPackExportHeaderLines = (tasks, title) => {
  const updatedLabel = getPackMetadataTextFromItems(tasks);
  const tags = getDesktopGroupDisplayTags(tasks);
  const activeDuration = getPackActiveDurationFromTasks(tasks);
  const activeDurationLabel = getPackActiveLabel(activeDuration);
  const lines = [`# ${title}`, ''];

  lines.push(`- Updated: ${updatedLabel || 'Not available'}`);
  if (tags.length) {
    lines.push(`- Tags: ${tags.join(', ')}`);
  }
  if (activeDuration?.activeDurationType) {
    lines.push(`- Active duration: ${activeDurationLabel}`);
  }

  return lines;
};

export const buildRoleMarkdown = (tasks, labels, role) => {
  const roleConfig = PACK_EXPORT_SECTION_ORDER.find((entry) => entry.role === role);
  if (!roleConfig) return '';

  const sectionTasks = getPackTasksByRole(tasks, labels, role);
  if (!sectionTasks.length) return '';

  const packTitle = getDesktopGroupDisplayName(tasks) || 'Untitled pack';
  const lines = buildPackExportHeaderLines(tasks, `${packTitle} — ${roleConfig.heading}`);
  lines.push('');
  lines.push(`## ${roleConfig.heading}`);
  lines.push('');

  sectionTasks.forEach((task, index) => {
    lines.push(buildPackExportItemMarkdown(task, labels, role));
    if (index < sectionTasks.length - 1) {
      lines.push('');
    }
    lines.push('');
  });

  return `${lines.join('\n').trim()}\n`;
};

export const buildCopyForAIText = (tasks, labels, exportType) => {
  const packTitle = getDesktopGroupDisplayName(tasks) || 'Untitled pack';

  if (exportType === 'all') {
    const sectionBlocks = PACK_EXPORT_SECTION_ORDER
      .map(({ role, heading }) => buildPackSectionMarkdown(tasks, labels, role, heading))
      .filter(Boolean);

    if (!sectionBlocks.length) return '';

    return [
      'Here is the context for my current task.',
      '',
      `# ${packTitle}`,
      '',
      sectionBlocks.join('\n'),
      '',
      'Please use the information above to help me with the next step.',
    ].join('\n').trim();
  }

  const roleMap = {
    context: 'Context',
    code: 'Code',
    notes: 'Notes',
    reference: 'Reference',
  };
  const role = roleMap[exportType];
  const heading = getPackRoleHeading(role);
  if (!role || !heading) return '';

  const sectionBlock = buildPackSectionMarkdown(tasks, labels, role, heading);
  if (!sectionBlock) return '';

  return [
    `Here is the ${heading.toLowerCase()} for my current task.`,
    '',
    `# ${packTitle} — ${heading}`,
    '',
    sectionBlock.trim(),
    '',
    'Please use the information above to help me.',
  ].join('\n').trim();
};

export const buildWholePackMarkdown = (tasks, labels, options = {}) => {
  const packTitle = getDesktopGroupDisplayName(tasks) || 'Untitled pack';
  const sectionMap = new Map(PACK_EXPORT_SECTION_ORDER.map(({ role }) => [role, []]));

  tasks.forEach((task) => {
    const role = getPrimaryPackTaskRole(task, labels);
    if (!role || !sectionMap.has(role)) return;
    sectionMap.get(role).push(task);
  });

  const lines = buildPackExportHeaderLines(tasks, packTitle);

  PACK_EXPORT_SECTION_ORDER.forEach(({ role, heading }) => {
    const sectionTasks = sectionMap.get(role) || [];
    if (!sectionTasks.length) return;
    lines.push('');
    lines.push(`## ${heading}`);
    lines.push('');
    sectionTasks.forEach((task, index) => {
      lines.push(buildPackExportItemMarkdown(task, labels, role, options));
      if (index < sectionTasks.length - 1) {
        lines.push('');
      }
      lines.push('');
    });
    while (lines[lines.length - 1] === '') {
      if (lines[lines.length - 2]?.startsWith('## ')) break;
      lines.pop();
    }
  });

  return `${lines.join('\n').trim()}\n`;
};

export const downloadBlob = (filename, blob) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

export const downloadMarkdown = (filename, markdown) => {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(filename, blob);
};

export const copyTextToClipboard = async (text) => {
  await navigator.clipboard.writeText(text);
};