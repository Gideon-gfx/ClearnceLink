// Reads a picked file (file:// or content:// uri) as base64. Uses fetch, which works for every kind of picker uri and
// does not depend on the file-system module's older read functions.
export async function readFileAsBase64(uri: string): Promise<string> {
  try {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        const base64 = result.split(',')[1];
        if (base64) resolve(base64);
        else reject(new Error('The file is empty.'));
      };
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(blob);
    });
  } catch (cause) {
    throw new Error(cause?.message === 'The file is empty.' ? cause.message : 'Could not read the selected file. Please pick it again.');
  }
}
