import { render } from "solid-js/web";
import "./index.css";
import { App } from "./app.tsx";
import { I18nProvider } from "./i18n.ts";

render(() => <I18nProvider><App /></I18nProvider>, document.getElementById('app')!)
