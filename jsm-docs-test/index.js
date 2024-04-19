function getColorMode() {
    return localStorage.getItem("colorMode") || (localStorage.setItem("colorMode", "dark"), "dark");
}

function changeColorMode() {
    const mode = getColorMode() === "light" ? "dark" : "light";
    localStorage.setItem("colorMode", mode);
    document.documentElement.setAttribute("color-mode", mode);
}

document.documentElement.setAttribute("color-mode", getColorMode());


function populateClassSidebar() {
    classLists.innerHTML = "";
    for (const key of Array.from(classGroups).sort().reverse()) {
        const h4 = document.createElement("h4");
        h4.innerHTML = key;
        classLists.appendChild(h4);
        const div = document.createElement("div");
        div.setAttribute("id", `${key}List`);
        classLists.appendChild(div);
    }
    for (const [name, st] of searchMaps.classes) {
        for (const clazz of st) {
            const a = document.createElement("a");
            a.setAttribute("href", `${versionSelect.value}/${clazz.url.replace(/(#|$)/, ".html$1")}`);
            frameLink(a);
            if (name.includes(".")) {
                const split = name.split(".");
                a.innerHTML = `${"\u00A0".repeat(split.length * 3 - 3)}$${split.at(-1)}`;
            } else {
                a.innerHTML = name;
            }
            document.getElementById(`${clazz.group}List`).appendChild(a);
        }
    }
}

function frameLink(a) {
    a.setAttribute("onclick", "openMain(this.href); return false;");
}

async function openMain(url, dontpush) {
    url = url.replace(/https?:\/\/.+?\//, "/");
    if (!dontpush) window.history.pushState({}, '', `${window.location.href.split('?')[0].replace(/#.*\??/, "")}?${url}`);
    const req = await fetch(url);
    if (req.status !== 200) {
        alert(`failed to load ${req.status}: \n${req.statusText}`);
        return;
    }
    const text = await req.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html").getElementsByTagName("main")[0];
    const cname = doc.getAttribute("class");
    mainContent.setAttribute("class", cname);
    mainContent.innerHTML = doc.innerHTML;
    for (const a of mainContent.getElementsByTagName("a")) {
        let href = a.getAttribute("href");
        if (!href?.startsWith("#") && !a.hasAttribute("onclick")) {
            if (!a.hasAttribute("target")) {
                a.setAttribute("href", href.replace(/(\.\.\/)*/, `${versionSelect.value}/`));
                frameLink(a);
            } else if (href.startsWith("https://wagyourtail.xyz/Projects/MinecraftMappingViewer/App")) {
                const url = new URL(href);
                href = "https://linkie.shedaniel.dev/mappings?namespace=yarn";
                href += `&version=${url.searchParams.get("version") ?? "1.20.4"}`;
                href += `&search=${url.searchParams.get("search")?.replaceAll(/\//g, ".") ?? "net.minecraft.MinecraftClient"}`;
                a.setAttribute("href", href);
            }
        }
    }
    if (cname === "searchMain") {
        updateClassGroups();
    }
    scrlTo(url);
    mainNav.parentElement.style.display = null;
}

function scrlTo(url) {
    const scroll = url.split("#")[1];
    if (scroll) {
        window.scrollTo(window.scrollX, document.getElementById(scroll).offsetTop);
        console.log(document.getElementById(scroll).offsetTop);
        console.log(scroll);
    } else {
        window.scrollTo(window.scrollX, 0);
    }
}

async function searchBox(val) {
    if (mainContent.getAttribute("class") !== "searchMain") {
        await openMain("./search.html");
    }
    if (loadingSearchMap == null) {
        console.error("loadingSearchMap is null");
    }
    await searchF(val);
}

async function changeVersion() {
    loadingSearchMap = reloadSearchMap();
    loadingSearchMap.then(populateClassSidebar);
    openMain("general.html");
}

loadingSearchMap.then(populateClassSidebar).then(() => {
    const rawParams = window.location.search?.substring(1) || "general.html";
    const scroll = window.location.href.split("?")[1]?.split("#")[1];
    openMain(scroll ? `${rawParams}#${scroll}` : rawParams);
});

menuBtn.onclick = () => {
    mainNav.parentElement.style.display = mainNav.parentElement.style.display ? null : "block";
};

window.addEventListener("popstate", (e) => {
    if (e.state !== null) {
        const scroll = window.location.href.split("#")[1];
        openMain(window.location.search.substring(1) + (scroll ? "#" + scroll : ""), true);
    } else
        scrlTo(window.location.href);
});
