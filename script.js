/**
 * Cargo Dashboard - Main Logic (v3.0 - Full Rewrite)
 * 
 * Features:
 * - Centralized App State
 * - Robust Camera Handling
 * - Image Cropping & Scanning (Barcode + OCR)
 * - Data Filtering & Management
 */

'use strict';

const App = {
    state: {
        cargoData: [],
        scannedItems: [],
        cameras: [],
        currentCameraIndex: 0,
        scannerInstance: null,
        cropperInstance: null,
        scanMode: 'barcode', // 'barcode' or 'ocr'
        scanInterval: null
    },

    init: async () => {
        console.log("[App v3.0] Initializing...");

        try {
            await App.connectData();
            App.bindEvents();
            App.updateDashboard();
            console.log("[App v3.0] Ready.");
        } catch (e) {
            console.error("Init failed:", e);
            alert("Initialization Failed: " + e.message);
        }
    },

    connectData: async () => {
        try {
            const res = await fetch('data.json?t=' + Date.now());
            if (!res.ok) throw new Error("Failed to load data.json");
            App.state.cargoData = await res.json();
        } catch (e) {
            console.error(e);
            document.getElementById('last-updated').textContent = "Data Load Error";
            throw e;
        }
    },

    bindEvents: () => {
        // UI Controls
        App.bind('searchInput', 'keyup', App.UI.filterTable);
        App.bind('statusFilter', 'change', App.UI.filterTable);
        App.bind('clearSearchBtn', 'click', App.UI.clearSearch);
        App.bind('toggleListBtn', 'click', App.UI.toggleList);

        // Buttons
        App.bind('scanBtn', 'click', App.Scanner.open);
        App.bind('scanImgBtn', 'click', () => { App.Scanner.prepareFileScan('barcode'); });
        App.bind('ocrBtn', 'click', () => { App.Scanner.prepareFileScan('ocr'); });
        App.bind('shareBtn', 'click', App.Export.share);
        App.bind('downloadBtn', 'click', App.Export.download);

        // Modals
        App.bind('switchCameraBtn', 'click', App.Scanner.switchCamera);
        App.bind('cancelCropBtn', 'click', App.Cropper.close);
        App.bind('confirmCropBtn', 'click', App.Cropper.process);

        // Note Modal
        App.bind('saveNoteBtn', 'click', App.Notes.save);

        // Inputs
        App.bind('scanImgInput', 'change', (e) => App.Cropper.loadFile(e, 'barcode'));
        App.bind('ocrInput', 'change', (e) => App.Cropper.loadFile(e, 'ocr'));

        // Global Modal Closes
        document.querySelectorAll('.close-modal, .close-note-modal').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
                App.Scanner.stop();
                App.Cropper.close();
            });
        });
    },

    bind: (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
        else console.warn(`Element #${id} not found for event ${event}`);
    },

    updateDashboard: () => {
        App.UI.updateTime();
        App.UI.updateStats();
        App.UI.renderChart();
        App.UI.filterTable();
    },

    // --- UI Logic ---
    UI: {
        updateTime: () => {
            document.getElementById('last-updated').textContent = "Updated: " + new Date().toLocaleTimeString();
        },

        updateStats: () => {
            const data = App.state.cargoData;
            document.getElementById('count-approved').textContent = data.filter(i => i.status === 'Approved').length;
            document.getElementById('count-rejected').textContent = data.filter(i => i.status === 'Rejected').length;
            document.getElementById('count-saban').textContent = data.filter(i => i.status === 'Saban').length;
        },

        renderChart: () => {
            const ctx = document.getElementById('statusChart');
            if (!ctx) return;

            // Destroy existing if stored on the canvas element specifically (Chart.js logic)
            const existingChart = Chart.getChart(ctx);
            if (existingChart) existingChart.destroy();

            const data = App.state.cargoData;
            const counts = [
                data.filter(i => i.status === 'Approved').length,
                data.filter(i => i.status === 'Rejected').length,
                data.filter(i => i.status === 'Saban').length
            ];

            new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Approved', 'Rejected', 'Saban'],
                    datasets: [{
                        data: counts,
                        backgroundColor: ['#2ecc71', '#e74c3c', '#f1c40f']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        },

        clearSearch: () => {
            document.getElementById('searchInput').value = '';
            App.UI.filterTable();
        },

        filterTable: () => {
            const term = document.getElementById('searchInput').value.toLowerCase();
            const status = document.getElementById('statusFilter').value;
            const clearBtn = document.getElementById('clearSearchBtn');

            if (clearBtn) clearBtn.style.display = term ? 'block' : 'none';

            const filtered = App.state.cargoData.filter(item => {
                const s = item.status || "";
                const matchedId = item.id.toString().toLowerCase().includes(term);
                const matchedStatus = status === 'All' || s === status;
                return matchedId && matchedStatus;
            });

            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';
            document.getElementById('stats').textContent = `Showing ${filtered.length} entries`;

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 20px;">No matches found</td></tr>`;
                return;
            }

            const frag = document.createDocumentFragment();
            filtered.slice(0, 100).forEach(item => { // Limit render
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${item.id}</td><td><span class="badge ${item.status.toLowerCase()}">${item.status}</span></td>`;
                frag.appendChild(tr);
            });
            tbody.appendChild(frag);
        },

        toggleList: () => {
            const body = document.getElementById('tableBody');
            const icon = document.getElementById('toggleIcon');
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? '' : 'none';
            // Simple icon toggle
            icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    },

    // --- Scanner Logic ---
    Scanner: {
        open: async () => {
            document.getElementById('scannerModal').classList.add('active');

            try {
                if (!App.state.cameras.length) {
                    App.state.cameras = await Html5Qrcode.getCameras();

                    // Auto-select back camera
                    const backCamIndex = App.state.cameras.findIndex(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment'));
                    if (backCamIndex >= 0) App.state.currentCameraIndex = backCamIndex;
                }

                if (App.state.cameras.length > 1) {
                    document.getElementById('switchCameraBtn').style.display = 'block';
                } else {
                    document.getElementById('switchCameraBtn').style.display = 'none';
                }

                App.Scanner.start();

            } catch (err) {
                console.error(err);
                alert("Camera Access Error: " + err);
            }
        },

        start: () => {
            if (App.state.scannerInstance) {
                // If already scanning, stop first? Usually safe to stop.
                // We'll trust the flow logic to not double-start.
            } else {
                App.state.scannerInstance = new Html5Qrcode("reader");
            }

            if (App.state.cameras.length === 0) return;

            const camId = App.state.cameras[App.state.currentCameraIndex].id;
            const camLabel = App.state.cameras[App.state.currentCameraIndex].label;
            document.getElementById('cameraName').textContent = camLabel;

            App.state.scannerInstance.start(
                camId,
                {
                    fps: 10,
                    qrbox: 250,
                    experimentalFeatures: { useBarCodeDetectorIfSupported: true }
                },
                (decodedText) => {
                    App.Scanner.handleResult(decodedText);
                },
                (errorMessage) => {
                    // Ignore frame errors
                }
            ).catch(err => {
                console.error("Start failed", err);
                alert("Could not start camera.");
            });
        },

        stop: () => {
            if (App.state.scannerInstance) {
                App.state.scannerInstance.stop().then(() => {
                    App.state.scannerInstance.clear();
                    document.getElementById('scannerModal').classList.remove('active');
                }).catch(err => {
                    console.log("Stop fail (ignore if not running)", err);
                    document.getElementById('scannerModal').classList.remove('active');
                });
            } else {
                document.getElementById('scannerModal').classList.remove('active');
            }
        },

        switchCamera: () => {
            if (App.state.cameras.length < 2) return;

            App.state.currentCameraIndex = (App.state.currentCameraIndex + 1) % App.state.cameras.length;

            App.state.scannerInstance.stop().then(() => {
                App.Scanner.start();
            }).catch(err => {
                console.error("Failed to stop for switch", err);
            });
        },

        handleResult: (text) => {
            // Audio feedack could go here
            App.Scanner.stop();
            App.UI.processScanResult(text);
        },

        prepareFileScan: (mode) => {
            App.state.scanMode = mode;
            if (mode === 'barcode') document.getElementById('scanImgInput').click();
            else document.getElementById('ocrInput').click();
        }
    },

    // --- Crop & Image Logic ---
    Cropper: {
        loadFile: (e, mode) => {
            try {
                const file = e.target.files[0];
                if (!file) return;

                App.Utils.showLoading(true, "Preparing Image...");

                App.state.scanMode = mode;
                const reader = new FileReader();

                reader.onload = (evt) => {
                    const img = document.getElementById('imageToCrop');

                    img.onload = () => {
                        App.Utils.showLoading(false);
                        document.getElementById('cropModal').classList.add('active');

                        // Destroy old cropper
                        if (App.state.cropperInstance) {
                            App.state.cropperInstance.destroy();
                            App.state.cropperInstance = null;
                        }

                        // Initialize new Cropper
                        App.state.cropperInstance = new Cropper(img, {
                            viewMode: 1,
                            autoCropArea: 0.8,
                            responsive: true
                        });
                    };

                    img.onerror = (e) => {
                        App.Utils.showLoading(false);
                        alert("Error: Image failed to render.");
                    };

                    img.src = evt.target.result;
                };

                reader.onerror = () => {
                    App.Utils.showLoading(false);
                    alert("Error: FileReader failed");
                }

                reader.readAsDataURL(file);
                e.target.value = ''; // Reset input
            } catch (err) {
                alert("Error: " + err.message);
            }
        },

        close: () => {
            document.getElementById('cropModal').classList.remove('active');
            if (App.state.cropperInstance) {
                App.state.cropperInstance.destroy();
                App.state.cropperInstance = null;
            }
        },

        process: async () => {
            if (!App.state.cropperInstance) return;

            // Verify Canvas
            const canvas = App.state.cropperInstance.getCroppedCanvas({
                width: 800, // Limit width for performance/quality balance
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            });

            if (!canvas) {
                alert("Could not crop image. Try again.");
                return;
            }

            App.Cropper.close();
            App.Utils.showLoading(true, "Processing...");

            try {
                if (App.state.scanMode === 'ocr') {
                    // Alert: Tesseract starting
                    // alert("Debug: Starting Tesseract...");

                    const dataUrl = canvas.toDataURL('image/png');

                    const result = await Tesseract.recognize(dataUrl, 'eng', {
                        logger: m => {
                            if (m.status === 'recognizing text') {
                                App.Utils.showLoading(true, `Recognizing... ${Math.round(m.progress * 100)}%`);
                            }
                        }
                    });

                    const rawText = result.data.text;
                    // ALERT RAW OUTPUT (Debugging)
                    if (!rawText || rawText.trim().length === 0) {
                        alert("Debug: OCR finished but found NO text at all.");
                    } else {
                        // alert("Debug Raw OCR: " + rawText.substring(0, 50)); // Show first 50 chars
                    }

                    // Allow letters, numbers, dashes, and spaces.
                    const text = rawText.replace(/[^a-zA-Z0-9\-\s]/g, ' ').trim();
                    App.Utils.showLoading(false);

                    if (text.length > 0) { // Very relaxed check
                        App.UI.processScanResult(text + " (OCR)");
                    } else {
                        alert("No legible text found. \nRaw was: " + rawText.substring(0, 20) + "...");
                    }

                } else {
                    // Barcode Scan of File
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    const file = new File([blob], "scanned_crop.png", { type: "image/png" });

                    // Use Html5Qrcode file scanner
                    const fileScanner = new Html5Qrcode("reader"); // Re-use main ID or create temp? 
                    // Better to use static method if possible, but library requires instance usually for full config.
                    // We will re-use the 'reader' div logic but we don't need to mount it potentially.
                    // Actually, let's create a *new* instance or use the existing one if idle.

                    if (!App.state.scannerInstance) App.state.scannerInstance = new Html5Qrcode("reader");

                    try {
                        const result = await App.state.scannerInstance.scanFile(file, true);
                        App.Utils.showLoading(false);
                        App.UI.processScanResult(result);
                    } catch (err) {
                        App.Utils.showLoading(false);
                        console.warn(err);
                        alert("No barcode found in selection.");
                    }
                }
            } catch (err) {
                App.Utils.showLoading(false);
                console.error(err);
                alert("Processing failed: " + err.message);
            }
        }
    },

    // --- Helper Utils ---
    Utils: {
        showLoading: (show, msg = "Loading...") => {
            const el = document.getElementById('loadingOverlay');
            if (show) {
                el.querySelector('h3').textContent = msg;
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }
    },

    // --- Extentions for Scanned List ---
    scannedList: [],

    // Add result processing to UI
};

/** 
 * Late binding for processScanResult since it crosses domains 
 */
App.UI.processScanResult = (text) => {
    // 1. Set Search
    const searchInput = document.getElementById('searchInput');
    searchInput.value = text;

    // 2. Trigger Filter
    App.UI.filterTable();

    // 3. Add to Scanned List (Session)
    App.List.add(text);

    // 4. Feedback
    // alert("Scanned: " + text); 
};

// --- List Manager (Session) ---
App.List = {
    add: (code) => {
        const existingData = App.state.cargoData.find(d => d.id.toString() === code.toString()) || {};

        App.state.scannedItems.push({
            scanId: Date.now(),
            code: code,
            status: existingData.status || 'Unknown',
            note: ''
        });

        App.List.render();
    },

    render: () => {
        const tbody = document.getElementById('scannedTableBody');
        tbody.innerHTML = '';

        App.state.scannedItems.forEach((item, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.code}</td>
                <td>${item.status}</td>
                <td>
                    <button class="icon-btn" onclick="App.Notes.open(${idx})">📝</button>
                    <button class="icon-btn delete-btn" onclick="App.List.remove(${idx})">❌</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    remove: (idx) => {
        if (confirm("Remove this scan?")) {
            App.state.scannedItems.splice(idx, 1);
            App.List.render();
        }
    }
};

// --- Note Manager ---
App.Notes = {
    currentIndex: null,

    open: (idx) => {
        App.Notes.currentIndex = idx;
        const item = App.state.scannedItems[idx];
        document.getElementById('noteInput').value = item.note || '';
        document.getElementById('noteModal').classList.add('active');
    },

    save: () => {
        if (App.Notes.currentIndex !== null) {
            const val = document.getElementById('noteInput').value;
            App.state.scannedItems[App.Notes.currentIndex].note = val;
            document.getElementById('noteModal').classList.remove('active');
            App.List.render(); // Update UI? (Notes not visible in table currently, but state saved)
        }
    }
};

// --- Export ---
App.Export = {
    download: () => {
        if (App.state.scannedItems.length === 0) {
            alert("Nothing to export");
            return;
        }

        const headers = ["Unique ID", "Code", "Status", "Note"];
        const rows = App.state.scannedItems.map(i => `${i.scanId},${i.code},${i.status},"${i.note}"`);
        const csvContent = [headers.join(','), ...rows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scan_report_${Date.now()}.csv`;
        a.click();
    },

    share: () => {
        if (navigator.share) {
            navigator.share({
                title: 'Cargo Scan Report',
                text: `Scanned ${App.state.scannedItems.length} items.`,
                url: window.location.href
            }).catch(console.error);
        } else {
            alert("Share not supported on this device/browser.");
        }
    }
};


// Start
document.addEventListener('DOMContentLoaded', App.init);
