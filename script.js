
let cargoData = [];
// Default to 'Approved' or let user click? Let's default to 'Approved' as it's common, or keep 'all' logic if we want to show everything initially? 
// The user request implies 3 specific views. I will default to 'Approved'.
let currentFilter = 'Approved'; 

document.addEventListener('DOMContentLoaded', () => {
    // Set initial active state
    setFilter(currentFilter);
    fetchData();
});

async function fetchData() {
    try {
        const response = await fetch('data.json');
        cargoData = await response.json();
        
        updateCounts();
        // Re-run filter to ensure table allows shows data based on the default filter
        filterTable();
        updateStats();
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="2">Error loading data.</td></tr>';
    }
}

function updateCounts() {
    const approvedCount = cargoData.filter(item => item.status === 'Approved').length;
    const rejectedCount = cargoData.filter(item => item.status === 'Rejected').length;
    const sabanCount = cargoData.filter(item => item.status === 'Saban').length;

    document.getElementById('count-approved').textContent = `(${approvedCount})`;
    document.getElementById('count-rejected').textContent = `(${rejectedCount})`;
    document.getElementById('count-saban').textContent = `(${sabanCount})`;
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 2rem; color: #888;">No results found</td></tr>';
        return;
    }

    // Limit display for performance if needed, though 500 is fine
    const displayData = data.slice(0, 500);

    displayData.forEach(item => {
        const tr = document.createElement('tr');
        let statusClass = '';
        if (item.status === 'Approved') statusClass = 'status-approved';
        else if (item.status === 'Rejected') statusClass = 'status-rejected';
        else if (item.status === 'Saban') statusClass = 'status-saban';
        
        tr.innerHTML = `
            <td><strong>${item.id}</strong></td>
            <td><span class="status ${statusClass}">${item.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTable() {
    const searchVal = document.getElementById('searchInput').value.toLowerCase();

    const filtered = cargoData.filter(item => {
        const matchesSearch = item.id.toString().toLowerCase().includes(searchVal);
        // Strict equality for status since we removed 'all' option
        const matchesStatus = item.status === currentFilter;
        return matchesSearch && matchesStatus;
    });

    renderTable(filtered);
    updateStats(filtered.length);
}

function setFilter(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    // map status to button id
    const btnId = 'btn-' + status.toLowerCase();
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');
    
    filterTable();
}

function updateStats(count) {
    // If count is undefined, it might be initial load or something
    if (typeof count === 'undefined') {
         // Default to showing count of current filter
         const filtered = cargoData.filter(item => item.status === currentFilter);
         count = filtered.length;
    }
    document.getElementById('stats').textContent = `Showing ${count} items`;
}
