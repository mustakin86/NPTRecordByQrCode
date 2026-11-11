<template>
  <div class="dashboard-container">
    <!-- Header Controls -->
    <header class="table-header center-header">
      <div class="actions">
        <button class="btn btn-secondary" @click="openScanModal">📷 Scan QR Code</button>
      </div>
    </header>

    <!-- Mobile QR Camera Scanner Modal -->
    <div v-if="showScanModal" class="modal-overlay" @click.self="closeScanModal">
      <div class="modal-content scanner-modal">
        <button type="button" class="btn-close-absolute" @click="closeScanModal">&times;</button>

        <h3>Select Problem & Scan QR</h3>
        <p class="scanner-desc">
          First, choose the problem type. Once selected, click "Proceed to Camera Scan" to activate your camera.
        </p>
        <div class="form-group">
          <label for="problemType">Type of Problem:</label>
          <select id="problemType" v-model="selectedProblemType" class="form-control">
            <option disabled value="">Select problem category...</option>
            <option v-for="category in problemCategories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </div>

        <div class="form-group" v-if="!cameraActive">
          <label for="manpowerInput">Effective Manpower:</label>
          <input id="manpowerInput" v-model.number="effectiveManpower" type="number" min="1" class="select-input"
            placeholder="e.g. 1" />
        </div>

        <button v-if="!cameraActive" type="button" class="btn btn-primary" style="margin-top: 1rem; width: 100%;"
          @click="startCamera">
          Proceed to Camera Scan
        </button>

        <!-- Camera Stream Component -->
        <div v-if="cameraActive">
          <p class="active-problem-badge">Active Problem: <strong>{{ selectedProblemType }}</strong></p>
          <div class="camera-container">
            <qrcode-stream camera="auto" @decode="processScan" @detect="onCameraDetect" @error="onCameraError">
              <div v-if="loadingCamera" class="camera-loading">Loading camera...</div>
            </qrcode-stream>
          </div>
          <button type="button" class="btn btn-secondary" style="width: 100%; margin-bottom: 1rem;"
            @click="cameraActive = false">
            Change Problem Type
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

const HEADERS = ['ID', 'QRcode', 'Type_of_Problem', 'No_of_Effective_Man', 'Start_time', 'End_Time', 'Ttl_Time', 'Remarks', 'Created_Date'];
const SHEET_NAME = 'DailyNPTrecord';

const searchQuery = ref('');
const showScanModal = ref(true); // Opens automatically on page load
const cameraActive = ref(false);
const loadingCamera = ref(false);
const cameraError = ref('');

const problemCategories = ref([]);
const selectedProblemType = ref('');
const effectiveManpower = ref(1);

const records = ref([]);

const fetchProblemCategories = async () => {
  try {
    const data = await dbAPI.getProblemCategories();
    problemCategories.value = data?.categories || [];
  } catch (error) {
    console.error('Failed to fetch problem categories:', error);
    problemCategories.value = ['Machine Problem', 'Material Shortage', 'Quality Issue', 'Power Outage', 'Waiting for Work'];
  }
};

onMounted(async () => {
  showScanModal.value = true;

  try {
    const fetchedData = await dbAPI.getRecords(SHEET_NAME);
    if (fetchedData && fetchedData.length > 0) {
      records.value = fetchedData.reverse();
    }
  } catch (error) {
    console.error('Failed to load records:', error);
  }
  await fetchProblemCategories();
});

const formatDeviceTime = (date = new Date()) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? 12 : hours;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
};

const calculateTTL = (start, end) => {
  if (!start || !end || start === '-' || end === '-') return '-';

  const parse12HourTime = (timeStr) => {
    const parts = timeStr.split(' ');
    if (parts.length < 2) return 0;
    const [time, modifier] = parts;
    let [hours, minutes, seconds] = time.split(':').map(Number);

    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    return (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0);
  };

  const startTotalSeconds = parse12HourTime(start);
  const endTotalSeconds = parse12HourTime(end);

  let diffSeconds = endTotalSeconds - startTotalSeconds;
  if (diffSeconds < 0) diffSeconds += 24 * 3600;

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

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

const onCameraDetect = (detectedCodes) => {
  if (detectedCodes && detectedCodes.length > 0) {
    processScan(detectedCodes[0].rawValue);
  }
};

const onCameraError = (err) => {
  if (err.name === 'NotAllowedError') cameraError.value = 'Camera permission denied.';
  else if (err.name === 'NotFoundError') cameraError.value = 'No camera device found.';
  else cameraError.value = `Camera error: ${err.message}`;
};

const processScan = async (scannedCode) => {
  const code = scannedCode ? scannedCode.trim() : '';
  if (!code) return;

  const now = new Date();

  const activeRecord = records.value.find(
    r => r.QRcode === code && (!r.End_Time || r.End_Time === '-' || r.End_Time === '')
  );

  if (activeRecord) {
    activeRecord.End_Time = formatDeviceTime(now);
    activeRecord.Ttl_Time = calculateTTL(activeRecord.Start_time, activeRecord.End_Time);
    activeRecord.Remarks = 'Resolved';

    try {
      await dbAPI.saveRecord(SHEET_NAME, activeRecord, 'update');
    } catch (error) {
      console.error('Failed to update record:', error);
    }
  } else {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const strictDateStr = `${year}-${month}-${day}`;

    const newEntry = {
      QRcode: code,
      Type_of_Problem: selectedProblemType.value,
      No_of_Effective_Man: effectiveManpower.value,
      Start_time: formatDeviceTime(now),
      End_Time: '',
      Ttl_Time: '-',
      Remarks: 'Scan initiated - awaiting end scan',
      Created_Date: strictDateStr
    };

    try {
      await dbAPI.saveRecord(SHEET_NAME, newEntry, 'create');

      const refreshedData = await dbAPI.getRecords(SHEET_NAME);
      if (refreshedData) {
        records.value = refreshedData.reverse();
      }
    } catch (error) {
      console.error('Failed to create record:', error);
    }
  }

  closeScanModal();
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
  border-radius: 0;
  box-shadow: none;
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
  /* Centers horizontally */
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  width: 100%;
}

.center-header {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.actions {
  display: flex;
  justify-content: center;
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
  width: auto;
  /* Lets the button size naturally based on its text */
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
  max-width: 450px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.scanner-modal {
  max-width: 420px;
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
}

@media (min-width: 640px) {
  .camera-container {
    height: 240px;
  }
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
  width: 100%;
  font-size: 1rem;
  background-color: #fff;
}
</style>