import meloSvg from "/melo.svg?url";
import { ParentComponent } from "solid-js";
import { base } from "./constants";

export const Header: ParentComponent = (props) => {
  return <header id="site-header" style={{ display: 'grid', 'align-items': 'center' }}>
    <a id="header-home-link" href={base}>
      <img
        id="header-home-icon"
        src={meloSvg}
        alt="Home Icon"
        style={{ width: '50px', height: '50px', 'margin-block': '8px', display: 'block' }}
      />
    </a>
    {props.children}
  </header>
}
