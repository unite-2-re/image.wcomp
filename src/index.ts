import UCanvas from "./$core$/Canvas";
export * from "./$core$/Canvas";
export default UCanvas;

// @ts-ignore /* @vite-ignore */
import {importCdn} from "/externals/modules/cdnImport.mjs";
export {importCdn};

// @ts-ignore
import styles from "./$scss$/Canvas.scss?inline&compress";

// @ts-ignore
Promise.try(importCdn, ["/externals/lib/dom.js"])?.then?.(({ loadBlobStyle })=>{
    loadBlobStyle(styles);
});
