import meloSvg from "/melo.svg";
import toolSvg from "./assets/tool.svg";
import iconsUrl from "/icons.svg";
import "./app.css";
import { applist } from "../apps/applist";

export function App() {
  return (
    <>
      <div id="main-container">
        <section id="info">
          <img id="pfp" src={meloSvg} alt="MelonRind Profile Picture" />
          <h1>MelonRind's&nbsp;Pages</h1>
          <div class="badges-container">
            {buttonIcon('github', 'https://github.com/aMelonRind')}
            {buttonIcon('discord', 'https://discord.gg/J82QfTWv2F')}
            {buttonIcon('modrinth', 'https://modrinth.com/user/MelonRind')}
          </div>
        </section>
        <section id="pages">
          {applist.map(app => <div class="app-card">
            <div class="app-card-title">
              {app.icon
                ? <img class="app-icon" src={app.icon} alt="App Icon" />
                : <img class="app-icon-placeholder" src={toolSvg} alt="App Icon"></img>
              }
              <a class="app-name" href={app.url}>{app.name}</a>
            </div>
            {app.badges?.length && <div class="badges-container">
              {app.badges.map(badge => <div
                class="badge"
                style={badge.color ? { 'outline-color': badge.color } : undefined}
              >
                {badge.url
                  ? <a
                    class="badge-link"
                    href={badge.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >{badge.label}</a>
                  : badge.label
                }
              </div>)}
            </div>}
            <div class="app-desc">{app.desc}</div>
          </div>)}
        </section>
      </div><section id="spacer"></section>
    </>
  )
}

function buttonIcon(id: string, href: string) {
  return <a href={href} target="_blank" rel="noopener noreferrer">
    <svg class="button-icon" role="presentation" aria-hidden="true">
      <use href={`${iconsUrl}#${id}`}></use>
    </svg>
  </a>
}
