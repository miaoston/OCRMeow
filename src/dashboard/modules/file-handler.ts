// ─── File Handler Module ───────────────────────────────────────────
// Dropzone, paste, and image file ingestion.

export function setupDropzone(processOCR: (base64: string, source: string) => Promise<void>): void {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  if (!dropzone || !fileInput) return;

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await processOCR(base64, file.name || "Pasted Image");
    };
    reader.readAsDataURL(file);
  };

  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e: any) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
    fileInput.value = "";
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("image/")) handleImageFile(file);
  });
}

export function setupPaste(processOCR: (base64: string, source: string) => Promise<void>): void {
  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await processOCR(base64, file.name || "Pasted Image");
    };
    reader.readAsDataURL(file);
  };

  window.addEventListener("paste", (e) => {
    const activeSection = document.querySelector(".view-section.active")?.id;
    if (activeSection !== "view-studio") return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleImageFile(file);
          break;
        }
      }
    }
  });
}
