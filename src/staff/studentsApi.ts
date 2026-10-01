import { apiBaseUrl, apiRequest } from '../api';
import { downloadAndShare } from '../components/downloadFile';
import { institutionApi } from '../institution/api';

// The institution's Add / Import student screens talk to "/students/..." on the institution API. For a staff member the same
// calls go to "/api/staff/my-students/...", which only ever touches the students that staff member added.
export function staffStudentsApi(token: string) {
  const base = institutionApi(token);
  const request = (path: string, body?: unknown, method?: string) => apiRequest(`/api/staff/my-students${path.replace(/^\/students/, '')}`, body, token, method);
  const downloadTemplate = async (_kind: string, format = 'xlsx') => {
    const mimeType = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    try { await downloadAndShare(`${apiBaseUrl}/api/staff/my-students/template?format=${format}`, `student-import-template.${format}`, token, mimeType); }
    catch { throw new Error('Could not download the template. Check your connection and try again.'); }
  };
  return { ...base, request, downloadTemplate };
}
