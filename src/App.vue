<template>
  <div class="dashboard-container">
    <!-- Header Controls -->
    <header class="table-header center-header">
      <div class="actions">
        <button type="button" class="btn btn-primary" @click.prevent="openScanModal">📷 Scan QR Code</button>
      </div>
    </header>

    <!-- Data Table Display -->
    <!-- <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th v-for="header in HEADERS" :key="header">{{ formatHeader(header) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredRecords" :key="record.ID">
            <td v-for="header in HEADERS" :key="header">
              <span v-if="header === 'QRcode'" class="badge badge-code">{{ record[header] }}</span>
              <span v-else-if="header === 'Type_of_Problem'" class="badge badge-problem">{{ record[header] }}</span>
              <span v-else-if="header === 'Ttl_Time'" class="badge badge-ttl">{{ record[header] }}</span>
              <span v-else>{{ record[header] || '-' }}</span>
            </td>
          </tr>
          <tr v-if="filteredRecords.length === 0">
            <td :colspan="HEADERS.length" class="no-data">No records found. Click "Scan QR Code" to log an issue.</td>
          </tr>
        </tbody>
      </table>
    </div> -->

    <!-- Mobile QR Camera Scanner Modal -->
    <div v-if="showScanModal" class="modal-overlay" @click.self="closeScanModal">
      <div class="modal-content scanner-modal" @click.stop>
        <button type="button" class="btn-close-absolute" @click.prevent="closeScanModal">&times;</button>

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

        <button v-if="!cameraActive" type="button" class="btn btn-primary" style="margin-top: 1rem; width: 100%;"
          @click.prevent="startCamera">
          Proceed to Camera Scan
        </button>

        <!-- Camera Stream Component -->
        <div v-if="cameraActive">
          <p class="active-problem-badge">
            Device User: <strong>{{ operatorName }}</strong> | Mode: <strong>{{ selectedTimeRange === 'start' ?
              'Start_Time' : 'End_Time' }}</strong>
          </p>
          <div class="camera-container">
            <qrcode-stream :constraints="{ facingMode: 'environment' }" @decode="processScan" @detect="onDetect"
              @error="onCameraError">

              <!-- Professional Scanner Viewfinder Overlay -->
              <div class="scanner-overlay-ui">
                <div class="viewfinder-box">
                  <div class="laser-line"></div>
                </div>
                <div class="scanner-instruction">Place the code inside the frame</div>
              </div>

              <div v-if="loadingCamera" class="camera-loading">Loading camera...</div>
            </qrcode-stream>
          </div>
          <button type="button" class="btn btn-secondary" style="width: 100%; margin-bottom: 1rem;"
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

const HEADERS = ['ID', 'QRcode', 'Type_of_Problem', 'No_of_Effective_Man', 'Start_time', 'End_Time', 'Duration_time', 'Ttl_Time', 'Device_Name', 'User_Name', 'Status', 'Created_Date'];
const SHEET_NAME = 'DailyNPTrecord';

const searchQuery = ref('');
const showScanModal = ref(false);
const cameraActive = ref(false);
const loadingCamera = ref(false);
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

const formatDeviceTime = (date = new Date()) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
};

const parseMinutesFrom12h = (timeStr) => {
  if (!timeStr || timeStr === '-') return 0;
  const [timePart, modifier] = timeStr.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);

  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  return (hours * 60) + minutes;
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
        r => r.QRcode === code && (!r.End_Time || r.End_Time === '-' || r.End_Time === '')
      );

      if (!activeRecord) {
        alert('No active running record found with this QR code to end.');
        isProcessing.value = false; // Fixed: reset processing lock
        return;
      }

      activeRecord.End_Time = formatDeviceTime(now);
      activeRecord.Status = 'Resolved';
      activeRecord.User_Name = operatorName.value;

      const startMins = parseMinutesFrom12h(activeRecord.Start_time);
      const endMins = parseMinutesFrom12h(activeRecord.End_Time);
      let diffMins = endMins - startMins;
      if (diffMins < 0) diffMins += 24 * 60;

      const effectiveMan = Number(activeRecord.No_of_Effective_Man) || 1;
      activeRecord.Duration_time = `${diffMins} mins`;
      activeRecord.Ttl_Time = `${effectiveMan * diffMins} mins`;

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
        User_Name: operatorName.value,
        Status: 'Scan initiated - awaiting end scan',
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
  if (!searchQuery.value) return records.value;
  const q = searchQuery.value.toLowerCase();
  return records.value.filter(record =>
    Object.values(record).some(val => String(val).toLowerCase().includes(q))
  );
});
</script>

<style scoped>
.dashboard-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-width: 100%;
  margin: 0;
  padding: 0.75rem;
  background: #ffffff;
}

@media (min-width: 768px) {
  .dashboard-container {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
}

.table-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  width: 100%;
}

.search-bar-container {
  width: 100%;
}

.search-input {
  padding: 0.6rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
  font-size: 1rem;
  width: 100%;
}

.actions {
  display: flex;
  justify-content: center;
  width: 100%;
}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

th,
td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

th {
  background-color: #f9fafb;
  color: #374151;
  font-weight: 600;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
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
  background: #f3f4f6;
  color: #1f2937;
  font-family: monospace;
  font-weight: 600;
}

.no-data {
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-size: 1rem;
  text-align: center;
}

.btn-primary {
  background-color: #2563eb;
  color: #ffffff;
  width: 100%;
}

.btn-secondary {
  background-color: #e5e7eb;
  color: #374151;
  width: 100%;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  position: relative;
  background: white;
  padding: 1.25rem;
  border-radius: 12px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.btn-close-absolute {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  font-weight: bold;
  color: #6b7280;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  line-height: 1;
  border-radius: 4px;
}

.btn-close-absolute:hover {
  background-color: #f3f4f6;
  color: #1f2937;
}

.scanner-desc {
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 1rem;
  padding-right: 1.5rem;
  line-height: 1.4;
}

.active-problem-badge {
  font-size: 0.85rem;
  color: #1f2937;
  margin-bottom: 0.5rem;
  background: #f3f4f6;
  padding: 0.5rem;
  border-radius: 6px;
  text-align: center;
}

.camera-container {
  width: 100%;
  height: 280px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Scanner Viewfinder Styles */
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
  width: 200px;
  height: 200px;
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
  0% {
    top: 0%;
  }

  50% {
    top: 98%;
  }

  100% {
    top: 0%;
  }
}

.scanner-instruction {
  color: #ffffff;
  font-size: 0.8rem;
  margin-top: 1rem;
  background: rgba(0, 0, 0, 0.6);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
}

.camera-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffffff;
  font-size: 0.9rem;
}

.error-text {
  color: #dc2626;
  font-size: 0.85rem;
  margin-bottom: 1rem;
  text-align: center;
}

.form-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 0.875rem;
  margin-bottom: 0.35rem;
  color: #374151;
  font-weight: 500;
}

.form-group input,
.form-control,
.select-input {
  padding: 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  width: 95%;
  font-size: 1rem;
  background-color: #fff;
}
</style>