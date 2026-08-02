"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LOCALES = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
];

export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations("LanguageToggle");
  const currentLocale = useLocale();
  const router = useRouter();

  const handleSelectLocale = (localeCode: string) => {
    if (localeCode === currentLocale) return;
    document.cookie = `NEXT_LOCALE=${localeCode}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none",
          className
        )}
        aria-label={t("switchLanguage")}
        title={t("switchLanguage")}
      >
        <Globe className="h-4 w-4" />
        <span className="uppercase">{currentLocale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-36">
        {LOCALES.map((item) => (
          <DropdownMenuItem
            key={item.code}
            onClick={() => handleSelectLocale(item.code)}
            className={cn(
              "flex items-center justify-between text-xs",
              currentLocale === item.code && "font-bold text-primary"
            )}
          >
            <span className="flex items-center gap-2">
              <span>{item.flag}</span>
              <span>{item.label}</span>
            </span>
            {currentLocale === item.code && <span>✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
