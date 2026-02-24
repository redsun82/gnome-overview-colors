export class PatchManager {
  constructor() {
    /** @type {Array<() => void>} */
    this._revertFns = [];
  }

  /**
   * @param {object | null | undefined} target
   * @param {string} methodName
   * @param {(original: Function) => Function} patchFactory
   * @returns {boolean}
   */
  patchMethod(target, methodName, patchFactory) {
    if (!target) return false;

    const targetMap = /** @type {Record<string, unknown>} */ (target);
    const original = targetMap[methodName];
    if (typeof original !== "function") return false;

    const replacement = patchFactory(original);
    targetMap[methodName] = replacement;
    this._revertFns.push(() => {
      targetMap[methodName] = original;
    });

    return true;
  }

  restoreAll() {
    for (let i = this._revertFns.length - 1; i >= 0; i--) {
      this._revertFns[i]();
    }
    this._revertFns = [];
  }
}
