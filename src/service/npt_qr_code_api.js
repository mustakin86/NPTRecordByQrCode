const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyx8nt93QvuwFdSUgd6W-rA4S_NbV-EGhulIPqTcO2gVwjqXy_-0MdDqNdiYOMKORoj/exec';

export const dbAPI = {
  // Fetch existing records for the specified sheet tab
  async getRecords(sheetKey) {
    try {
      const response = await fetch(`${SCRIPT_URL}?sheet=${sheetKey}`);
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
    const res = await fetch(`${SCRIPT_URL}?action=getProblemCategories`);
    return await res.json();
  },


  // Save (Create or Delete) record data with sheet context
  async saveRecord(sheetKey, recordData, actionType = 'create') {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Bypasses Apps Script CORS restrictions
        body: JSON.stringify({
          sheet: sheetKey,
          action: actionType, // 'create' or 'delete'
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