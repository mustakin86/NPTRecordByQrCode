const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyx8nt93QvuwFdSUgd6W-rA4S_NbV-EGhulIPqTcO2gVwjqXy_-0MdDqNdiYOMKORoj/exec';

export const dbAPI = {
  async getRecords(sheetKey, spreadsheetId = '') {
    try {
      let url = `${SCRIPT_URL}?sheet=${encodeURIComponent(sheetKey)}`;
      if (spreadsheetId) {
        url += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      }
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to fetch records');
    } catch (error) {
      console.error('Error fetching records from Google Sheets:', error);
      return [];
    }
  },

  async getProblemCategories() {
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getProblemCategories`);
      const result = await res.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching problem categories:', error);
      return [];
    }
  },

  async saveRecord(sheetKey, recordData, actionType = 'create') {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sheet: sheetKey,
          action: actionType,
          payload: recordData
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to execute action');
      }
      return result;
    } catch (error) {
      console.error('Error sending data to Google Sheets:', error);
      throw error;
    }
  }
};