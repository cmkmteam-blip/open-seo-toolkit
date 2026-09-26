'use client';

import { useEffect } from 'react';
import { promoUrl } from '@/lib/promo';

let greeted = false;

export function ConsoleHello() {
  useEffect(() => {
    if (greeted) return;
    greeted = true;
    console.log(
      `%cHi there 👋 Thanks for using Open SEO Toolkit. It's free and MIT-licensed, built by pSEO Wizard. Need landing pages for your keywords? ${promoUrl('home')}`,
      'color:#C2410C;font-weight:600',
    );
  }, []);
  return null;
}
