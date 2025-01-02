import UCanvas from "./$core$/Canvas";
export * from "./$core$/Canvas";
export default UCanvas;

// @ts-ignore
import { loadBlobStyle } from "/externals/lib/dom.js";

// @ts-ignore
import styles from "./$scss$/Canvas.scss?inline&compress";
loadBlobStyle(styles);
