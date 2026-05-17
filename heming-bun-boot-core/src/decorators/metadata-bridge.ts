/**
 * Bridges decorator metadata from field/method decorators to a class decorator
 * in Bun's Stage 3 decorators.
 *
 * In Stage 3, each class element (field, method, etc.) has its own
 * `context.metadata` object inheriting from the class `context.metadata`.
 * Inheritance is one-way (child inherits from parent), so data written by
 * field/method decorators is NOT visible to the class decorator.
 *
 * This utility provides a side-channel: field/method decorators accumulate
 * items during class definition, and the class decorator consumes and
 * transfers them to `Reflect.defineMetadata`.
 *
 * @example
 * // In a shared module (one bridge per metadata symbol):
 * const routeBridge = createMetadataBridge<RouteDefinition>();
 *
 * // In field/method decorator:
 * routeBridge.add(entry);
 *
 * // In class decorator:
 * routeBridge.consume(symbol, target);
 */
export function createMetadataBridge<T>() {
  let _pending: T[] | null = null;

  return {
    /**
     * Accumulate an item from a field/method decorator.
     * Items are consumed in order when the class decorator calls `consume`.
     */
    add(item: T): void {
      if (!_pending) _pending = [];
      _pending.push(item);
    },

    /**
     * Find-or-create: look for an existing item matching the predicate,
     * otherwise create one with the factory and append it.
     * Returns the found or created item for in-place mutation by the caller.
     */
    upsert(predicate: (item: T) => boolean, factory: () => T): T {
      if (!_pending) _pending = [];
      let item = _pending.find(predicate);
      if (!item) {
        item = factory();
        _pending.push(item);
      }
      return item;
    },

    /**
     * Transfer pending items to `Reflect.defineMetadata` on the target class
     * and clear the pending batch. Call exactly once from a class decorator.
     *
     * @returns The number of items transferred, or 0 if there were none.
     */
    consume(symbol: symbol, target: Function): number {
      if (!_pending || _pending.length === 0) return 0;
      const count = _pending.length;
      Reflect.defineMetadata(symbol, _pending, target);
      _pending = null;
      return count;
    },
  } as const;
}
