import { render } from "solid-js/web";
import { App } from "./app.tsx";
import { I18nProvider } from "./i18n.ts";
import "../../lib/global.css";

render(() => <I18nProvider><App /></I18nProvider>, document.getElementById('app')!)
