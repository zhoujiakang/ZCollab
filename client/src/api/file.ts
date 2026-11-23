import { apiUpload } from './client';

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  contentType: string;
  kind: 'image' | 'attachment';
}

interface UploadPayload extends Omit<UploadResult, 'size'> {
  size: number | string;
}

export function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  return apiUpload<UploadPayload>('/file/upload', form).then((payload) => ({
    ...payload,
    size: Number(payload.size) || 0,
  }));
}
