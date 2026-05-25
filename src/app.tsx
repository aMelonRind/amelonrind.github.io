import { createSignal } from 'solid-js'
import viteLogo from './assets/vite.svg'
import iconsUrl from '/icons.svg?url'
import './app.css'

export function App() {
  const [count, setCount] = createSignal(0)

  return (
    <>
      <section id="center">
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/app.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          class="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count()}
        </button>
      </section>

      <div class="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg class="icon" role="presentation" aria-hidden="true">
            <use href={`${iconsUrl}#documentation-icon`}></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img class="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://github.com/solidjs/solid" target="_blank">
                {/* <img class="button-icon" src={logo} alt="" /> */}
                Learn SolidJs
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg class="icon" role="presentation" aria-hidden="true">
            <use href={`${iconsUrl}#social-icon`}></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg class="button-icon" role="presentation" aria-hidden="true">
                  <use href={`${iconsUrl}#github-icon`}></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg class="button-icon" role="presentation" aria-hidden="true">
                  <use href={`${iconsUrl}#discord-icon`}></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg class="button-icon" role="presentation" aria-hidden="true">
                  <use href={`${iconsUrl}#x-icon`}></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg class="button-icon" role="presentation" aria-hidden="true">
                  <use href={`${iconsUrl}#bluesky-icon`}></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div class="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}
