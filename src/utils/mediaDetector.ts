export type DetectedMediaType = 'youtube' | 'vimeo' | 'loom' | 'googledrive' | 'dropbox' | 'onedrive' | 'direct-mp4' | 'image' | 'iframe';

export interface DetectedMedia {
  type: DetectedMediaType;
  embedUrl: string;
  originalUrl: string;
  title?: string;
}

export function detectMediaType(url: string): DetectedMedia {
  const trimmed = url.trim();

  // YouTube
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&showinfo=0`,
      originalUrl: trimmed,
    };
  }

  // Vimeo
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?byline=0&portrait=0&title=0`,
      originalUrl: trimmed,
    };
  }

  // Loom
  const loomMatch = trimmed.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) {
    return {
      type: 'loom',
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
      originalUrl: trimmed,
    };
  }

  // Google Drive
  if (trimmed.includes('drive.google.com')) {
    const driveMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return {
        type: 'googledrive',
        embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
        originalUrl: trimmed,
      };
    }
    // Shared folder or other Drive link
    return {
      type: 'googledrive',
      embedUrl: trimmed.replace('/view', '/preview'),
      originalUrl: trimmed,
    };
  }

  // Dropbox
  if (trimmed.includes('dropbox.com')) {
    const dropboxUrl = trimmed.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
    return {
      type: 'dropbox',
      embedUrl: dropboxUrl,
      originalUrl: trimmed,
    };
  }

  // OneDrive
  if (trimmed.includes('onedrive.live.com') || trimmed.includes('1drv.ms')) {
    return {
      type: 'onedrive',
      embedUrl: `https://onedrive.live.com/embed?${trimmed.split('?')[1] || ''}`,
      originalUrl: trimmed,
    };
  }

  // Direct video file
  if (trimmed.match(/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i)) {
    return {
      type: 'direct-mp4',
      embedUrl: trimmed,
      originalUrl: trimmed,
    };
  }

  // Direct image file
  if (trimmed.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i)) {
    return {
      type: 'image',
      embedUrl: trimmed,
      originalUrl: trimmed,
    };
  }

  // Default: iframe
  return {
    type: 'iframe',
    embedUrl: trimmed,
    originalUrl: trimmed,
  };
}

export function isStreamingService(type: DetectedMediaType): boolean {
  return ['youtube', 'vimeo', 'loom', 'googledrive', 'dropbox', 'onedrive'].includes(type);
}

export function isVideoType(type: DetectedMediaType): boolean {
  return ['youtube', 'vimeo', 'loom', 'direct-mp4', 'googledrive', 'dropbox', 'onedrive'].includes(type);
}
