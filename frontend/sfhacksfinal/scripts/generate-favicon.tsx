// This is a script you would run with Node.js to generate the PNG favicon
// You would need to install sharp: npm install sharp

import fs from "fs"
import sharp from "sharp"

// Read the SVG file
const svgBuffer = fs.readFileSync("./public/favicon.svg")

// Generate different sizes
const sizes = [16, 32, 48, 64, 128, 192, 512]

// Create the favicon.ico (multi-size icon)
Promise.all(sizes.slice(0, 3).map((size) => sharp(svgBuffer).resize(size, size).toFormat("png").toBuffer())).then(
  (buffers) => {
    sharp(buffers[0]).toFile("./public/favicon.ico")
  },
)

// Create apple-touch-icon
sharp(svgBuffer).resize(180, 180).toFormat("png").toFile("./public/apple-touch-icon.png")

// Create other sizes for manifest
sizes.forEach((size) => {
  sharp(svgBuffer).resize(size, size).toFormat("png").toFile(`./public/icon-${size}.png`)
})

console.log("Favicon assets generated!")

