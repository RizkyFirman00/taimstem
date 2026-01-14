import { useState } from "react";
import PhotoItem from "./components/PhotoItem.tsx";

export default function App() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Photo Timestamp Generator</h2>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
      />

      <hr />

      {files.map((file, index) => (
        <PhotoItem key={index} file={file} />
      ))}
    </div>
  );
}
