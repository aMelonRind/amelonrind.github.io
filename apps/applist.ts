import { base } from "../lib/constants.ts";
import cgolIconUrl from "./cgol/cgol.svg?url";

type UrlString = string & {};

interface App {
  name: string;
  url: UrlString;
  desc: string;
  color?: string;
  icon?: UrlString;
  background?: UrlString;
  badges?: Badge[];
}

interface Badge {
  label: string;
  color?: string;
  url?: UrlString;
}

const toyBadge: Badge = { label: 'Toy' }
const utilBadge: Badge = { label: 'Utility' }
const sourceBadge = (url: string): Badge => ({ label: 'Source', color: 'gray', url })
const nbsp = '\u00a0'

export const applist: App[] = [
  {
    name: "Conway's Game of Life",
    url: `${base}cgol`,
    icon: cgolIconUrl,
    desc: 'The CGOL I wrote while learning Rust. Controls: ' +
      'F: Show FPS; C or Delete: Clear; P or Space or Pause: Pause; S: Step.'.replaceAll(/(?<!;) /g, nbsp),
    badges: [toyBadge]
  }, {
    name: 'Broken CGOL',
    url: `${base}cgol?broken`,
    icon: cgolIconUrl,
    desc: 'The bug I wrote while playing with CGOL. It looks so cool that I decided to upload it.',
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
