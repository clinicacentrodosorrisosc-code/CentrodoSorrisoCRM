import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const envLocale = process.env.NEXT_PUBLIC_APP_LOCALE;

  let locale = cookieLocale || envLocale || 'pt';
  if (!['pt', 'en', 'ko'].includes(locale)) {
    locale = 'pt';
  }

  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    messages = (await import(`../../messages/pt.json`)).default;
  }

  return {
    locale,
    messages
  };
});
