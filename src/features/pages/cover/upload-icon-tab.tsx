import { useRef, useState, useEffect } from "react";
import { listUploads, uploadFile } from "src/api/uploads";
import { UploadedIcon } from "src/components/uploaded-icon/uploaded-icon";
import { IconCropper } from "./icon-cropper";

interface UploadIconTabProps {
  onSelect: (url: string) => void;
}

export function UploadIconTab({ onSelect }: UploadIconTabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // The chosen file, waiting to be framed (an object URL).
  const [crop, setCrop] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string[]>([]);

  useEffect(() => {
    listUploads("icons")
      .then(setPrevious)
      .catch(() => {});
  }, []);

  // Choosing a file opens the framing step; nothing is uploaded yet.
  const processFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("File must be an image.");
      return;
    }
    setCrop(URL.createObjectURL(file));
  };

  const closeCrop = () => {
    if (crop) URL.revokeObjectURL(crop);
    setCrop(null);
  };

  // The framed square is what gets uploaded and becomes the icon.
  const uploadFramed = async (blob: Blob) => {
    setUploading(true);
    setError(null);
    try {
      const ext = blob.type === "image/webp" ? "webp" : "png";
      const file = new File([blob], `icon.${ext}`, { type: blob.type });
      const url = await uploadFile(file, "icons");
      setPrevious((prev) => [url, ...prev]);
      closeCrop();
      onSelect(url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (crop) {
    return (
      <div style={{ padding: "4px 0px" }}>
        <IconCropper
          src={crop}
          busy={uploading}
          onCancel={closeCrop}
          onConfirm={(blob) => void uploadFramed(blob)}
        />
        {error && (
          <p
            style={{
              fontSize: 12,
              color: "var(--tt-danger-color, #ef4444)",
              margin: "8px 4px 0",
            }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "4px 0px",
      }}
    >
      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: "1.5px dashed var(--tt-border-color)",
          borderRadius: "var(--tt-radius-lg)",
          background: "var(--tt-card-bg-color)",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          cursor: uploading ? "wait" : "pointer",
          overflow: "hidden",
          minHeight: 90,
          transition: "border-color 0.15s",
          margin: 4,
        }}
      >
        <>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--tt-theme-muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span
            style={{
              fontSize: 13,
              color: "var(--tt-text-color)",
              fontWeight: 500,
            }}
          >
            {uploading ? "Uploading…" : "Click or drag image here"}
          </span>
          <span style={{ fontSize: 11, color: "var(--tt-theme-muted)" }}>
            PNG, JPG, WEBP · you frame it next
          </span>
        </>
      </div>

      {error && (
        <p
          style={{
            fontSize: 12,
            color: "var(--tt-danger-color, #ef4444)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      {/* Previously uploaded */}
      {previous.length > 0 && (
        <div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--tt-theme-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Previously uploaded
          </span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 6,
              marginTop: 8,
              maxHeight: 160,
              overflowY: "auto",
            }}
          >
            {previous.map((url) => (
              <button
                key={url}
                onClick={() => onSelect(url)}
                style={{
                  padding: 2,
                  border: "2px solid transparent",
                  borderRadius: "50%",
                  cursor: "pointer",
                  background: "transparent",
                  transition: "border-color 0.15s",
                  aspectRatio: "1",
                  display: "grid",
                  placeItems: "center",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor =
                    "var(--tt-brand-color-500)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "transparent")
                }
              >
                <UploadedIcon src={url} size={40} />
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
