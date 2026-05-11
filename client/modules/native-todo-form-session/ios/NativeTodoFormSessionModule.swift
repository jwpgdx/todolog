import ExpoModulesCore

public final class NativeTodoFormSessionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeTodoFormSession")

    View(NativeTodoFormSessionView.self) {
      Prop("detailPlaceholderText") { (view: NativeTodoFormSessionView, text: String?) in
        view.updateDetailPlaceholderText(text)
      }

      Events(
        "onDismiss",
        "onStateSettled"
      )
    }
  }
}
