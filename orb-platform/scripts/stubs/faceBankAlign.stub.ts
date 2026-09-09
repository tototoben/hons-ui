import { DEFAULT_VISITOR_ALIGN, type VisitorAlign } from '../../src/lib/wallMatchPhotobash.ts'

/** Offline render stub — skip MediaPipe landmark alignment. */
export async function computeFaceAlign(
  _image: HTMLImageElement,
  _plateRatio?: number,
): Promise<VisitorAlign> {
  return { ...DEFAULT_VISITOR_ALIGN }
}

export const TARGET_LEFT_EYE = { u: 0.35, v: 0.38 }
export const TARGET_RIGHT_EYE = { u: 0.65, v: 0.38 }
