/* admin-booking.js - Complete Version */

let bookingModal;

document.addEventListener('DOMContentLoaded', () => {
    // Init Modal
    const modalEl = document.getElementById('bookingModal');
    if (modalEl) bookingModal = new bootstrap.Modal(modalEl);

    // Set Default Date Filter = Today
    document.getElementById('bookingDateFilter').valueAsDate = new Date();

    // Render
    renderBookings();
});

// --- RENDER TABLE ---
function renderBookings() {
    const tbody = document.getElementById('bookingTableBody');
    const bookings = DB.getBookings();
    
    const filterDate = document.getElementById('bookingDateFilter').value;
    const filterStatus = document.getElementById('bookingStatusFilter').value;

    tbody.innerHTML = '';

    const filtered = bookings.filter(b => {
        if (filterDate && b.date !== filterDate) return false;
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
    });

    // ✅ การเรียงลำดับ (Status > PC > Time)
    filtered.sort((a, b) => {
        const statusPriority = {
            'reserved': 1,
            'in_use': 2,
            'completed': 3,
            'no_show': 3
        };
        const priorityA = statusPriority[a.status] || 3;
        const priorityB = statusPriority[b.status] || 3;
        if (priorityA !== priorityB) return priorityA - priorityB;

        const nameA = a.pcName || '';
        const nameB = b.pcName || '';
        const pcCompare = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        if (pcCompare !== 0) return pcCompare;

        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีรายการจองในวันนี้</td></tr>`;
        return;
    }

    filtered.forEach(b => {
        let badgeClass = '';
        let statusText = '';
        let actionBtns = '';

        // กำหนดสีและปุ่มตามสถานะ
        switch(b.status) {
            case 'reserved':
                badgeClass = 'bg-warning text-dark'; 
                statusText = 'จอง';
                actionBtns = `<button class="btn btn-sm btn-outline-secondary" onclick="updateStatus('${b.id}', 'no_show')"><i class="bi bi-person-x"></i> No Show</button>`;
                break;
            case 'in_use':
                badgeClass = 'bg-danger'; 
                statusText = 'ใช้งานอยู่';
                actionBtns = `<button class="btn btn-sm btn-outline-success" onclick="updateStatus('${b.id}', 'completed')"><i class="bi bi-check-lg"></i> เสร็จสิ้น</button>`;
                break;
            case 'completed':
                badgeClass = 'bg-success'; 
                statusText = 'ใช้งานเสร็จสิ้น';
                actionBtns = `<span class="text-muted small"><i class="bi bi-check-circle-fill"></i> เรียบร้อย</span>`;
                break;
            case 'no_show':
                badgeClass = 'bg-secondary'; 
                statusText = 'ไม่พบการใช้งาน';
                actionBtns = `<span class="text-muted small">ยกเลิก/ไม่มา</span>`;
                break;
            default:
                badgeClass = 'bg-light text-dark border'; 
                statusText = b.status;
        }

        // เพิ่มปุ่มลบ
        actionBtns += ` <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteBooking('${b.id}')"><i class="bi bi-trash"></i></button>`;

        // ✅ แสดงผล Software/AI เป็น Badge
        let softwareDisplay = '-';
        if (b.softwareList && Array.isArray(b.softwareList)) {
            softwareDisplay = b.softwareList.map(sw => {
                if(sw === 'ซอฟต์แวร์ทั่วไป') return `<span class="badge bg-secondary bg-opacity-10 text-secondary border">General</span>`;
                return `<span class="badge bg-primary bg-opacity-10 text-primary border">${sw}</span>`;
            }).join(' ');
        } else if (b.note) {
            softwareDisplay = `<span class="text-muted small">${b.note}</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-primary">${b.startTime} - ${b.endTime}</td>
            <td>
                <div class="fw-bold">${b.userName}</div>
                <div class="small text-muted">${b.userId}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${b.pcName}</span></td>
            <td>${softwareDisplay}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td class="text-end pe-4">${actionBtns}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- ACTIONS ---

function updateStatus(id, newStatus) {
    let bookings = DB.getBookings();
    const index = bookings.findIndex(b => b.id === id);
    if (index !== -1) {
        if (newStatus === 'no_show' || newStatus === 'completed') {
            DB.updatePCStatus(bookings[index].pcId, 'available');
        }
        bookings[index].status = newStatus;
        DB.saveBookings(bookings);
        renderBookings();
    }
}

function openBookingModal() {
    const pcs = DB.getPCs();
    const select = document.getElementById('bkPcSelect');
    select.innerHTML = '';
    pcs.forEach(pc => {
        const option = document.createElement('option');
        option.value = pc.id;
        option.text = `${pc.name} (${pc.status})`;
        select.appendChild(option);
    });

    document.getElementById('bkUser').value = '';
    document.getElementById('bkDate').valueAsDate = new Date();
    document.getElementById('bkTimeStart').value = '09:00';
    document.getElementById('bkTimeEnd').value = '12:00';
    
    // ✅ Reset ประเภท
    document.getElementById('typeGeneral').checked = true;
    toggleSoftwareList();

    // ✅ โหลดรายชื่อ AI
    const container = document.getElementById('aiCheckboxList');
    container.innerHTML = '';
    const lib = DB.getSoftwareLib ? DB.getSoftwareLib() : [];
    const aiTools = lib.filter(item => item.type === 'AI');

    if (aiTools.length === 0) {
        container.innerHTML = '<span class="text-muted small">ไม่พบรายการ AI ในระบบ</span>';
    } else {
        aiTools.forEach(tool => {
            container.innerHTML += `
                <div class="col-6">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" name="aiSelect" value="${tool.name}" id="ai_${tool.id}">
                        <label class="form-check-label small" for="ai_${tool.id}">${tool.name}</label>
                    </div>
                </div>
            `;
        });
    }

    bookingModal.show();
}

function saveBooking() {
    const pcs = DB.getPCs();
    const pcId = document.getElementById('bkPcSelect').value;
    const pc = pcs.find(p => String(p.id) === String(pcId));

    const inputUser = document.getElementById('bkUser').value.trim();
    const regUser = DB.checkRegAPI(inputUser);
    
    let finalUserId = inputUser; 
    let finalUserName = inputUser; 

    if (regUser) {
        finalUserId = inputUser;
        finalUserName = regUser.prefix + regUser.name; 
    } else {
        finalUserId = 'Manual-' + Date.now(); 
    }

    // ✅ ดึงค่า AI ที่เลือก
    const isAI = document.getElementById('typeAI').checked;
    let selectedTools = [];
    if (isAI) {
        const checkboxes = document.querySelectorAll('input[name="aiSelect"]:checked');
        selectedTools = Array.from(checkboxes).map(cb => cb.value);
    }
    const displaySoftware = isAI ? (selectedTools.length > 0 ? selectedTools : ['AI Work']) : ['ซอฟต์แวร์ทั่วไป'];

    const newBooking = {
        id: 'b' + Date.now(),
        userId: finalUserId,
        userName: finalUserName,
        pcId: pcId,
        pcName: pc ? pc.name : 'Unknown',
        date: document.getElementById('bkDate').value,
        startTime: document.getElementById('bkTimeStart').value,
        endTime: document.getElementById('bkTimeEnd').value,
        softwareList: displaySoftware,
        status: 'reserved'
    };

    let bookings = DB.getBookings();
    bookings.push(newBooking);
    DB.saveBookings(bookings);

    bookingModal.hide();
    renderBookings();
    alert(`✅ บันทึกการจองสำเร็จ\n(ผู้จอง: ${finalUserName})`);
}

function deleteBooking(id) {
    if(confirm('คุณต้องการลบรายการจองนี้ออกจากระบบใช่หรือไม่?')) {
        let bookings = DB.getBookings();
        const newBookings = bookings.filter(b => b.id !== id);
        DB.saveBookings(newBookings);
        renderBookings();
    }
}

// ✅ ฟังก์ชัน Toggle การแสดงผลรายชื่อ AI
function toggleSoftwareList() {
    const isAI = document.getElementById('typeAI').checked;
    const box = document.getElementById('aiSelectionBox');
    if (isAI) {
        box.classList.remove('d-none');
    } else {
        box.classList.add('d-none');
    }
}