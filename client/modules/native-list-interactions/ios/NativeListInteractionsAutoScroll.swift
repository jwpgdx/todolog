import UIKit

final class NativeListInteractionsAutoScroller: NSObject {
  private let activationInset: CGFloat
  private let maxVelocity: CGFloat
  private let onTick: (CADisplayLink) -> Void

  private var velocity: CGFloat = 0
  private var displayLink: CADisplayLink?

  init(
    activationInset: CGFloat,
    maxVelocity: CGFloat,
    onTick: @escaping (CADisplayLink) -> Void
  ) {
    self.activationInset = activationInset
    self.maxVelocity = maxVelocity
    self.onTick = onTick
    super.init()
  }

  deinit {
    stop()
  }

  var currentVelocity: CGFloat {
    velocity
  }

  func update(locationInCollection: CGPoint, bounds: CGRect, isActive: Bool) {
    guard isActive else {
      stop()
      return
    }

    let topTriggerY = bounds.minY + activationInset
    let bottomTriggerY = bounds.maxY - activationInset

    var nextVelocity: CGFloat = 0
    if locationInCollection.y < topTriggerY {
      let progress = min(1, (topTriggerY - locationInCollection.y) / activationInset)
      nextVelocity = -maxVelocity * max(0.18, progress * progress)
    } else if locationInCollection.y > bottomTriggerY {
      let progress = min(1, (locationInCollection.y - bottomTriggerY) / activationInset)
      nextVelocity = maxVelocity * max(0.18, progress * progress)
    }

    if abs(nextVelocity) < 1 {
      stop()
      return
    }

    start(with: nextVelocity)
  }

  func stop() {
    displayLink?.invalidate()
    displayLink = nil
    velocity = 0
  }

  private func start(with nextVelocity: CGFloat) {
    velocity = nextVelocity

    guard displayLink == nil else {
      return
    }

    let link = CADisplayLink(target: self, selector: #selector(handleTick(_:)))
    link.add(to: .main, forMode: .common)
    displayLink = link
  }

  @objc
  private func handleTick(_ displayLink: CADisplayLink) {
    onTick(displayLink)
  }
}
