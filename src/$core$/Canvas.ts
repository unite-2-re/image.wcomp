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
const cover = (ctx, img, scale = 1, port) => {
    const orientation = getCorrectOrientation();
    const canvas = ctx.canvas;

    //
    switch (orientation) {
        //
        case "landscape-primary": {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(0 * (Math.PI / 180));
            ctx.rotate(port * -90 * (Math.PI / 180));
            ctx.translate(-(img.width / 2) * scale, -(img.height / 2) * scale);
        };
        break;

        //
        case "portrait-primary": {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(90 * (Math.PI / 180));
            ctx.rotate(port * -90 * (Math.PI / 180));
            ctx.translate(-(img.width / 2) * scale, -(img.height / 2) * scale);
        };
        break;

        //
        case "landscape-secondary": {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(180 * (Math.PI / 180));
            ctx.rotate(port * -90 * (Math.PI / 180));
            ctx.translate(-(img.width / 2) * scale, -(img.height / 2) * scale);
        };
        break;

        //
        case "portrait-secondary": {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(270 * (Math.PI / 180));
            ctx.rotate(port * -90 * (Math.PI / 180));
            ctx.translate(-(img.width / 2) * scale, -(img.height / 2) * scale);
        };
        break;
    }

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
export default class UCanvas extends HTMLCanvasElement {
    static observedAttributes = ["data-src"];

    //
    ctx: CanvasRenderingContext2D | null = null;
    image: ImageBitmap | null = null;

    //
    connectedCallback() {
        const parent: HTMLElement = this.parentNode as HTMLElement;
        this.width  = Math.min(Math.max(this.clientWidth  || parent?.clientWidth  || 0, 1), Math.min(parent?.clientWidth  || 0, screen?.width  || 0)) * (devicePixelRatio || 1);
        this.height = Math.min(Math.max(this.clientHeight || parent?.clientHeight || 0, 1), Math.min(parent?.clientHeight || 0, screen?.height || 0)) * (devicePixelRatio || 1);

        //
        this.style.aspectRatio = `${this.clientWidth} / ${this.clientHeight}`;
        this.style.containIntrinsicInlineSize = `${this.width}px`;
        this.style.containIntrinsicBlockSize = `${this.height}px`;
    }

    //
    constructor() {
        super();

        //
        const canvas = this as HTMLCanvasElement;
        const parent = this.parentNode as HTMLElement;

        //
        this.ctx = canvas.getContext("2d", {
            desynchronized: true,
            willReadFrequently: false,
            powerPreference: "high-performance"
        }) as CanvasRenderingContext2D;

        //
        this.inert = true;
        this.style.objectFit = "cover";
        this.style.objectPosition = "center";
        this.classList.add("w-canvas");

        //
        new ResizeObserver((entries) => {
            for (const entry of entries) {
                const contentBox = entry.contentBoxSize[0];
                if (contentBox) {
                    this.width = Math.max(contentBox.inlineSize * devicePixelRatio, 0);
                    this.height = Math.max(contentBox.blockSize * devicePixelRatio, 0);

                    //
                    this.style.aspectRatio = `${this.width} / ${this.height}`;
                    this.style.containIntrinsicInlineSize = `${this.width}px`;
                    this.style.containIntrinsicBlockSize = `${this.height}px`;

                    //
                    this.#render();
                }
            }
        }).observe(this, {box: "content-box"});

        //
        const fixSize = () => {
            this.width = Math.max((this.clientWidth || parent?.clientWidth || 0) * devicePixelRatio, 0);
            this.height = Math.max((this.clientHeight || parent?.clientHeight || 0) * devicePixelRatio, 0);

            //
            this.style.aspectRatio = `${this.width} / ${this.height}`;
            this.style.containIntrinsicInlineSize = `${this.width}px`;
            this.style.containIntrinsicBlockSize = `${this.height}px`;

            //
            this.#render();
        }

        //
        screen.orientation.addEventListener("change", fixSize);
        matchMedia("(orientation: portrait)").addEventListener("change", fixSize);
        window.addEventListener("resize", fixSize);
        requestAnimationFrame(fixSize);

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
            const orientation = getCorrectOrientation() || "";
            const ox = (orientation.startsWith("portrait") ? 1 : 0) - 0;

            //
            const port = img.width < img.height ? 1 : 0;
            const scale = Math.max(
                canvas[["width", "height"][ox]] / img[["width", "height"][port]],
                canvas[["height", "width"][ox]] / img[["height", "width"][port]]);

            //
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            cover(ctx, img, scale, port);
            ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
            ctx.restore();
        }
    }

    //
    async $useImageAsSource(blob, doNotRewrite = true) {
        const img = (blob instanceof ImageBitmap) ? blob : (await createImageBitmapCache(blob).catch((_) => null));

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
        return fetch(src)?.then?.(async (rsp)=> this.$useImageAsSource(rsp.blob(), dnw ?? true).catch((_) => null))?.catch?.(console.warn.bind(console));;
    }

    //
    attributeChangedCallback(name, _, newValue) {
        if (name == "data-src") {
            this.#preload(newValue, false).then(() => this.#render());
        };
    }
}

//
customElements.define('u-canvas', UCanvas, {extends: 'canvas'});
