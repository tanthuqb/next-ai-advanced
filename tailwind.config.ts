import type { Config } from "tailwindcss";

const config: Config = {
  // QUAN TRỌNG: Phải có đủ các đường dẫn này
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "/**/*.{js,ts,jsx,tsx,mdx}", 
  ],
  theme: {
    extend: {
      // Đảm bảo có các biến màu của shadcn ở đây
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;