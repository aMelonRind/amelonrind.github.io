import { render } from "solid-js/web";
import { App } from "./app.tsx";
import { I18nProvider } from "./i18n.ts";
import { FormLayer } from "./src/Form.tsx";
import "../../lib/global.css";

render(() => <I18nProvider><App /><FormLayer /></I18nProvider>, document.getElementById('app')!)
