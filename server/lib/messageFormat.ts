import type { Content, CoreMessage } from '@shared/types.ts';

type ContentBlockParam = {
  type: 'text';
  text: string;
} | {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
};

/**
 * Local text flow: no Supabase storage — same structure as Edge formatUserMessage
 * but image/mesh context is described in text when assets are not available.
 */
export async function formatUserMessage(
  message: CoreMessage,
  userId: string,
  conversationId: string,
): Promise<{
  role: 'user';
  content: ContentBlockParam[];
}> {
  const parts: ContentBlockParam[] = [];
  const c: Content = message.content;

  if (c.text) {
    parts.push({ type: 'text', text: c.text });
  }

  if (c.error) {
    parts.push({
      type: 'text',
      text: `The OpenSCAD code generated has failed to compile and has given the following error, fix any syntax, logic, parameter, library, or other issues: ${c.error}`,
    });
  }

  if (c.images?.length) {
    parts.push({
      type: 'text',
      text: `User uploaded ${c.images.length} reference image(s) with IDs: ${c.images.join(', ')} (storage not available in local mode — use textual description if needed). Path would be: ${userId}/${conversationId}/<id>`,
    });
  }

  if (c.mesh && c.meshBoundingBox) {
    const bbox = c.meshBoundingBox;
    const filename = c.meshFilename || 'model.stl';
    const modelHeight = bbox.y;
    const modelWidth = bbox.x;
    const modelDepth = bbox.z;
    const instruction = `User uploaded a 3D model (STL file): "${filename}"
**MODEL DIMENSIONS (CRITICAL FOR POSITIONING):**
- Width (X): ${modelWidth.toFixed(1)}mm
- Height (Z after rotation): ${modelHeight.toFixed(1)}mm
- Depth (Y after rotation): ${modelDepth.toFixed(1)}mm
The model is CENTERED at origin. After rotation:
- TOP of model is at Z = +${(modelHeight / 2).toFixed(1)}mm
- BOTTOM of model is at Z = -${(modelHeight / 2).toFixed(1)}mm
YOU MUST USE import("${filename}") TO INCLUDE THE USER'S MODEL.`;

    parts.push({ type: 'text', text: instruction });
  } else if (c.mesh) {
    parts.push({
      type: 'text',
      text: `User uploaded a 3D mesh file (ID: ${c.mesh.id}, type: ${c.mesh.fileType}) — local mode: no preview image from storage.`,
    });
  }

  return { role: 'user', content: parts };
}
