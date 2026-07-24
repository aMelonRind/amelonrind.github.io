import { base } from "../lib/constants.ts";
import { TranslationKey } from "../src/i18n.ts";
import cgolIconUrl from "./cgol/cgol.svg?url";
import mapIconUrl from "./mapart-conv/favicon.ico?url";
import eventPointIconUrl from "./ba-event-item-calc/favicon.ico?url";
import treasureHuntUrl from "./treasure-hunt-forecaster/favicon.ico?url";

type UrlString = string & {};

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
const mcBadge: Badge = { label: 'tags.minecraft', color: 'lime' }
const baBadge: Badge = { label: 'tags.blue_archive', color: 'aqua' }
const sourceBadge = (url: string): Badge => ({ label: 'tags.sourcecode', color: 'gray', url })

export const applist: App[] = [
  {
    name: 'apps.baeic.title',
    url: `${base}ba-event-item-calc`,
    icon: eventPointIconUrl,
    desc: 'apps.baeic.desc',
    badges: [utilBadge, baBadge]
  },
  {
    name: 'apps.bathf.title',
    url: `${base}treasure-hunt-forecaster`,
    icon: treasureHuntUrl,
    desc: 'apps.bathf.desc',
    badges: [utilBadge, baBadge]
  },
  {
    name: 'apps.corner_cutter.title',
    url: `${base}corner-cutter`,
    desc: 'apps.corner_cutter.desc',
    badges: [utilBadge, mcBadge]
  },
  {
    name: 'apps.mapart_conv.title',
    url: `${base}mapart-conv`,
    icon: mapIconUrl,
    desc: 'apps.mapart_conv.desc',
    badges: [utilBadge, mcBadge]
  },
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
