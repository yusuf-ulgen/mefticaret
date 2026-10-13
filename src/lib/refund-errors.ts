export class RefundOutcomeUnknownError extends Error {
  constructor(
    message = "İade sonucu belirsiz. Sağlayıcı işlemi doğrulanmadan tekrar para iadesi denenmez.",
  ) {
    super(message);
    this.name = "RefundOutcomeUnknownError";
  }
}
export class RefundRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundRejectedError";
  }
}
