console.log("OCRMeow Popup Init");
document.getElementById("start")?.addEventListener("click", async () => {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    console.error("OCRMeow: chrome.tabs is not available in this environment.");
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "START_SELECTION" });
  }
});
