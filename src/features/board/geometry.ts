import { CARD_BORDER_HEIGHT, CAPTION_HEIGHT } from "./constants";
import type { BoardImage, GroupBounds, ItemRect } from "./types";

export const FRAME_PADDING_X = 28;
export const FRAME_PADDING_TOP = 40;
export const FRAME_PADDING_BOTTOM = 18;

export const getItemHeight = (item: BoardImage) =>
  item.width * item.aspect + CAPTION_HEIGHT + CARD_BORDER_HEIGHT;

export const getItemRect = (item: BoardImage): ItemRect => ({
  left: item.x,
  top: item.y,
  right: item.x + item.width,
  bottom: item.y + getItemHeight(item),
});

export const getGroupBounds = (
  ids: number[],
  images: BoardImage[],
): GroupBounds | null => {
  const selected = images.filter((item) => ids.includes(item.id));
  if (selected.length === 0) {
    return null;
  }

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const item of selected) {
    const rect = getItemRect(item);
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
};

export const getFrameBounds = (
  ids: number[],
  images: BoardImage[],
): GroupBounds | null => {
  const contentBounds = getGroupBounds(ids, images);
  if (!contentBounds) {
    return null;
  }

  return {
    left: contentBounds.left - FRAME_PADDING_X,
    top: contentBounds.top - FRAME_PADDING_TOP,
    width: contentBounds.width + FRAME_PADDING_X * 2,
    height: contentBounds.height + FRAME_PADDING_TOP + FRAME_PADDING_BOTTOM,
  };
};

export const hasSameMembers = (a: number[], b: number[]) => {
  if (a.length !== b.length) {
    return false;
  }

  const bSet = new Set(b);
  return a.every((id) => bSet.has(id));
};
