export type CommentScrollAlign = "start" | "center";

/** Scroll position so `commentEl` aligns within `container` (clamped at list ends). */
export function computeCommentScrollTop(
  container: HTMLElement,
  commentEl: HTMLElement,
  align: CommentScrollAlign
): number {
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
  const containerRect = container.getBoundingClientRect();
  const elRect = commentEl.getBoundingClientRect();

  if (align === "start") {
    const delta = elRect.top - containerRect.top;
    return Math.min(maxScroll, Math.max(0, container.scrollTop + delta));
  }

  const elCenter = elRect.top + elRect.height / 2;
  const containerCenter = containerRect.top + containerRect.height / 2;
  const delta = elCenter - containerCenter;
  return Math.min(maxScroll, Math.max(0, container.scrollTop + delta));
}

export function scrollCommentInContainer(
  container: HTMLElement,
  commentEl: HTMLElement,
  align: CommentScrollAlign,
  behavior: ScrollBehavior = "smooth"
): void {
  const top = computeCommentScrollTop(container, commentEl, align);
  container.scrollTo({ top, behavior });
}
