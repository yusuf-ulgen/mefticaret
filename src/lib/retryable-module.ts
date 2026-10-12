/** Cache a successful module, not a rejected startup promise. No operation is replayed. */
export function retryableModule<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending)
      pending = Promise.resolve()
        .then(load)
        .catch((error: unknown) => {
          pending = undefined;
          throw error;
        });
    return pending;
  };
}
