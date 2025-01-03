import { callByFrame, cover, createImageBitmapCache, orientationNumberMap } from "./Utils.js"

// @ts-ignore
import { whenAnyScreenChanges, getCorrectOrientation } from "/externals/core/agate.js";

//
export default class UICanvas extends HTMLCanvasElement {
    static observedAttributes = ["data-src"];

    //
    ctx: CanvasRenderingContext2D | null = null;
    image: ImageBitmap | null = null;
    #size: [number, number] = [1, 1];
    #orient: number = 0;
    #loading: string|Blob|File = "";
    #ready: string|Blob|File = "";

    //
    connectedCallback() {
        const parent: HTMLElement = this.parentNode as HTMLElement;
        this.#size = [
            Math.min(Math.max(this.clientWidth  || parent?.clientWidth  || 1, 1), Math.min(parent?.clientWidth  || 1, screen?.width  || 1)) * (devicePixelRatio || 1),
            Math.min(Math.max(this.clientHeight || parent?.clientHeight || 1, 1), Math.min(parent?.clientHeight || 1, screen?.height || 1)) * (devicePixelRatio || 1)
        ];
        this.#preload(this.dataset.src, false);
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
            this.#render(this.#ready);
        }

        //
        whenAnyScreenChanges(fixSize);

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
                    this.#render(this.#ready);
                }
            }
        }).observe(this, {box: "device-pixel-content-box"});

        //
        this.#preload(this.dataset.src, false);
    }

    //
    #render(whatIsReady?: File|Blob|string) {
        const canvas = this;
        const ctx = this.ctx;
        const img = this.image;

        //
        if (img && ctx && (whatIsReady == this.#loading || !whatIsReady)) {

            // TODO! multiple canvas support
            callByFrame(0, ()=>{
                if (whatIsReady) { this.#ready = whatIsReady; };
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
        const ready = this.#loading;
        const img = (blob instanceof ImageBitmap) ? blob : (await createImageBitmapCache(blob).catch(console.warn.bind(console)));
        if (img && ready == this.#loading) { this.image = img; this.#render(ready);}
        return blob;
    }

    //
    #preload(src, dnw = true) {
        this.#loading = src;
        return fetch(src)?.then?.(async (rsp)=> this.$useImageAsSource(await rsp.blob(), dnw ?? true)?.catch(console.warn.bind(console)))?.catch?.(console.warn.bind(console));;
    }

    //
    attributeChangedCallback(name, _, newValue) {
        if (name == "data-src") {
            this.#preload(newValue, false);
        };
    }
}

//
customElements.define('ui-canvas', UICanvas, {extends: 'canvas'});
