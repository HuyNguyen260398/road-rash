"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Switches locale while preserving the current path. next-intl's router also
// persists the choice in its locale cookie for future visits.
export default function LanguageSwitcher({
  className,
}: {
  className?: string;
}) {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("inline-flex items-center gap-1", className)}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          aria-current={loc === locale ? "true" : undefined}
          onClick={() => router.replace(pathname, { locale: loc })}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            loc === locale
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(loc)}
        </button>
      ))}
    </div>
  );
}
