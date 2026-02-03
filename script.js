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

function startScanner() {
    // Standard config logic
    const config = {
        fps: 15, // Balanced FPS
        // qrbox: { width: 300, height: 200 } // REMOVED: Scanning the whole frame is often more reliable
    };

    // If instance exists, just start it. If not, create it.
    if (!html5QrCode) {
        // Explicitly include common formats to ensure Code 128 (like the example) and others are detected reliably
        html5QrCode = new Html5Qrcode("reader", {
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
                Html5QrcodeSupportedFormats.PDF_417
            ],
            verbose: false
        });
    }

    const startConfig = {
        facingMode: "environment"
    };

    html5QrCode.start(
        startConfig,
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.error("Error starting scanner", err);
        document.getElementById("reader").innerText = "Camera failed: " + err;
        alert("Error starting camera: " + err);
        stopScanner();
    });
}

async function stopScanner() {
    const modal = document.getElementById('scannerModal');
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
            // html5QrCode.clear(); // Removing this as it removes the element content, sometimes tricky
        } catch (error) {
            console.log("Scanner stop error (ignore if not running):", error);
        }
    }
    modal.classList.remove('active');
}

let scannedItems = [];

function onScanSuccess(decodedText, decodedResult) {
    // Handle the scanned code
    console.log(`Scan result: ${decodedText}`, decodedResult);

    // Stop scanner and close modal
    stopScanner();

    // Update search field
    const searchInput = document.getElementById('searchInput');
    searchInput.value = decodedText;

    // Trigger filter
    filterTable();

    // Add to scanned list
    addToScannedList(decodedText);
}

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
    // Only log if you want to debug individual frame failures. 
    // Usually too verbose.
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
    // Let's toggle the table body for smoother feel or just the container content.
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
    const ocrBtn = document.getElementById('ocrBtn');
    const ocrInput = document.getElementById('ocrInput');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Crop Elements
    const cropModal = document.getElementById('cropModal');
    const imageToCrop = document.getElementById('imageToCrop');
    const confirmCropBtn = document.getElementById('confirmCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    let cropper = null;

    if (ocrBtn && ocrInput) {
        ocrBtn.addEventListener('click', () => {
            console.log("OCR Button Clicked");
            // Reset value to ensure change event fires even if same file selected
            ocrInput.value = '';
            ocrInput.click();
        });

        ocrInput.addEventListener('change', (e) => {
            console.log("File Input Changed");
            const file = e.target.files[0];
            if (!file) {
                console.log("No file selected");
                return;
            }

            // Check if Cropper is loaded
            if (typeof Cropper === 'undefined') {
                alert("Cropper library not loaded. Please wait or refresh the page.");
                return;
            }

            // 1. Read file to display in cropper
            const reader = new FileReader();
            reader.onload = (event) => {
                console.log("File read successfully");
                imageToCrop.src = event.target.result;
                console.log("Activating Crop Modal");
                cropModal.classList.add('active');

                // Destroy old instance if exists
                if (cropper) {
                    cropper.destroy();
                }

                // Initialize Cropper with a small delay to ensure image DOM is ready
                setTimeout(() => {
                    try {
                        console.log("Initializing Cropper...");
                        cropper = new Cropper(imageToCrop, {
                            viewMode: 1,
                            movable: true,
                            zoomable: true,
                            rotatable: true,
                            scalable: true,
                            autoCropArea: 0.8,
                            ready() {
                                console.log("Cropper is ready");
                            },
                        });
                    } catch (err) {
                        console.error("Cropper Init Error:", err);
                        alert("Failed to start Cropper: " + err.message);
                    }
                }, 100);
            };

            reader.onerror = (err) => {
                console.error("FileReader Error:", err);
                alert("Error reading file: " + err);
            };

            reader.readAsDataURL(file);
        });

        // Cancel Crop
        if (cancelCropBtn) {
            cancelCropBtn.addEventListener('click', () => {
                console.log("Cancel Crop Clicked");
                cropModal.classList.remove('active');
                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }
                ocrInput.value = '';
            });
        }

        // Confirm Crop & Scan
        if (confirmCropBtn) {
            confirmCropBtn.addEventListener('click', async () => {
                console.log("Confirm Crop Clicked");
                if (!cropper) return;

                // Get cropped canvas
                const canvas = cropper.getCroppedCanvas();

                // Close modal immediately
                cropModal.classList.remove('active');

                // Show loading
                loadingOverlay.classList.add('active');

                try {
                    // Convert canvas to blob/dataURL for Tesseract
                    const croppedDataUrl = canvas.toDataURL('image/png');

                    const result = await Tesseract.recognize(
                        croppedDataUrl,
                        'eng'
                    );

                    const text = result.data.text;
                    console.log('OCR Result:', text);

                    // Simple cleanup: remove special chars, keep alphanumeric
                    const cleanedText = text.replace(/[^a-zA-Z0-9\s]/g, '').trim();

                    if (cleanedText) {
                        document.getElementById('searchInput').value = cleanedText;
                        filterTable();
                        addToScannedList(cleanedText + " (OCR)"); // Mark as OCR source
                    } else {
                        alert("No text detected. Please try again.");
                    }

                } catch (error) {
                    console.error(error);
                    alert("Failed to recognize text: " + error.message);
                } finally {
                    loadingOverlay.classList.remove('active');
                    if (cropper) {
                        cropper.destroy();
                        cropper = null;
                    }
                    ocrInput.value = '';
                }
            });
        }
    }
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
