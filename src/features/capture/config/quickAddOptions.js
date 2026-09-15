import { FileText, Image, Link2, Type } from 'lucide-react';

export const QUICK_ADD_OPTIONS = [
  {
    id: 'text',
    icon: Type,
    labelKey: 'text',
    descriptionKey: 'quickAddTextHint',
  },
  {
    id: 'link',
    icon: Link2,
    labelKey: 'link',
    descriptionKey: 'quickAddLinkHint',
  },
  {
    id: 'image',
    icon: Image,
    labelKey: 'quickAddImage',
    descriptionKey: 'quickAddImageHint',
    accept: 'image/png,image/jpeg,image/webp',
  },
  {
    id: 'file',
    icon: FileText,
    labelKey: 'quickAddFile',
    descriptionKey: 'quickAddFileHint',
    accept: '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
];

