//
export const getCorrectOrientation = () => {
    let orientationType: string = screen.orientation.type;
    if (!window.matchMedia("((display-mode: fullscreen) or (display-mode: standalone) or (display-mode: window-controls-overlay))").matches) {
        if (matchMedia("(orientation: portrait)").matches) {orientationType = orientationType.replace("landscape", "portrait");} else
            if (matchMedia("(orientation: landscape)").matches) {orientationType = orientationType.replace("portrait", "landscape");};
    }
    return orientationType;
};

//
/*export const orientationNumberMap = {
    "portrait-primary": 0, // as 0deg, aka. 360deg
    "landscape-primary": 1, // as -90deg, aka. 270deg
    "portrait-secondary": 2, // as -180deg, aka. 180deg
    "landscape-secondary": 3 // as -270deg, aka. 90deg
}*/

//
export const orientationNumberMap = {
    "landscape-primary": 0, // as 0deg, aka. 360deg
    "portrait-primary": 1, // as -90deg, aka. 270deg
    "landscape-secondary": 2, // as -180deg, aka. 180deg
    "portrait-secondary": 3, // as -270deg, aka. 90deg
}

//
const delayed = new Map<number, Function | null>([]);
requestIdleCallback(async ()=>{
    while(true) {
        for (const dl of delayed.entries()) {
            dl[1]?.(); delayed.delete(dl[0]);
        }

        //
        try { await (new Promise((rs)=>requestAnimationFrame(rs))); } catch(e) { break; };
    }
}, {timeout: 1000});

//
const callByFrame = (pointerId, cb)=>{
    delayed.set(pointerId, cb);
}

//
const cover = (ctx, img, scale = 1, port, orient = 0) => {
    const canvas = ctx.canvas;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((orient || 0) * (Math.PI * 0.5));
    ctx.rotate(port * -(Math.PI / 2));
    ctx.translate(-(img.width / 2) * scale, -(img.height / 2) * scale);
};

//
const blobImageMap = new WeakMap();
const createImageBitmapCache = (blob)=>{
    if (!blobImageMap.has(blob) && (blob instanceof Blob || blob instanceof File || blob instanceof OffscreenCanvas || blob instanceof ImageBitmap || blob instanceof Image)) {
        blobImageMap.set(blob, createImageBitmap(blob));
    }
    return blobImageMap.get(blob);
}

//
export default class UICanvas extends HTMLCanvasElement {
    static observedAttributes = ["data-src"];

    //
    ctx: CanvasRenderingContext2D | null = null;
    image: ImageBitmap | null = null;
    #size: [number, number] = [1, 1];
    #orient: number = 0;

    //
    connectedCallback() {
        const parent: HTMLElement = this.parentNode as HTMLElement;
        this.#size = [
            Math.min(Math.max(this.clientWidth  || parent?.clientWidth  || 1, 1), Math.min(parent?.clientWidth  || 1, screen?.width  || 1)) * (devicePixelRatio || 1),
            Math.min(Math.max(this.clientHeight || parent?.clientHeight || 1, 1), Math.min(parent?.clientHeight || 1, screen?.height || 1)) * (devicePixelRatio || 1)
        ];
        this.#preload(this.dataset.src, false).then(() => this.#render());
    }

    //
    constructor() {
        super();

        //
        const canvas = this as HTMLCanvasElement;
        const parent = this.parentNode as HTMLElement;

        //
        this.ctx = canvas.getContext("2d", {
            alpha: true,
            desynchronized: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true
        }) as CanvasRenderingContext2D;

        //
        this.inert = true;
        this.style.objectFit = "cover";
        this.style.objectPosition = "center";
        this.classList.add("u-canvas");
        this.classList.add("u2-canvas");
        this.classList.add("ui-canvas");

        //
        const fixSize = () => {
            this.#orient = orientationNumberMap[getCorrectOrientation() || ""] || 0;
            this.#size = [
                Math.max((this.clientWidth  || parent?.clientWidth  || 1) * devicePixelRatio, 1),
                Math.max((this.clientHeight || parent?.clientHeight || 1) * devicePixelRatio, 1)
            ];
            this.#render();
        }

        //
        document?.documentElement.addEventListener("fullscreenchange", fixSize, {passive: true });
        screen.orientation.addEventListener("change", fixSize, {passive: true});
        matchMedia("(orientation: portrait)").addEventListener("change", fixSize, {passive: true});
        addEventListener("resize", fixSize, {passive: true});
        fixSize();
        //requestIdleCallback(fixSize, {timeout: 1000});

        // TODO! Safari backward compatible
        new ResizeObserver((entries) => {
            for (const entry of entries) {
                const box = entry?.devicePixelContentBoxSize?.[0];
                if (box) {
                    this.#orient = orientationNumberMap[getCorrectOrientation() || ""] || 0;
                    this.#size  = [
                        Math.max(/*contentBox.inlineSize * devicePixelRatio*/box.inlineSize || this.width, 1),
                        Math.max(/*contentBox.blockSize  * devicePixelRatio*/box.blockSize  || this.height, 1)
                    ];
                    this.#render();
                }
            }
        }).observe(this, {box: "device-pixel-content-box"});

        //
        this.#preload(this.dataset.src, false).then(() => this.#render());
    }

    //
    #render() {
        const canvas = this;
        const ctx = this.ctx;
        const img = this.image;

        //
        if (img && ctx) {

            // TODO! multiple canvas support
            callByFrame(0, ()=>{
                if (this.width  != this.#size[0]) { this.width  = this.#size[0]; };
                if (this.height != this.#size[1]) { this.height = this.#size[1]; };
                this.style.aspectRatio = `${this.width || 1} / ${this.height || 1}`;
                //this.style.containIntrinsicInlineSize = `${this.width  || 1}px`;
                //this.style.containIntrinsicBlockSize  = `${this.height || 1}px`;

                //
                const ox = (this.#orient%2) || 0;
                const port = img.width < img.height ? 1 : 0;
                const scale = Math.max(
                    canvas[["width", "height"][ox]] / img[["width", "height"][port]],
                    canvas[["height", "width"][ox]] / img[["height", "width"][port]]);

                //
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cover(ctx, img, scale, port, this.#orient);
                ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
                ctx.restore();
            });
        }
    }

    //
    async $useImageAsSource(blob, doNotRewrite = true) {
        const img = (blob instanceof ImageBitmap) ? blob : (await createImageBitmapCache(blob).catch(console.warn.bind(console)));

        //
        if (blob instanceof Blob || blob instanceof File) {
            dispatchEvent(new CustomEvent("u-wallpaper", {detail: {blob, doNotRewrite}}));
        }

        //
        if (img) {this.image = img; this.#render();}

        //
        return blob;
    }

    //
    #preload(src, dnw = true) {
        return fetch(src)?.then?.(async (rsp)=> this.$useImageAsSource(await rsp.blob(), dnw ?? true)?.catch(console.warn.bind(console)))?.catch?.(console.warn.bind(console));;
    }

    //
    attributeChangedCallback(name, _, newValue) {
        if (name == "data-src") {
            this.#preload(newValue, false).then(() => this.#render());
        };
    }
}

//
customElements.define('ui-canvas', UICanvas, {extends: 'canvas'});

// @ts-ignore
import styles from "../$scss$/Canvas.scss?inline&compress";

//
const OWNER = "canvas";

//
const setStyleURL = (base: [any, any], url: string)=>{
    //
    if (base[1] == "innerHTML") {
        base[0][base[1]] = `@import url("${url}");`;
    } else {
        base[0][base[1]] = url;
    }
}

//
const hash = async (string: string) => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(string));
    return "sha256-" + btoa(String.fromCharCode.apply(null, new Uint8Array(hashBuffer) as unknown as number[]));
}

//
const loadStyleSheet = async (inline: string, base?: [any, any], integrity?: string|Promise<string>)=>{
    const url = URL.canParse(inline) ? inline : URL.createObjectURL(new Blob([inline], {type: "text/css"}));
    if (base?.[0] && (!URL.canParse(inline) || integrity) && base?.[0] instanceof HTMLLinkElement) {
        const I: any = (integrity ?? hash(inline));
        if (typeof I?.then == "function") {
            I?.then?.((H)=>base?.[0]?.setAttribute?.("integrity", H));
        } else {
            base?.[0]?.setAttribute?.("integrity", I as string);
        }
    }
    if (base) setStyleURL(base, url);
}

//
const loadBlobStyle = (inline: string)=>{
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.type = "text/css";
    style.crossOrigin = "same-origin";
    style.dataset.owner = OWNER;
    loadStyleSheet(inline, [style, "href"]);
    document.head.appendChild(style);
    return style;
}

//
const loadInlineStyle = (inline: string, rootElement = document.head)=>{
    const PLACE = (rootElement.querySelector("head") ?? rootElement);
    if (PLACE instanceof HTMLHeadElement) { loadBlobStyle(inline); }

    //
    const style = document.createElement("style");
    style.dataset.owner = OWNER;
    loadStyleSheet(inline, [style, "innerHTML"]);
    PLACE.appendChild(style);
}

//
loadBlobStyle(styles);
