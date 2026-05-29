/** Detect whether we are running as a Chrome Extension or as a standalone web page */
export const IS_WEB_MODE = !window.chrome || !chrome.runtime || !chrome.runtime.id;
