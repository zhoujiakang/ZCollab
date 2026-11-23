import { apiUpload } from './client';

export function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  return apiUpload<{ url: string; size: string; contentType: string }>('/file/upload', form)
    .then(({ url }) => ({ url }));
}
