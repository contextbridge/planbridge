import type { AnnotationPayload } from '@contextbridge/shared/annotationSchema';

export function handleAsset(payload: AnnotationPayload, id: string): Response {
  const asset = payload.assets?.find((candidate) => candidate.id === id);
  if (!asset) {
    return new Response(null, { status: 404 });
  }

  return new Response(Buffer.from(asset.dataBase64, 'base64'), {
    headers: {
      'content-type': asset.mimeType,
      'cache-control': 'no-store',
    },
  });
}
