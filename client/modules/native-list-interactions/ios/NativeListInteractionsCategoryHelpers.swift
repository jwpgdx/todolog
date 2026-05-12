import Foundation

extension NativeListInteractionsView {
  func categoryTrailingValue(for item: NativeItem) -> String? {
    let source = (item.metaText ?? item.subtitle ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !source.isEmpty else {
      return nil
    }

    var digits = ""
    var started = false
    for character in source {
      if character.isNumber {
        digits.append(character)
        started = true
      } else if started {
        break
      }
    }

    if !digits.isEmpty {
      return digits
    }

    return source
  }
}
