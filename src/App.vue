<template>
  <div class="dashboard-container">
    <!-- Header Controls -->
    <header class="dashboard-top-header">
      <!-- Left: Active Device Badge -->
      <div class="top-left-device-badge">
        <span class="device-dot"></span> 
        <button type="button" class="left-device-badge" @click.prevent="openScanModal">
          Scan QR Code
        </button>
      </div>
      
      <!-- Right: Combined Device Filter Badge & Scan Button -->
      <div class="header-right-toolbar">
        <button 
          type="button" 
          class="top-left-device-badge filter-clickable-badge" 
          :class="{ inactive: !filterByCurrentDevice }" 
          @click="filterByCurrentDevice = !filterByCurrentDevice"
          title="Click to toggle device filter"
        >
          <span class="device-dot" :class="{ 'dot-inactive': !filterByCurrentDevice }"></span> 
          Active Device: <strong>{{ operatorName }}</strong>
          <span class="filter-status-text">({{ filterByCurrentDevice ? 'Filtered' : 'All Devices' }})</span>
        </button>
      </div>
    </header>

    <!-- Tab Navigation -->
    <div class="tabs-container">
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'records' }" 
        @click="activeTab = 'records'"
      >Daily NPT Records
      </button>
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'summary' }" 
        @click="activeTab = 'summary'"
      >Summary Report
      </button>
    </div>

    <!-- Excel Sheet 1: Daily NPT Records -->
    <div v-if="activeTab === 'records'" class="excel-sheet-wrapper">
      <table class="excel-table">
        <thead>
          <tr>
            <th class="row-index-header">#</th>
            <th v-for="header in HEADERS" :key="header">{{ formatHeader(header) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(record, index) in filteredRecords" :key="record.ID || index">
            <td class="row-index-cell">{{ index + 1 }}</td>
            <td v-for="header in HEADERS" :key="header">
              <span v-if="header === 'QRcode'" class="badge badge-code">{{ record[header] }}</span>
              <span v-else-if="header === 'Type_of_Problem'" class="badge badge-problem">{{ record[header] }}</span>
              <span v-else-if="header === 'Ttl_Time'" class="badge badge-ttl">{{ record[header] }}</span>
              <span v-else>{{ record[header] || '-' }}</span>
            </td>
          </tr>
          <tr v-if="filteredRecords.length === 0">
            <td :colspan="HEADERS.length + 1" class="no-data">No records found for {{ operatorName }}. Click "Scan QR Code" to log an issue.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Excel Sheet 2: Summary Report -->
    <div v-if="activeTab === 'summary'" class="summary-tab-content">
      <!-- Summary Data Table -->
      <div class="excel-sheet-wrapper" style="margin-top: 1rem;">
        <table class="excel-table">
          <thead>
            <tr>
              <th class="row-index-header">#</th>
              <th v-for="header in SUMMARY_HEADERS" :key="header">{{ formatHeader(header) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in filteredSummaryRecords" :key="item.ID || item.Type_of_Problem || index">
              <td class="row-index-cell">{{ index + 1 }}</td>
              <td v-for="header in SUMMARY_HEADERS" :key="header">
                <span :class="{'badge badge-problem': header === 'Type_of_Problem'}">{{ item[header] || '-' }}</span>
              </td>
            </tr>
            <tr v-if="filteredSummaryRecords.length === 0">
              <td :colspan="SUMMARY_HEADERS.length + 1" class="no-data">No summary data available for this device.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile QR Camera Scanner Modal -->
    <div v-if="showScanModal" class="modal-overlay" @click.self="closeScanModal">
      <div class="modal-content scanner-modal" @click.stop>
        <button type="button" class="btn-close-absolute" @click.prevent="closeScanModal">&times;</button>
        
        <div class="top-left-device-badge modal-corner-badge">
          <span class="device-dot"></span> Active Device: <strong>{{ operatorName }}</strong>
        </div>

        <h3>Select Problem & Scan QR</h3>

        <div class="form-group">
          <label for="problemType">Type of Problem:</label>
          <select id="problemType" v-model="selectedProblemType" class="form-control">
            <option disabled value="">Select problem category...</option>
            <option v-for="category in problemCategories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="timeRange">Time Action:</label>
          <select id="timeRange" v-model="selectedTimeRange" class="form-control">
            <option value="start">Start Time</option>
            <option value="end">End Time</option>
          </select>
        </div>

        <div class="form-group" v-if="!cameraActive">
          <label for="manpowerInput">Effective Manpower:</label>
          <input id="manpowerInput" v-model.number="effectiveManpower" type="number" min="1" class="select-input"
            placeholder="e.g. 1" />
        </div>

        <button v-if="!cameraActive" type="button" class="btn btn-primary" style="margin-top: 0.5rem; width: 100%;"
          @click.prevent="startCamera">
          Proceed to Camera Scan
        </button>

        <!-- Camera Stream Component -->
        <div v-if="cameraActive">
          <div class="camera-container">
            <qrcode-stream 
              :constraints="{ facingMode: 'environment' }" 
              @detect="onDetect"
              @error="onCameraError"
            >
              <!-- Professional Scanner Viewfinder Overlay -->
              <div class="scanner-overlay-ui">
                <div class="viewfinder-box">
                  <div class="laser-line"></div>
                </div>
                <div class="scanner-instruction">Place the code inside the frame</div>
              </div>
            </qrcode-stream>
          </div>
          <button type="button" class="btn btn-secondary" style="width: 100%; margin-bottom: 0.5rem;"
            @click.prevent="cameraActive = false">
            Change Options
          </button>
        </div>

        <p v-if="cameraError" class="error-text">{{ cameraError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { QrcodeStream } from 'vue-qrcode-reader';
import { dbAPI } from '@/service/npr_qr_code_api';

const HEADERS = [ 'QRcode', 'Type_of_Problem', 'No_of_Effective_Man', 'Start_time', 'End_Time', 'Duration_time', 'Ttl_Time', 'Device_Name', 'Status', 'Created_Date'];
const SUMMARY_HEADERS = ['Type_of_Problem', 'Total_Incidents', 'Total_Duration', 'Total_Ttl_Time', 'Device_Name'];
const SHEET_NAME = 'DailyNPTrecord';
const SUMMARY_SHEET_NAME = 'SummaryReport';

const activeTab = ref('records');
const searchQuery = ref('');
const filterByCurrentDevice = ref(true);
const showScanModal = ref(false);
const cameraActive = ref(false);
const cameraError = ref('');
const isProcessing = ref(false);

const problemCategories = ref([]);
const selectedProblemType = ref('');
const selectedTimeRange = ref('start');
const effectiveManpower = ref(1);

const getMobileBrandName = () => {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return "Apple iPhone";
  if (/ipad/i.test(ua)) return "Apple iPad";
  if (/samsung/i.test(ua) || /sm-/i.test(ua)) return "Samsung Device";
  if (/pixel/i.test(ua)) return "Google Pixel";
  if (/xiaomi|redmi/i.test(ua)) return "Xiaomi Device";
  if (/oppo/i.test(ua)) return "Oppo Device";
  if (/vivo/i.test(ua)) return "Vivo Device";
  if (/huawei/i.test(ua)) return "Huawei Device";
  if (/android/i.test(ua)) return "Android Phone";
  if (/windows/i.test(ua)) return "Windows PC";
  if (/mac/i.test(ua)) return "Mac";
  return "Mobile Terminal";
};

const operatorName = ref(getMobileBrandName());
const records = ref([]);
const summaryRecords = ref([]);

const formatDeviceTime = (date = new Date()) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
};

const parseTotalSecondsFrom12h = (timeStr) => {
  if (!timeStr || timeStr === '-') return 0;
  const [timePart, modifier] = timeStr.split(' ');
  let [hours, minutes, seconds] = timePart.split(':').map(Number);

  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  return (hours * 3600) + (minutes * 60) + (seconds || 0);
};

const fetchProblemCategories = async () => {
  try {
    const data = await dbAPI.getProblemCategories();
    problemCategories.value = data?.categories || [];
  } catch (error) {
    console.error('Failed to fetch problem categories:', error);
  }
};

onMounted(async () => {
  try {
    const fetchedData = await dbAPI.getRecords(SHEET_NAME);
    if (fetchedData?.length) records.value = fetchedData.reverse();
  } catch (error) {
    console.error('Failed to load records:', error);
  }

  try {
    const fetchedSummary = await dbAPI.getRecords(SUMMARY_SHEET_NAME);
    if (fetchedSummary?.length) summaryRecords.value = fetchedSummary;
  } catch (error) {
    console.error('Failed to load summary records:', error);
  }

  await fetchProblemCategories();
});

const openScanModal = () => {
  cameraError.value = '';
  cameraActive.value = false;
  showScanModal.value = true;
};

const closeScanModal = () => {
  showScanModal.value = false;
  cameraActive.value = false;
};

const startCamera = () => {
  if (!selectedProblemType.value) {
    cameraError.value = 'Please select a problem type first.';
    return;
  }
  cameraError.value = '';
  cameraActive.value = true;
};

const onCameraError = (err) => {
  if (err.name === 'NotAllowedError') cameraError.value = 'Camera permission denied.';
  else if (err.name === 'NotFoundError') cameraError.value = 'No camera device found.';
  else cameraError.value = `Camera error: ${err.message}`;
};

const onDetect = (detectedCodes) => {
  if (detectedCodes?.length) processScan(detectedCodes[0].rawValue);
};

const processScan = async (scannedCode) => {
  if (isProcessing.value) return;
  const code = scannedCode?.trim();
  if (!code) return;

  isProcessing.value = true;
  const now = new Date();
  cameraActive.value = false;
  showScanModal.value = false;

  try {
    if (selectedTimeRange.value === 'end') {
      const activeRecord = records.value.find(
        r => r.QRcode === code && 
             r.Device_Name === operatorName.value &&
             (!r.End_Time || r.End_Time === '-' || r.End_Time === '')
      );

      if (!activeRecord) {
        alert('No active running record found for this device with this QR code to end.');
        isProcessing.value = false;
        return;
      }

      activeRecord.End_Time = formatDeviceTime(now);
      activeRecord.Status = 'Solved';

      const startSeconds = parseTotalSecondsFrom12h(activeRecord.Start_time);
      const endSeconds = parseTotalSecondsFrom12h(activeRecord.End_Time);
      let diffSeconds = endSeconds - startSeconds;
      if (diffSeconds < 0) diffSeconds += 24 * 3600;

      const effectiveMan = Number(activeRecord.No_of_Effective_Man) || 1;
      activeRecord.Duration_time = `${Math.floor(diffSeconds / 60)} mins`;
      activeRecord.Ttl_Time = `${effectiveMan * Math.floor(diffSeconds / 60)} mins`;

      await dbAPI.saveRecord(SHEET_NAME, activeRecord, 'update');
    } else {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const newEntry = {
        QRcode: code,
        Type_of_Problem: selectedProblemType.value,
        No_of_Effective_Man: effectiveManpower.value,
        Start_time: formatDeviceTime(now),
        End_Time: '-',
        Duration_time: '-',
        Ttl_Time: '-',
        Device_Name: operatorName.value,
        Status: 'Scan initiated - waiting end scan',
        Created_Date: `${year}-${month}-${day}`
      };

      records.value.unshift(newEntry);
      await dbAPI.saveRecord(SHEET_NAME, newEntry, 'create');
    }
  } catch (error) {
    console.error('Failed to process scan action:', error);
  } finally {
    isProcessing.value = false;
  }
};

const formatHeader = (headerKey) => headerKey.replace(/_/g, ' ');

const filteredRecords = computed(() => {
  return records.value.filter(record => {
    const matchesDevice = !filterByCurrentDevice.value || record.Device_Name === operatorName.value;
    const matchesSearch = !searchQuery.value || 
      Object.values(record).some(val => String(val).toLowerCase().includes(searchQuery.value.toLowerCase()));

    return matchesDevice && matchesSearch;
  });
});

const filteredSummaryRecords = computed(() => {
  return summaryRecords.value.filter(record => {
    const matchesDevice = !filterByCurrentDevice.value || 
      record.Device_Name === operatorName.value || 
      !record.Device_Name;

    const matchesSearch = !searchQuery.value || 
      Object.values(record).some(val => String(val).toLowerCase().includes(searchQuery.value.toLowerCase()));

    return matchesDevice && matchesSearch;
  });
});
</script>

<style scoped>
/* আপনার আগের স্টাইলগুলো অপরিবর্তিত রাখা হয়েছে */
.dashboard-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0.5rem;
  background: #f8fafc;
  box-sizing: border-box;
}

@media (min-width: 768px) {
  .dashboard-container {
    max-width: 1300px;
    margin: 1.5rem auto;
    padding: 1.25rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    background: #ffffff;
  }
}

.dashboard-top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
  width: 100%;
  gap: 0.5rem;
}

.top-left-device-badge {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 0.35rem 0.65rem;
  border-radius: 20px;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.left-device-badge {
  background: linear-gradient(90deg, #e90bcf, #ff5c00);
  padding: 0.35rem 0.65rem;
  border-radius: 20px;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  color: #fff;
  border: none;
  cursor: pointer;
}

.filter-clickable-badge {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.filter-clickable-badge:hover {
  background: #dbeafe;
  border-color: #93c5fd;
}

.filter-clickable-badge.inactive {
  background: #f1f5f9;
  color: #475569;
  border-color: #cbd5e1;
}

.filter-status-text {
  font-size: 0.7rem;
  opacity: 0.85;
  margin-left: 0.2rem;
}

.header-right-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.modal-corner-badge {
  margin-bottom: 0.75rem;
  display: inline-flex;
}

.device-dot {
  width: 6px;
  height: 6px;
  background-color: #2563eb;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 4px #2563eb;
}

.dot-inactive {
  background-color: #94a3b8;
  box-shadow: none;
}

.tabs-container {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.4rem;
  width: 100%;
}

.tab-btn {
  flex: 1;
  padding: 0.6rem 0.5rem;
  background-color: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-bottom: none;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  color: #475569;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  background-color: #e2e8f0;
  color: #1e293b;
}

.tab-btn.active {
  background-color: #ffffff;
  color: #2563eb;
  border-color: #cbd5e1;
  border-bottom: 2px solid #ffffff;
  margin-bottom: -2px;
}

.excel-sheet-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-height: 65vh;
  overflow-y: auto;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.03);
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
  table-layout: auto;
}

.excel-table th,
.excel-table td {
  padding: 0.55rem 0.75rem;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.excel-table th {
  background-color: #f1f5f9;
  color: #334155;
  font-weight: 700;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: inset 0 -1px 0 #cbd5e1;
}

.row-index-header,
.row-index-cell {
  background-color: #f8fafc;
  color: #64748b;
  text-align: center;
  width: 40px;
  min-width: 40px;
  font-weight: 600;
  border-right: 2px solid #cbd5e1 !important;
}

.excel-table tbody tr:nth-child(even) {
  background-color: #fcfcfd;
}

.excel-table tbody tr:hover {
  background-color: #f1f5f9;
}

.badge {
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-code {
  background: #eff6ff;
  color: #1d4ed8;
  font-family: monospace;
}

.badge-problem {
  background: #fef2f2;
  color: #dc2626;
}

.badge-ttl {
  background: #f1f5f9;
  color: #1f2937;
  font-family: monospace;
  font-weight: 600;
}

.no-data {
  text-align: center;
  color: #64748b;
  padding: 2rem;
  font-style: italic;
}

.btn {
  padding: 0.55rem 0.8rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85rem;
  text-align: center;
  touch-action: manipulation;
}

.btn-primary {
  background-color: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background-color: #1d4ed8;
}

.btn-secondary {
  background-color: #e2e8f0;
  color: #334155;
  width: 100%;
}

.btn-secondary:hover {
  background-color: #cbd5e1;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 0.75rem;
  box-sizing: border-box;
}

.modal-content {
  position: relative;
  background: white;
  padding: 1rem;
  border-radius: 12px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
  max-height: 90vh;
  overflow-y: auto;
}

.btn-close-absolute {
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  font-weight: bold;
  color: #64748b;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  line-height: 1;
  border-radius: 4px;
}

.btn-close-absolute:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}

.camera-container {
  width: 100%;
  height: 240px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 0.75rem;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.scanner-overlay-ui {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.viewfinder-box {
  width: 180px;
  height: 180px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  position: relative;
  box-shadow: 0 0 0 3000px rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
}

.laser-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: #2563eb;
  box-shadow: 0 0 8px #2563eb;
  animation: scanLaser 2s infinite ease-in-out;
}

@keyframes scanLaser {
  0% { top: 0%; }
  50% { top: 98%; }
  100% { top: 0%; }
}

.scanner-instruction {
  color: #ffffff;
  font-size: 0.75rem;
  margin-top: 0.75rem;
  background: rgba(0, 0, 0, 0.6);
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
}

.error-text {
  color: #dc2626;
  font-size: 0.8rem;
  margin-bottom: 0.75rem;
  text-align: center;
}

.form-group {
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.form-group label {
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
  color: #334155;
  font-weight: 500;
}

.form-group input,
.form-control,
.select-input {
  padding: 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  width: 100%;
  font-size: 16px;
  background-color: #fff;
  box-sizing: border-box;
}
</style>