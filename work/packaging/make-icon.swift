import AppKit

let size: CGFloat = 1024
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
let bounds = NSRect(x: 32, y: 32, width: 960, height: 960)
let background = NSBezierPath(roundedRect: bounds, xRadius: 225, yRadius: 225)
NSGradient(starting: NSColor(calibratedRed: 0.78, green: 0.84, blue: 0.87, alpha: 1), ending: NSColor(calibratedRed: 0.54, green: 0.65, blue: 0.70, alpha: 1))!.draw(in: background, angle: 105)
let center = NSPoint(x: 500, y: 510)
func circle(_ radius: CGFloat) -> NSBezierPath {
  NSBezierPath(ovalIn: NSRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
}
let shadow = NSShadow()
shadow.shadowColor = NSColor.black.withAlphaComponent(0.25)
shadow.shadowBlurRadius = 35
shadow.shadowOffset = NSSize(width: 0, height: -18)
NSGraphicsContext.saveGraphicsState()
shadow.set()
NSColor(calibratedRed: 0.13, green: 0.16, blue: 0.18, alpha: 1).setFill()
circle(322).fill()
NSGraphicsContext.restoreGraphicsState()
for radius in stride(from: CGFloat(180), through: 300, by: 17) {
  let path = circle(radius)
  path.lineWidth = 2
  NSColor.white.withAlphaComponent(0.10).setStroke()
  path.stroke()
}
NSColor(calibratedRed: 0.63, green: 0.73, blue: 0.76, alpha: 1).setFill()
circle(126).fill()
NSColor(calibratedRed: 0.27, green: 0.37, blue: 0.42, alpha: 1).setFill()
circle(14).fill()
let arm = NSBezierPath()
arm.move(to: NSPoint(x: 809, y: 783))
arm.line(to: NSPoint(x: 744, y: 783))
arm.line(to: NSPoint(x: 657, y: 521))
arm.lineWidth = 24
arm.lineJoinStyle = .round
arm.lineCapStyle = .round
NSColor(calibratedRed: 0.88, green: 0.92, blue: 0.92, alpha: 1).setStroke()
arm.stroke()
let cartridge = NSBezierPath(roundedRect: NSRect(x: 628, y: 470, width: 57, height: 72), xRadius: 12, yRadius: 12)
NSColor(calibratedRed: 0.34, green: 0.43, blue: 0.46, alpha: 1).setFill()
cartridge.fill()
NSColor(calibratedRed: 0.32, green: 0.42, blue: 0.46, alpha: 1).setFill()
NSBezierPath(ovalIn: NSRect(x: 783, y: 755, width: 54, height: 54)).fill()
image.unlockFocus()
let data = image.tiffRepresentation!
let bitmap = NSBitmapImageRep(data: data)!
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
