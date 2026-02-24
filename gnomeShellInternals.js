/** @param {{ _windows?: WindowPreview[] } | null | undefined} workspace */
export function getLatestWorkspacePreview(workspace) {
  const windows = workspace?._windows;
  if (!Array.isArray(windows) || windows.length === 0) return null;
  return windows[windows.length - 1] ?? null;
}

/** @param {SwitcherPopup | null | undefined} popup */
export function getSwitcherItems(popup) {
  const buckets = [
    popup?._items,
    popup?._appIcons,
    popup?._windowIcons,
    popup?._switcherList?._items,
  ];

  /** @type {SwitcherItem[]} */
  const items = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    items.push(...bucket);
  }

  return items;
}

/** @param {unknown} item */
export function getMetaWindowFromSwitcherItem(item) {
  const switcherItem = /** @type {SwitcherItem | null | undefined} */ (item);
  if (!switcherItem) return null;

  return (
    switcherItem.window ??
    switcherItem.metaWindow ??
    switcherItem._window ??
    switcherItem.app?.get_windows?.()?.[0] ??
    switcherItem._app?.get_windows?.()?.[0] ??
    null
  );
}

/** @param {unknown} item */
export function getStyledSwitcherWidget(item) {
  const switcherItem = /** @type {SwitcherItem | null | undefined} */ (item);
  if (!switcherItem) return null;

  if (typeof switcherItem.set_style === "function") return switcherItem;

  const actor = /** @type {{ set_style?: (s: string) => void } | undefined} */ (
    /** @type {{ actor?: unknown }} */ (switcherItem).actor
  );
  if (typeof actor?.set_style !== "function") return null;
  return actor;
}

/** @param {WindowPreview} preview */
export function getPreviewMetaWindow(preview) {
  const previewWithMeta = /** @type {{ metaWindow?: MetaWindow }} */ (preview);
  return previewWithMeta.metaWindow ?? null;
}

/** @param {object | null | undefined} overview */
export function getOverviewWindowPreviews(overview) {
  const overviewMap =
    /** @type {Record<string, unknown> | null | undefined} */ (overview);
  const shellOverview = /** @type {Record<string, unknown> | undefined} */ (
    overviewMap?._overview
  );
  const controls = /** @type {Record<string, unknown> | undefined} */ (
    shellOverview?._controls
  );
  const workspacesDisplay = /** @type {Record<string, unknown> | undefined} */ (
    controls?._workspacesDisplay
  );
  if (!workspacesDisplay) return [];

  const workspacesViews = workspacesDisplay._workspacesViews;
  if (!Array.isArray(workspacesViews)) return [];

  /** @type {WindowPreview[]} */
  const previews = [];

  for (const view of workspacesViews) {
    const workspaces = view?._workspaces;
    if (!Array.isArray(workspaces)) continue;

    for (const workspace of workspaces) {
      const windows = workspace?._windows;
      if (!Array.isArray(windows)) continue;
      previews.push(...windows);
    }
  }

  return previews;
}
