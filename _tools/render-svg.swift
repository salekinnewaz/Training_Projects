import Foundation
import AppKit
import CoreGraphics

let args = CommandLine.arguments
guard args.count == 3 else {
    print("usage: render-svg.swift <input.svg> <output.png>")
    exit(1)
}
let inputPath = args[1]
let outputPath = args[2]

let width = 1440
let height = 900

guard let img = NSImage(contentsOfFile: inputPath) else {
    print("Failed to load SVG: \(inputPath)")
    exit(2)
}

// Render the NSImage directly into a bitmap of the exact target size.
// NSImage.draw() honors the source image's natural orientation (right-side up).
guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
) else {
    print("Failed to create NSBitmapImageRep")
    exit(3)
}

NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: rep)
NSGraphicsContext.current = ctx

// Fill background with page surface color first
NSColor(red: 248/255, green: 249/255, blue: 250/255, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()

// Compute scaling so the SVG fits the canvas (preserves aspect ratio)
let imgSize = img.size
let scale = min(CGFloat(width) / imgSize.width, CGFloat(height) / imgSize.height)
let drawW = imgSize.width * scale
let drawH = imgSize.height * scale
let drawX = (CGFloat(width) - drawW) / 2
let drawY = (CGFloat(height) - drawH) / 2

img.draw(in: NSRect(x: drawX, y: drawY, width: drawW, height: drawH),
         from: NSRect(x: 0, y: 0, width: imgSize.width, height: imgSize.height),
         operation: .sourceOver,
         fraction: 1.0)

NSGraphicsContext.restoreGraphicsState()

guard let pngData = rep.representation(using: .png, properties: [:]) else {
    print("Failed to encode PNG")
    exit(4)
}
try pngData.write(to: URL(fileURLWithPath: outputPath))
print("Rendered: \(outputPath) (\(width)x\(height))")
