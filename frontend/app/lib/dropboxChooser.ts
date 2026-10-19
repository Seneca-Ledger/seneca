'use client';

declare global {
  interface Window {
    Dropbox?: {
      choose: (options: {
        success: (files: DropboxFile[]) => void;
        cancel?: () => void;
        linkType?: 'preview' | 'direct';
        multiselect?: boolean;
        extensions?: string[];
        folderselect?: boolean;
      }) => void;
    };
  }
}

type DropboxFile = {
  id: string;
  name: string;
  link: string;
  bytes: number;
  icon?: string;
};

type ChooserDoc = {
  id: string;
  name: string;
  link?: string;
  bytes?: number;
};

const loadScript = (src: string, dataAppKey?: string) =>
  new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      console.info('[dropbox-chooser] script already present');
      existing.addEventListener('load', () => {
        console.info('[dropbox-chooser] script loaded');
        resolve();
      });
      return resolve();
    }
    console.info('[dropbox-chooser] loading script', src);
    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    if (dataAppKey) {
      script.setAttribute('data-app-key', dataAppKey);
    }
    script.async = true;
    script.onload = () => {
      console.info('[dropbox-chooser] script loaded');
      resolve();
    };
    script.onerror = () => {
      console.error('[dropbox-chooser] script failed to load', src);
      reject(new Error('Failed to load Dropbox API'));
    };
    document.body.appendChild(script);
  });

let chooserReady = false;

const ensureChooserLoaded = async (appKey: string) => {
  if (chooserReady) return;
  console.info('[dropbox-chooser] ensureChooserLoaded start');
  await loadScript('https://www.dropbox.com/static/api/2/dropins.js', appKey);
  chooserReady = true;
};

export const pickDropboxFiles = async (params: {
  appKey: string;
  mimeTypes?: string[];
}): Promise<ChooserDoc[]> => {
  console.info('[dropbox-chooser] pickDropboxFiles start', {
    hasAppKey: Boolean(params.appKey),
    mimeTypes: params.mimeTypes,
  });
  await ensureChooserLoaded(params.appKey);
  const Dropbox = window.Dropbox;
  if (!Dropbox?.choose) {
    console.error('[dropbox-chooser] window.Dropbox.choose missing');
    throw new Error('Dropbox Chooser is not available');
  }

  const extensions = params.mimeTypes
    ?.map(mime => {
      if (mime === 'application/pdf') return '.pdf';
      if (mime === 'text/csv') return '.csv';
      if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        return '.docx';
      return '';
    })
    .filter(Boolean);

  return new Promise<ChooserDoc[]>(resolve => {
    Dropbox.choose({
      success: (files: DropboxFile[]) => {
        console.info('[dropbox-chooser] files selected', files.length);
        const docs = files.map(f => ({
          id: f.id || f.link,
          name: f.name,
          link: f.link,
          bytes: f.bytes,
        }));
        resolve(docs);
      },
      cancel: () => {
        console.info('[dropbox-chooser] cancelled');
        resolve([]);
      },
      linkType: 'direct',
      multiselect: true,
      extensions: extensions && extensions.length > 0 ? extensions : undefined,
    });
  });
};

export const pickDropboxFolder = async (params: { appKey: string }): Promise<ChooserDoc | null> => {
  console.info('[dropbox-chooser] pickDropboxFolder start', {
    hasAppKey: Boolean(params.appKey),
  });
  await ensureChooserLoaded(params.appKey);
  const Dropbox = window.Dropbox;
  if (!Dropbox?.choose) {
    console.error('[dropbox-chooser] window.Dropbox.choose missing');
    throw new Error('Dropbox Chooser is not available');
  }

  return new Promise<ChooserDoc | null>(resolve => {
    Dropbox.choose({
      success: (files: DropboxFile[]) => {
        console.info('[dropbox-chooser] folder selected', files.length);
        if (files.length > 0) {
          const f = files[0];
          resolve({
            id: f.id || f.link,
            name: f.name,
            link: f.link,
            bytes: f.bytes,
          });
        } else {
          resolve(null);
        }
      },
      cancel: () => {
        console.info('[dropbox-chooser] cancelled');
        resolve(null);
      },
      linkType: 'direct',
      multiselect: false,
      folderselect: true,
    });
  });
};

export const getChooserDocName = (doc: ChooserDoc) => doc.name || '';
