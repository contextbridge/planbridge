import type { AnnotationPayload } from '@contextbridge/shared/annotationSchema';

export function handlePayload(payload: AnnotationPayload): Response {
  return Response.json(payload);
}
