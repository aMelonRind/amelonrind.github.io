import { base } from "../lib/constants.ts";
import { Flatten } from "../lib/i18n-base.tsx";
import cgolIconUrl from "./cgol/cgol.svg?url";

type UrlString = string & {};
type TranslationKey = keyof Flatten<typeof import("../locale/home/en_us.ts")['en_us']>;

interface App {
  name: TranslationKey;
  url: UrlString;
  desc: TranslationKey;
  color?: string;
  icon?: UrlString;
  background?: UrlString;
  badges?: Badge[];
}

interface Badge {
  label: TranslationKey;
  color?: string;
  url?: UrlString;
}

const toyBadge: Badge = { label: 'tags.toy' }
const utilBadge: Badge = { label: 'tags.util' }
const sourceBadge = (url: string): Badge => ({ label: 'tags.sourcecode', color: 'gray', url })

export const applist: App[] = [
  {
    name: 'apps.cgol.title',
    url: `${base}cgol`,
    icon: cgolIconUrl,
    desc: 'apps.cgol.desc',
    badges: [toyBadge]
  }, {
    name: 'apps.bugcgol.title',
    url: `${base}cgol?broken`,
    icon: cgolIconUrl,
    desc: 'apps.bugcgol.desc',
    badges: [
      toyBadge,
      sourceBadge(
        `https://github.com/aMelonRind/${
          base as string !== '/' ? 'amelonrind.github.io' : 'old'
        }/commit/9792406686650279cf12ea42f24f4555773e9e42`
      )
    ]
  }
]
