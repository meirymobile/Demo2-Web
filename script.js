let cargoData = [];
let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
});

async function fetchData() {
    try {
        // Cache busting
        const response = await fetch('data.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error('Network response was not ok');

        cargoData = await response.json();

        updateLastUpdated();
        initChart();
        updateStats();
        filterTable();

    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('last-updated').textContent = 'Error: ' + error.message;
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="2" class="error">Failed to load data: ${error.message}</td></tr>`;
    }
}

function updateLastUpdated() {
    const now = new Date();
    document.getElementById('last-updated').textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

function getCounts(data) {
    const approved = data.filter(i => i.status === 'Approved').length;
    const rejected = data.filter(i => i.status === 'Rejected').length;
    const saban = data.filter(i => i.status === 'Saban').length;
    return { approved, rejected, saban };
}

function initChart() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    const { approved, rejected, saban } = getCounts(cargoData);

    const config = {
        type: 'pie',
        data: {
            labels: ['Approved', 'Rejected', 'Saban'],
            datasets: [{
                data: [approved, rejected, saban],
                backgroundColor: [
                    '#2ecc71', // Green for Approved
                    '#e74c3c', // Red for Rejected
                    '#f1c40f'  // Yellow/Orange for Saban
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    };

    if (myChart) {
        myChart.destroy();
    }
    myChart = new Chart(ctx, config);
}

function updateStats() {
    const { approved, rejected, saban } = getCounts(cargoData);
    document.getElementById('count-approved').textContent = approved;
    document.getElementById('count-rejected').textContent = rejected;
    document.getElementById('count-saban').textContent = saban;
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="no-results">No matches found</td></tr>';
        return;
    }

    // Limit to 500 for performance
    const fragment = document.createDocumentFragment();
    data.slice(0, 500).forEach(item => {
        const tr = document.createElement('tr');
        const statusClass = item.status ? item.status.toLowerCase() : '';
        tr.innerHTML = `
            <td>${item.id}</td>
            <td><span class="badge ${statusClass}">${item.status}</span></td>
        `;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
}

function filterTable() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filter = document.getElementById('statusFilter').value;

    const filtered = cargoData.filter(item => {
        const matchesId = item.id.toString().toLowerCase().includes(search);
        const matchesStatus = filter === 'All' || item.status === filter;
        return matchesId && matchesStatus;
    });

    // Show/Hide Clear Button
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        if (search.length > 0) {
            clearBtn.style.display = 'block';
        } else {
            clearBtn.style.display = 'none';
        }
    }

    document.getElementById('stats').textContent = `Showing ${filtered.length} of ${cargoData.length} entries`;
    renderTable(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization ...
    const clearBtn = document.getElementById('clearSearchBtn');
    const searchInput = document.getElementById('searchInput');

    if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            filterTable();
            searchInput.focus();
        });
    }
});

// --- Barcode Scanner Logic ---
let html5QrCode;
let detectedCodes = new Map(); // Store detected codes: { text: { box, timestamp } }
let overlayInterval;

document.addEventListener('DOMContentLoaded', () => {
    const scanBtn = document.getElementById('scanBtn');
    const modal = document.getElementById('scannerModal');
    const closeModal = document.querySelector('.close-modal');

    // Open Scanner
    scanBtn.addEventListener('click', () => {
        modal.classList.add('active');
        startScanner();
    });

    // Close Modal
    closeModal.addEventListener('click', () => {
        stopScanner();
    });

    // Close on click outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            stopScanner();
        }
    });
});

// Shared Scanner Config
const scannerConfig = {
    formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.PDF_417,
        Html5QrcodeSupportedFormats.AZTEC,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.MAXICODE
    ],
    verbose: false,
    experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
    }
};

let availableCameras = [];
let currentCameraIndex = 0;

function updateCameraLabel() {
    const labelEl = document.getElementById('cameraName');
    if (labelEl && availableCameras.length > 0) {
        labelEl.textContent = availableCameras[currentCameraIndex].label || `Camera ${currentCameraIndex + 1}`;
    }
}

function startScanner() {
    // Simplified config - REMOVED qrbox to allow full scanning
    const config = {
        fps: 20,
        aspectRatio: 1.0,
        verbose: true // Enabled for debug
    };

    if (!html5QrCode) {
        // Use shared config with ALL formats
        html5QrCode = new Html5Qrcode("reader", scannerConfig);
    }

    // Clear old overlays
    detectedCodes.clear();
    const overlay = document.getElementById('scannerOverlay');
    if (overlay) overlay.innerHTML = '';

    // DEBUG: Create Debug Element
    let debugEl = document.getElementById('debug-info');
    if (!debugEl) {
        debugEl = document.createElement('div');
        debugEl.id = 'debug-info';
        debugEl.style.position = 'absolute';
        debugEl.style.top = '10px';
        debugEl.style.left = '10px';
        debugEl.style.background = 'rgba(0,0,0,0.7)';
        debugEl.style.color = '#0f0';
        debugEl.style.padding = '5px';
        debugEl.style.fontSize = '12px';
        debugEl.style.zIndex = '9999';
        debugEl.style.pointerEvents = 'none';
        document.getElementById('reader-container').appendChild(debugEl);
    }
    debugEl.innerHTML = "Scanner Started... Waiting for code.";

    // Start Cleanup Loop
    overlayInterval = setInterval(cleanupOverlays, 200);

    Html5Qrcode.getCameras().then(devices => {
        // ... (rest of start logic) ...
        if (devices && devices.length) {
            availableCameras = devices;

            // Try to find back camera for initial load if not set
            if (availableCameras.length > 1) {
                const backCamIndex = availableCameras.findIndex(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment'));
                if (backCamIndex !== -1) {
                    currentCameraIndex = backCamIndex;
                } else {
                    currentCameraIndex = availableCameras.length - 1;
                }
            } else {
                currentCameraIndex = 0;
            }

            // Update Label
            updateCameraLabel();

            // Show/Hide Switch Button
            const switchBtn = document.getElementById('switchCameraBtn');
            if (switchBtn) {
                switchBtn.style.display = availableCameras.length > 1 ? 'block' : 'none';
            }

            const cameraId = availableCameras[currentCameraIndex].id;

            html5QrCode.start(
                cameraId,
                config,
                onScanDetected,
                onScanFailure
            ).catch(err => {
                console.error("Error starting scanner", err);
                alert("Error starting camera: " + err);
                stopScanner();
            });
        }
        // ...
    }).catch(err => {
        // ...
    });
}
// Note: Partial replacement of startScanner to inject debugEl

// New Logic: Track detected codes and draw boxes
function onScanDetected(decodedText, decodedResult) {
    // DEBUG OUTPUT
    const debugEl = document.getElementById('debug-info');
    const box = decodedResult.result.box || decodedResult.result.boundingBox;

    if (debugEl) {
        debugEl.innerHTML = `
            Detected: ${decodedText}<br>
            Format: ${decodedResult.result.format ? decodedResult.result.format.formatName : 'N/A'}<br>
            Box: ${box ? JSON.stringify(box) : 'MISSING'}<br>
            Time: ${new Date().toLocaleTimeString()}
        `;
    }

    // We do NOT stop scanning. We just track the code.
    const now = Date.now();
    detectedCodes.set(decodedText, {
        text: decodedText,
        result: decodedResult,
        timestamp: now
    });

    renderScanBoxes();
}

function cleanupOverlays() {
    const now = Date.now();
    // Remove old codes (> 500ms)
    for (const [key, value] of detectedCodes.entries()) {
        if (now - value.timestamp > 500) {
            detectedCodes.delete(key);
        }
    }
    renderScanBoxes();
}

function renderScanBoxes() {
    const overlay = document.getElementById('scannerOverlay');
    if (!overlay) return;

    // We need the video source dimensions to map coordinates
    // Html5Qrcode video element
    const videoElement = document.querySelector('#reader video');
    if (!videoElement) return;

    // Physical dimensions of the video on screen
    const displayWidth = videoElement.clientWidth;
    const displayHeight = videoElement.clientHeight;

    // Internal dimensions of the video stream
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    if (!videoWidth || !videoHeight) return;

    // Scaling factors
    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;

    // Simple Re-render
    overlay.innerHTML = '';

    const debugEl = document.getElementById('debug-info');

    detectedCodes.forEach((data, text) => {
        const box = data.result.result.box || data.result.result.boundingBox;
        if (!box) {
            if (debugEl) debugEl.innerHTML += "<br>WARN: Box missing for " + text;
            return;
        }

        // Coordinates are usually relative to the video stream size.

        const x = box.x * scaleX;
        const y = box.y * scaleY;
        const w = box.width * scaleX;
        const h = box.height * scaleY;

        const el = document.createElement('div');
        el.className = 'scan-box';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;

        // Add click listener
        el.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent modal close or other clicks
            processScanResult(text);
        });

        overlay.appendChild(el);
    });
}

function processScanResult(decodedText) {
    // This is the actual "Success" action
    console.log(`User selected: ${decodedText}`);

    // Update search field
    const searchInput = document.getElementById('searchInput');
    searchInput.value = decodedText;

    // Trigger filter
    filterTable();

    // Add to scanned list
    addToScannedList(decodedText);

    // Beep?
    // Stop scanner and close modal
    stopScanner();
}

let scannedItems = [];

function addToScannedList(barcode) {
    // Find item in cargoData
    const item = cargoData.find(i => i.id.toString() === barcode.toString());

    // Create entry
    const entry = {
        barcode: barcode,
        id: item ? item.id : barcode,
        status: item ? item.status : 'Not Found',
        notes: '',
        timestamp: new Date().toISOString()
    };

    scannedItems.push(entry);
    renderScannedList();
}

function renderScannedList() {
    const tbody = document.getElementById('scannedTableBody');
    tbody.innerHTML = '';

    scannedItems.forEach((item, index) => {
        const tr = document.createElement('tr');

        let statusClass = '';
        if (item.status === 'Approved') statusClass = 'approved';
        else if (item.status === 'Rejected') statusClass = 'rejected';
        else if (item.status === 'Saban') statusClass = 'saban';
        else statusClass = 'error'; // For Not Found

        tr.innerHTML = `
            <td>${item.id}</td>
            <td><span class="badge ${statusClass}">${item.status}</span></td>
            <td>
                <button class="options-btn" onclick="openNoteModal(${index})" title="Edit Note">
                    ⋮
                </button>
                <button class="delete-btn" onclick="deleteScannedItem(${index})" title="Delete">
                    🗑️
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function onScanFailure(error) {
    // console.warn(`Code scan error = ${error}`);
}

function deleteScannedItem(index) {
    if (confirm('Are you sure you want to delete this item?')) {
        scannedItems.splice(index, 1);
        renderScannedList();
    }
}

// --- Notes & Sharing Logic ---
let currentNoteIndex = -1;

function openNoteModal(index) {
    currentNoteIndex = index;
    const modal = document.getElementById('noteModal');
    const noteInput = document.getElementById('noteInput');
    noteInput.value = scannedItems[index].notes || '';
    modal.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    // ... existing event listeners ...

    // Note Modal
    const noteModal = document.getElementById('noteModal');
    const closeNoteBtn = document.querySelector('.close-note-modal');
    const saveNoteBtn = document.getElementById('saveNoteBtn');

    closeNoteBtn.addEventListener('click', () => {
        noteModal.classList.remove('active');
    });

    saveNoteBtn.addEventListener('click', () => {
        if (currentNoteIndex > -1) {
            const noteInput = document.getElementById('noteInput');
            scannedItems[currentNoteIndex].notes = noteInput.value;
            noteModal.classList.remove('active');
            // Optional: visual feedback that note is saved?
        }
    });

    // Share & Download
    document.getElementById('shareBtn').addEventListener('click', shareList);
    document.getElementById('downloadBtn').addEventListener('click', exportCSV);

    // Close note modal on outside click
    window.addEventListener('click', (event) => {
        if (event.target === noteModal) {
            noteModal.classList.remove('active');
        }
    });

    // Toggle Main List
    const toggleListBtn = document.getElementById('toggleListBtn');
    const tableContainer = document.querySelector('.table-container tbody').parentElement.parentElement; // Getting .table-container
    // actually, let's target the table body or the container itself.
    // The user said "collapse the cargo list".
    // Let's toggle the table body visibility or the whole container depending on UX.
    // Let's do the container to save space.

    toggleListBtn.addEventListener('click', () => {
        const tableBody = document.getElementById('tableBody');
        const icon = document.getElementById('toggleIcon');

        if (tableBody.style.display === 'none') {
            tableBody.style.display = '';
            // Change icon to Up (Collapse)
            icon.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';
        } else {
            tableBody.style.display = 'none';
            // Change icon to Down (Expand)
            icon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
        }
    });

    // --- OCR Logic ---
    // --- OCR & Image Scan Logic ---
    const ocrBtn = document.getElementById('ocrBtn');
    const ocrInput = document.getElementById('ocrInput');
    const scanImgBtn = document.getElementById('scanImgBtn');
    const scanImgInput = document.getElementById('scanImgInput');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Crop Elements
    const cropModal = document.getElementById('cropModal');
    const imageToCrop = document.getElementById('imageToCrop');
    const confirmCropBtn = document.getElementById('confirmCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    let cropper = null;
    let currentScanMode = 'ocr'; // 'ocr' or 'barcode'

    function handleFileSelect(event, mode) {
        currentScanMode = mode;
        const file = event.target.files[0];
        if (!file) return;

        // Common Cropper Init Logic
        const reader = new FileReader();
        reader.onload = (e) => {
            imageToCrop.src = e.target.result;
            cropModal.classList.add('active');

            // Update button text based on mode
            confirmCropBtn.textContent = mode === 'ocr' ? 'Scan Text' : 'Scan Barcode';

            if (cropper) cropper.destroy();
            setTimeout(() => {
                cropper = new Cropper(imageToCrop, {
                    viewMode: 1,
                    movable: true,
                    zoomable: true,
                    rotatable: true,
                    scalable: true,
                    autoCropArea: 0.8,
                });
            }, 100);
        };
        reader.readAsDataURL(file);
        // Reset input
        event.target.value = '';
    }

    if (scanImgBtn && scanImgInput) {
        scanImgBtn.addEventListener('click', () => scanImgInput.click());
        scanImgInput.addEventListener('change', (e) => handleFileSelect(e, 'barcode'));
    }

    if (ocrBtn && ocrInput) {
        ocrBtn.addEventListener('click', () => {
            ocrInput.value = ''; // Reset
            ocrInput.click();
        });
        ocrInput.addEventListener('change', (e) => handleFileSelect(e, 'ocr'));
    }

    // Cancel Crop
    if (cancelCropBtn) {
        cancelCropBtn.addEventListener('click', () => {
            cropModal.classList.remove('active');
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
        });
    }

    // Confirm Crop & Scan
    if (confirmCropBtn) {
        confirmCropBtn.addEventListener('click', async () => {
            alert("DEBUG: Crop Button Clicked"); // DEBUG ALERT
            if (!cropper) {
                alert("Error: No cropper instance");
                return;
            }
            const canvas = cropper.getCroppedCanvas();
            cropModal.classList.remove('active');
            loadingOverlay.classList.add('active');

            try {
                if (currentScanMode === 'ocr') {
                    // ... OCR Logic ...
                    const croppedDataUrl = canvas.toDataURL('image/png');
                    const result = await Tesseract.recognize(croppedDataUrl, 'eng');
                    const text = result.data.text.replace(/[^a-zA-Z0-9\s]/g, '').trim();

                    if (text) {
                        document.getElementById('searchInput').value = text;
                        filterTable();
                        addToScannedList(text + " (OCR)");
                    } else {
                        alert("No text detected.");
                    }
                } else if (currentScanMode === 'barcode') {
                    // ... Barcode Logic ...

                    // Pre-process image for better detection (Grayscale + Contrast)
                    const ctx = canvas.getContext('2d');
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imgData.data;

                    // Simple Grayscale & Contrast
                    const contrast = 1.25; // 25% extra contrast
                    const intercept = 128 * (1 - contrast);

                    for (let i = 0; i < data.length; i += 4) {
                        // Grayscale (Luma)
                        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

                        // Contrast
                        let newGray = gray * contrast + intercept;
                        // Clamp
                        newGray = newGray > 255 ? 255 : (newGray < 0 ? 0 : newGray);

                        data[i] = newGray;
                        data[i + 1] = newGray;
                        data[i + 2] = newGray;
                    }
                    ctx.putImageData(imgData, 0, 0);

                    // converting canvas to blob
                    canvas.toBlob(async (blob) => {
                        const file = new File([blob], "temp.png", { type: "image/png" });
                        console.log("Scanning file:", file.size, file.type);

                        try {
                            // Initialize if not exists (Camera might not have been started)
                            if (!html5QrCode) {
                                html5QrCode = new Html5Qrcode("reader", scannerConfig);
                            }

                            // scanFileV2(file, showImage)
                            console.log("Starting file scan...");
                            alert("Debugging: Starting scanFileV2..."); // DEBUG ALERT
                            try {
                                const scanResult = await html5QrCode.scanFileV2(file, false);
                                if (scanResult) {
                                    alert("Scan Success: " + scanResult.decodedText); // DEBUG ALERT
                                    processScanResult(scanResult.decodedText);
                                }
                            } catch (scanErr) {
                                console.warn("scanFileV2 failed, trying scanFile...", scanErr);
                                alert("V2 Failed: " + scanErr + "\nTrying V1..."); // DEBUG ALERT
                                // Fallback to older scanFile if V2 fails (sometimes robust for simple images)
                                try {
                                    const scanResult = await html5QrCode.scanFile(file, false);
                                    processScanResult(scanResult);
                                } catch (fallbackErr) {
                                    throw new Error("Both scan methods failed. " + fallbackErr);
                                }
                            }
                        } catch (err) {
                            console.error("File scan error:", err);
                            // Show specific error to user to help debug
                            alert(`Final Error: ${err}`);
                        }
                    }, 'image/png'); // Force PNG format for blob consistency
                }
            } catch (error) {
                console.error(error);
                alert("Processing failed: " + error.message);
            } finally {
                loadingOverlay.classList.remove('active');
                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }
            }
        });
    }

    /* REMOVING OLD EVENT LISTENERS TO AVOID DUPLICATION - REFACTORED ABOVE */
    /* 
    if (ocrBtn && ocrInput) {
        // ... (Old code removed by Replacement) ...
    } 
    */
});

function generateCSV() {
    const now = new Date().toLocaleString();
    let csvContent = `Date: ${now}\n`;
    csvContent += "ID/Barcode,Status,Notes\n";

    scannedItems.forEach(item => {
        // Escape quotes in notes if necessary
        const safeNotes = item.notes.replace(/"/g, '""');
        csvContent += `${item.id},${item.status},"${safeNotes}"\n`;
    });
    return csvContent;
}

function exportCSV() {
    const csvContent = generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `scan_session_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function shareList() {
    const csvContent = generateCSV();
    const file = new File([csvContent], "scan_list.csv", { type: "text/csv" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: 'Cargo Scan List',
                text: 'Here is the list of scanned cargo items.',
                files: [file]
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    } else {
        // Fallback or alert
        alert("Sharing not supported on this device/browser. Downloading instead.");
        exportCSV();
    }
}
