import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'שמירה בתי משפט',
    short_name: 'שמירה',
    description: 'מערכת ניהול סידור עבודה לשוטרי בתי משפט',
    lang: 'he',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
  };
}
