import { ImageResponse } from "next/og";

export const size = {
  width: 256,
  height: 256,
};

export const contentType = "image/png";

// Simple kitten-like icon using emoji on a gradient background
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
          borderRadius: 48,
          fontSize: 140,
        }}
      >
        {/* Cat face emoji as the centerpiece */}
        <div style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.25))" }}>🐱</div>
      </div>
    ),
    size,
  );
}
