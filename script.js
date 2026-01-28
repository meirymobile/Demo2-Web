
let cargoData = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
});

async function fetchData() {
    try {
        const response = await fetch('data.json');
        cargoData = await response.json();
        renderTable(cargoData);
        updateStats();
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="2">Error loading data.</td></tr>';
    }
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 2rem; color: #888;">No results found</td></tr>';
        return;
    }

    const displayData = data.slice(0, 500);

    displayData.forEach(item => {
        const tr = document.createElement('tr');
        const statusClass = item.status.toLowerCase() === 'approved' ? 'status-approved' : 'status-rejected';
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
        const matchesStatus = currentFilter === 'all' || item.status === currentFilter;
        return matchesSearch && matchesStatus;
    });

    renderTable(filtered);
    document.getElementById('stats').textContent = `Showing ${filtered.length} of ${cargoData.length} items`;
}

function setFilter(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    filterTable();
}

function updateStats() {
    document.getElementById('stats').textContent = `Showing ${cargoData.length} items`;
}
