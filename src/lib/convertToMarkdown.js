export const MAX_CONVERT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const getJsonErrorMessage = async (response) => {
  try {
    const payload = await response.json();
    if (payload?.error) return payload.error;
  } catch {
    // Ignore JSON parse errors and fall back to status text below.
  }
  return response.statusText || 'Unable to convert this file.';
};

export const convertDocumentFileToMarkdown = async (file) => {
  if (!(file instanceof File)) {
    throw new Error('Please choose a file first.');
  }

  if (file.size > MAX_CONVERT_FILE_SIZE_BYTES) {
    throw new Error('Please choose a file smaller than 10MB.');
  }

  const response = await fetch('/api/convert', {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name || 'document'),
      'x-file-size': String(file.size || 0),
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(await getJsonErrorMessage(response));
  }

  const payload = await response.json();
  if (!payload?.markdown) {
    throw new Error(payload?.error || 'The converter did not return any markdown.');
  }

  return payload.markdown;
};
