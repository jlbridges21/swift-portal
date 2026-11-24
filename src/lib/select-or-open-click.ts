import type { MouseEvent } from "react";

/**
 * Click handler for a media tile that selects in select mode and opens otherwise.
 * In select mode a double-click opens the item and leaves the selection as it was:
 * the second click (`detail === 2`) undoes the first click's toggle, then opens.
 * Keyboard activation (`detail === 0`) behaves like a single click.
 */
export function selectOrOpenClick(
  e: MouseEvent,
  selectMode: boolean,
  onToggle: () => void,
  onOpen: () => void
) {
  if (e.detail > 2) return;
  if (!selectMode) {
    if (e.detail < 2) onOpen();
    return;
  }
  onToggle();
  if (e.detail === 2) onOpen();
}
